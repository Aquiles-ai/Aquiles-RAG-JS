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
    reply.send({hello: 'world'})
})

fastify.post('/create/index', {
  schema: {
    body: {
      type: 'object',
      required: ['indexname', 'embeddings_dim', 'dtype', 'delete_the_index_if_it_exists'],
      properties: {
        indexname: { type: 'string' },
        embeddings_dim: { type: 'number' },
        dtype: { type: 'string' },
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

fastify.post(
  '/sum',
  {
    schema: {
      description: 'Prueba de suma',
      summary: 'sum',
      tags: ['math'],
      body: {
        type: 'object',
        required: ['a', 'b'],
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        }
      },
      response: {
        200: {
          description: 'Resultado de la suma',
          type: 'object',
          properties: {
            sum: { type: 'number' }
          }
        }
      }
    }
  },
  async (request, reply) => {
    const { a, b } = request.body;
    const sum = a + b;
    return { sum };
  }
);


fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  } })