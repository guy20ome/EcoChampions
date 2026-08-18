import mysql from 'mysql2/promise';
import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db.js';
import { redis, leaderboardKey } from '../redis.js';

const leaderboardsRoutes: FastifyPluginAsync = async (app) => {
  // GET /leaderboards?indicator_id=1&year=2026&month=1&country=FR&limit=50
  // Ascending order (rank 1 = best). Reads from Redis sorted set; falls back to MariaDB.
  app.get('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as { indicator_id?: string; year?: string; month?: string; country?: string; limit?: string };
    const indicatorId = Number(q.indicator_id);
    const year = Number(q.year);
    const month = Number(q.month);
    const limit = Math.min(Number(q.limit) || 50, 200);
    const countryIso = q.country;

    if (!indicatorId || !year || !month) {
      return reply.code(400).send({ error: 'indicator_id, year and month are required' });
    }

    let userIds: number[] = [];
    let ranks: Record<number, number> = {};

    // Try Redis sorted set first (best-first via ascending score).
    const key = leaderboardKey(indicatorId, year, month);
    const exists = await redis.exists(key);
    if (exists) {
      const entries = await redis.zrange(key, 0, limit - 1, 'WITHSCORES');
      for (let i = 0; i < entries.length; i += 2) {
        const uid = Number(entries[i]);
        userIds.push(uid);
        ranks[uid] = Math.floor(i / 2) + 1;
      }
    } else {
      // Fallback to pre-materialized rankings in MariaDB.
      const [rankRows] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT user_id, rank FROM rankings WHERE indicator_id = :iid AND log_year = :y AND log_month = :m ORDER BY rank LIMIT :lim',
        { iid: indicatorId, y: year, m: month, lim: limit },
      );
      for (const r of rankRows) {
        const uid = Number(r.user_id);
        userIds.push(uid);
        ranks[uid] = Number(r.rank);
      }
    }

    if (userIds.length === 0) {
      return reply.send({ leaderboard: [], indicator_id: indicatorId, year, month });
    }

    // Hydrate user + location, optionally filtered by country.
    const placeholders = userIds.map(() => '?').join(',');
    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT u.id, u.username, u.opt_out_leaderboard, c.iso_code AS country_iso, c.name AS country_name, ci.name AS city_name
         FROM users u
         LEFT JOIN countries c ON c.id = u.country_id
         LEFT JOIN cities ci ON ci.id = u.city_id
        WHERE u.id IN (${placeholders})`,
      userIds,
    );

    const byId = new Map(userRows.map((u) => [Number(u.id), u] as const));
    const leaderboard = userIds
      .map((uid) => {
        const u = byId.get(uid);
        if (!u || u.opt_out_leaderboard) return null;
        if (countryIso && u.country_iso !== countryIso) return null;
        return {
          rank: ranks[uid],
          user_id: uid,
          username: u.username,
          country_iso: u.country_iso,
          country_name: u.country_name,
          city_name: u.city_name,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      // Re-number ranks after filtering (e.g., opt-out / country filter).
      .map((r, i) => ({ ...r, rank: i + 1 }));

    return reply.send({ leaderboard, indicator_id: indicatorId, year, month });
  });
};

export default leaderboardsRoutes;
