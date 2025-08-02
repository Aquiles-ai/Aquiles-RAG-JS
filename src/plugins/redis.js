import { getConnection } from "../connection/connection.js";
import fp from 'fastify-plugin';


export default fp(async function RedisConPl(fastify) {
    const client = await getConnection();
    fastify.decorate('redis', client);
    fastify.addHook('onClose', async (instance, done) => {
    try {
      await client.close();
    } catch (err) {
      fastify.log.error('Error cerrando Redis', err);
    }
    done();
    });
})