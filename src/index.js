import Fastify from 'fastify';
import  RedisConPl  from './plugins/redis.js';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import cors from '@fastify/middie';
import { SCHEMA_FIELD_TYPE, SCHEMA_VECTOR_FIELD_ALGORITHM } from 'redis';


const fastify = Fastify({
    logger: true
})

await fastify.register(swagger, {
    openapi: {
        openapi: '3.0.0',
        info: {title: 'Aquiles-RAG-js', version: '0.1.0'}
    }
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
  }
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
  }
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
    await client.hset(key, mapping=mapping);
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



fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  } })