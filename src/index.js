import Fastify from 'fastify';
import  RedisConPl  from './plugins/redis.js';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import cors from '@fastify/middie';
import { loadAquilesConfig } from './configs/configs.js';
import { SCHEMA_FIELD_TYPE, SCHEMA_VECTOR_FIELD_ALGORITHM } from 'redis';


const fastify = Fastify({
    logger: true,
    ajv: {
      customOptions: { allErrors: true}
    }
})

await fastify.register(swagger, {
    openapi: {
        openapi: '3.0.0',
        info: {title: 'Aquiles-RAG-js', version: '0.1.0'}
    }
})

fastify.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    fastify.log.error({ validation: error.validation }, 'AJV validation failed')
  }
  reply.send(error)
})

await fastify.register(RedisConPl)

await fastify.register(cors, {
    origin: '*',
    methods: ['GET','POST'],
})

await fastify.register(swaggerUI, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list' }
})

fastify.decorate('verifyApiKey', async (request, reply) => {
  const configs   = loadAquilesConfig()
  const validKeys = (configs.allows_api_keys || [])
                      .filter(k => k && k.trim())

  if (validKeys.length === 0) {
    return
  }

  const apiKey = request.headers['x-api-key']
  if (!apiKey) {
    reply
      .code(403)
      .send({ detail: 'API key missing' })
    return reply 
  }
  if (!validKeys.includes(apiKey)) {
    reply
      .code(403)
      .send({ detail: 'Invalid API key' })
    return reply 
  }
  return
})


fastify.get('/', async function(request, reply) {
    reply.send({hello: 'Hey this is the JS version of Aquiles-RAG'})
})

fastify.post('/create/index', {
  schema: {
    body: {
      type: 'object',
      required: ['indexname', 'embeddings_dim', 'dtype', 'delete_the_index_if_it_exists'],
      properties: {
        indexname: { type: 'string' },
        embeddings_dim: { type: 'number' },
        dtype:      { type: 'string', enum: ['FLOAT32','FLOAT16','FLOAT64'] },
        delete_the_index_if_it_exists: { type: 'boolean' },
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          index:  { type: 'string' },
          fields: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  },

  preHandler: fastify.verifyApiKey,
}, async (request, reply) => {
  const { indexname, embeddings_dim, dtype, delete_the_index_if_it_exists } = request.body;
  const client = fastify.redis;

  
  let info = null;
  try {
    info = await client.ft.info(indexname);
  } catch (_) { /* no existe */ }

  if (info && !delete_the_index_if_it_exists) {
    return reply
      .code(400)
      .send({
        error: `Index '${indexname}' already exists. Set delete_the_index_if_it_exists=true to overwrite.`
      });
  }

  if (info && delete_the_index_if_it_exists) {
    
    await client.ft.dropIndex(indexname, { DD: false });
  }

  
  const schema = {
    name_chunk: { type: SCHEMA_FIELD_TYPE.TEXT, SORTABLE: true },
    chunk_id:   { type: SCHEMA_FIELD_TYPE.NUMERIC, SORTABLE: true },
    chunk_size: { type: SCHEMA_FIELD_TYPE.NUMERIC, SORTABLE: true },
    raw_text:   { type: SCHEMA_FIELD_TYPE.TEXT },
    embedding: {
      type:             SCHEMA_FIELD_TYPE.VECTOR,
      TYPE:             dtype,                        
      ALGORITHM:       SCHEMA_VECTOR_FIELD_ALGORITHM.HNSW,
      DISTANCE_METRIC:  'COSINE',
      DIM:              embeddings_dim,
      INITIAL_CAP:      400,
      M:                16,
      EF_CONSTRUCTION:  200,
      EF_RUNTIME:       100
    }
  };

  await client.ft.create(
    indexname,
    schema,
    { ON: 'HASH', PREFIX: `${indexname}:` }
  );

  return {
    status: 'success',
    index:  indexname,
    fields: Object.keys(schema)
  };
});

fastify.post('/rag/create', {
  schema:{
    body: {
      type: 'object',
      required: ['index', 'name_chunk', 'dtype', 'chunk_size', 'raw_text', 'embeddings'],
      properties: {
        index: { type: 'string' },
        name_chunk: { type: 'string' },
        dtype:      { type: 'string', enum: ['FLOAT32','FLOAT16','FLOAT64'] },
        chunk_size: { type: 'number' },
        raw_text: { type: 'string' },
        embeddings: { type: 'array', items: { type: 'number' } }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          key:  { type: 'string' }
        }
      }
    }
  },
  preHandler: fastify.verifyApiKey,

}, async (request, reply) => {
  const { index, name_chunk, dtype, chunk_size, raw_text, embeddings } = request.body;
  const client = fastify.redis;

  let typedArray;

  switch (dtype){
    case 'FLOAT32':
      typedArray = new Float32Array(embeddings);
      break;

    case 'FLOAT16':
      typedArray = new Uint16Array(embeddings);
      break;

    case 'FLOAT64':
      typedArray = new Float64Array(embeddings);
      break;

    default:
      throw new Error(`dtype ${dtype} not supported`);
  }

  const embBytes = Buffer.from(typedArray.buffer);

  const new_id = await client.incr(`${index}:next_id`);

  const key = `${index}:${new_id}`;

  const mapping = {
    name_chunk: name_chunk,
    chunk_id: new_id,
    chunk_size: chunk_size,
    raw_text: raw_text,
    embedding: embBytes
  };

  try{
    await client.hSet(key, mapping);
    return {status: 'ok', 
    key: key};
  }
  catch(error){
    return reply
      .code(500)
      .send({
        error: `Error saving chunk:  '${error}'`
      });
  }
});


fastify.post('/rag/query-rag', {
  schema:{
    body: {
      type: 'object',
      required: ['index', 'embeddings', 'dtype', 'top_k', 'cosine_distance_threshold'],
      properties: {
        index: { type: 'string' },
        embeddings: { type: 'array', items: { type: 'number' } },
        dtype:      { type: 'string', enum: ['FLOAT32','FLOAT16','FLOAT64'] },
        top_k: { type: 'number' },
        cosine_distance_threshold: { type: 'number' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          total:  { type: 'number' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name_chunk: { type: 'string' },
                chunk_id:   { type: 'number' },
                chunk_size: { type: 'number' },
                raw_text:   { type: 'string' },
                score:      { type: 'number' }
              },
              required: ['name_chunk','chunk_id','chunk_size','raw_text','score']
            }
          }
        },
        required: ['status','total','results']
      }
    }
  },
  preHandler: fastify.verifyApiKey,

}, async (request, reply) => {
  const { index, embeddings, dtype, top_k, cosine_distance_threshold } = request.body;
  const client = fastify.redis;

  let typedArray;

  switch (dtype){
    case 'FLOAT32':
      typedArray = new Float32Array(embeddings);
      break;

    case 'FLOAT16':
      typedArray = new Uint16Array(embeddings);
      break;

    case 'FLOAT64':
      typedArray = new Float64Array(embeddings);
      break;

    default:
      throw new Error(`dtype ${dtype} not supported`);
  }

  const embBytes = Buffer.from(typedArray.buffer);

  let similar;
  try {
    similar = await client.ft.search(
      index,                                      
      `*=>[KNN ${top_k} @embedding $vec AS score]`,
      {
        PARAMS: {                                   
          vec: embBytes
        },
        RETURN: [                                  
          'name_chunk',
          'chunk_id',
          'chunk_size',
          'raw_text',
        'score'
        ],
        DIALECT: '2'                               
      });
  }
  catch(error){
    return reply
      .code(500)
      .send({
        error: `Search error:  '${error}'`
      });
  }

  let docs = similar.documents.map(d => ({
    name_chunk: d.value.name_chunk,
    chunk_id:   Number(d.value.chunk_id),
    chunk_size: Number(d.value.chunk_size),
    raw_text:   d.value.raw_text,
    score:      Number(d.value.score)
  }));

  if (cosine_distance_threshold != null) {
    docs = docs.filter(d => d.score <= cosine_distance_threshold);
  }

  docs = docs.slice(0, top_k);

  return reply.code(200).send({
    status:  'ok',
    total:   docs.length,
    results: docs
  });
})

fastify.post('/rag/drop_index', {
  schema:{
    body: {
      type: 'object',
      required: ['index_name', 'delete_docs'],
      properties: {
        index_name: { type: 'string' },
        delete_docs: { type: 'boolean' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          drop_index:  { type: 'string' },
        },
      }
    }
  },
  preHandler: fastify.verifyApiKey,

}, async (request, reply) => {
  const { index_name, delete_docs } = request.body;
  const client = fastify.redis;

  let res;
  try{
    if (delete_docs){
      res = await client.ft.dropIndex(index_name, { DD: true });
    }
    else{
      res = await client.ft.dropIndex(index_name);
    }

    return reply.code(200).send({
      status:  res,
      drop_index:   index_name
    });
  }
  catch(error){
    return reply
      .code(500)
      .send({
        error: `Delete error:  '${error}'`
      });
  }
})

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  } })