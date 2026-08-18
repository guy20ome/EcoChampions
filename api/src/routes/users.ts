import mysql from 'mysql2/promise';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';

const profileSchema = z.object({
  country_id: z.number().int().positive().nullable(),
  city_id: z.number().int().positive().nullable(),
  opt_out_leaderboard: z.boolean(),
});

const userRoutes: FastifyPluginAsync = async (app) => {
  // Profile update (country, city, opt-out)
  app.patch('/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { country_id, city_id, opt_out_leaderboard } = parsed.data;
    await pool.execute(
      'UPDATE users SET country_id = :country_id, city_id = :city_id, opt_out_leaderboard = :opt WHERE id = :id',
      { country_id, city_id, opt: opt_out_leaderboard, id: req.user.sub },
    );
    return reply.send({ ok: true });
  });

  // Reference: countries (ISO 3166)
  app.get('/countries', async (_req, reply) => {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id, iso_code, name FROM countries ORDER BY name',
    );
    return reply.send({ countries: rows });
  });

  // Reference: cities for a country
  app.get('/cities', async (req, reply) => {
    const countryId = Number((req.query as { country_id?: string }).country_id);
    if (!countryId) {
      return reply.code(400).send({ error: 'country_id query param required' });
    }
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id, country_id, name FROM cities WHERE country_id = :id ORDER BY name',
      { id: countryId },
    );
    return reply.send({ cities: rows });
  });

  // Reference: pollution indicators (Phase 1 dropdown source)
  app.get('/indicators', async (_req, reply) => {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id, code, label, unit, lower_is_better FROM pollution_indicators ORDER BY id',
    );
    return reply.send({ indicators: rows });
  });
};

export default userRoutes;
