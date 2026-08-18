import Fastify from 'fastify';
import { config } from './config.js';
import { buildApp } from './app.js';
import { assertDbReady } from './db.js';
import { redis } from './redis.js';

async function start(): Promise<void> {
  const app = Fastify({ logger: true });

  try {
    await buildApp(app);

    // Fail fast if dependencies aren't reachable.
    await assertDbReady();
    await redis.ping();

    await app.listen({ host: '0.0.0.0', port: config.API_PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
