import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwtPlugin from './auth/jwtPlugin.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import pollutionRoutes from './routes/pollution.js';
import leaderboardsRoutes from './routes/leaderboards.js';
import explanationRoutes from './routes/explanations.js';

export async function buildApp(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(jwtPlugin);

  app.get('/health', async (_req, reply) => reply.send({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(userRoutes, { prefix: '/users' });
  await app.register(pollutionRoutes, { prefix: '/pollution' });
  await app.register(leaderboardsRoutes, { prefix: '/leaderboards' });
  await app.register(explanationRoutes, { prefix: '/explanations' });
}
