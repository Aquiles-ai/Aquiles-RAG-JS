import { createClient, createCluster } from 'redis';
import { loadAquilesConfig } from '../configs/configs.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function getConnection() {

    const configs = loadAquilesConfig();
    const {
        local = true,
        host = 'localhost',
        port = 6379,
        username = '',
        password = '',
        cluster_mode = false,
        tls_mode = false,
        ssl_certfile = '',
        ssl_keyfile = '',
        ssl_ca_certs = '',
    } = configs;

    const loadCert = (p) => p ? readFileSync(join(process.cwd(), p)) : undefined;

    if (local && cluster_mode){
        const cluster = createCluster({
            rootNodes: [{
                url: `redis://${host}:${port}`,
                username: username || undefined,
                password: password || undefined,
            }],
            defaults: {
                socket: {reconnectStrategy: false},
            },
        });
        cluster.on('error', console.error);
        await cluster.connect();
        return cluster
    }

    if (local){
        const client = createClient({
            socket: {host, port},
            username: username || undefined,
            password: password || undefined,
        });

        client.on('error', console.error);
        await client.connect();
        return client;
    }

    if (tls_mode){
        const client = createClient({
            socket:{
                host,
                port,
                tls: true,
                cert: loadCert(ssl_certfile),
                key: loadCert(ssl_keyfile),
                ca: loadCert(ssl_ca_certs),
            },
            username: username || undefined,
            password: password || undefined,
        });

        client.on('error', console.error);
        await client.connect();
        return client;
    }

    const client = createClient({
        socket: {host, port},
        username: username || undefined,
        password: password || undefined,
    });
    client.on('error', console.error);
    await client.connect();
    return client;
}

