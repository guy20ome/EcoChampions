import mysql from 'mysql2/promise';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { issueRefreshToken, consumeRefreshToken } from '../auth/tokens.js';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { email, username, password } = parsed.data;
    const passwordHash = await hashPassword(password);
    try {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        'INSERT INTO users (email, username, password_hash) VALUES (:email, :username, :hash)',
        { email, username, hash: passwordHash },
      );
      const userId = result.insertId;
      const accessToken = app.jwt.sign({ sub: userId, email });
      const refreshToken = await issueRefreshToken(userId);
      return reply.code(201).send({ access_token: accessToken, refresh_token: refreshToken, user: { id: userId, email, username } });
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY') {
        return reply.code(409).send({ error: 'Email already registered' });
      }
      throw err;
    }
  });

  app.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input' });
    }
    const { email, password } = parsed.data;
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id, email, username, password_hash FROM users WHERE email = :email LIMIT 1',
      { email },
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const accessToken = app.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = await issueRefreshToken(Number(user.id));
    return reply.send({ access_token: accessToken, refresh_token: refreshToken, user: { id: user.id, email: user.email, username: user.username } });
  });

  app.post('/refresh', async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input' });
    }
    const userId = await consumeRefreshToken(parsed.data.refresh_token);
    if (!userId) {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id, email FROM users WHERE id = :id LIMIT 1',
      { id: userId },
    );
    const user = rows[0];
    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }
    const accessToken = app.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = await issueRefreshToken(Number(user.id));
    return reply.send({ access_token: accessToken, refresh_token: refreshToken });
  });

  app.get('/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT u.id, u.email, u.username, u.opt_out_leaderboard, c.iso_code AS country_iso, c.name AS country_name,
              ci.name AS city_name
         FROM users u
         LEFT JOIN countries c ON c.id = u.country_id
         LEFT JOIN cities ci ON ci.id = u.city_id
        WHERE u.id = :id LIMIT 1`,
      { id: userId },
    );
    const user = rows[0];
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return reply.send({ user });
  });
};

export default authRoutes;
