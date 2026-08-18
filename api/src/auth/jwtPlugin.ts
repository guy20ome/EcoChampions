import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { config } from '../config.js';
import type { AccessTokenPayload } from './tokens.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

export default fp(async (app) => {
  app.register(jwt, {
    secret: config.JWT_ACCESS_SECRET,
    sign: { expiresIn: config.ACCESS_TOKEN_TTL },
  });

  app.decorate('authenticate', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      await reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});
