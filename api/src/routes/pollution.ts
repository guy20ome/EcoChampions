import mysql from 'mysql2/promise';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { redis, leaderboardKey, combinedLeaderboardKey } from '../redis.js';

const logSchema = z.object({
  indicator_id: z.number().int().positive(),
  log_year: z.number().int().min(2000).max(2100),
  log_month: z.number().int().min(1).max(12),
  value: z.number(),
  note: z.string().max(255).optional(),
});

const pollutionRoutes: FastifyPluginAsync = async (app) => {
  // Upsert a monthly pollution log (one value per indicator/month)
  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = logSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { indicator_id, log_year, log_month, value, note } = parsed.data;
    const userId = req.user.sub;

    const [indicators] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id, lower_is_better FROM pollution_indicators WHERE id = :id LIMIT 1',
      { id: indicator_id },
    );
    const indicator = indicators[0];
    if (!indicator) {
      return reply.code(400).send({ error: 'Unknown indicator' });
    }

    await pool.execute(
      `INSERT INTO pollution_logs (user_id, indicator_id, log_year, log_month, value, note)
       VALUES (:uid, :iid, :y, :m, :v, :n)
       ON DUPLICATE KEY UPDATE value = VALUES(value), note = VALUES(note)`,
      { uid: userId, iid: indicator_id, y: log_year, m: log_month, v: value, n: note ?? null },
    );

    // Rebuild this period's rankings in MariaDB, then mirror to Redis.
    await rebuildRankings(indicator_id, log_year, log_month, Boolean(indicator.lower_is_better));

    // Also rebuild combined rankings for this period and cache in Redis.
    await rebuildAndCacheCombinedRankings(log_year, log_month);

    return reply.code(201).send({ ok: true });
  });

  // List the current user's logs (optionally filtered by year/month)
  app.get('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as { year?: string; month?: string };
    const where: string[] = ['user_id = :uid'];
    const params: Record<string, number> = { uid: req.user.sub };
    if (q.year) {
      where.push('log_year = :y');
      params.y = Number(q.year);
    }
    if (q.month) {
      where.push('log_month = :m');
      params.m = Number(q.month);
    }
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT l.id, l.indicator_id, i.code, i.label, i.unit, l.log_year, l.log_month, l.value, l.note
         FROM pollution_logs l
         JOIN pollution_indicators i ON i.id = l.indicator_id
        WHERE ${where.join(' AND ')}
        ORDER BY l.log_year DESC, l.log_month DESC, l.indicator_id`,
      params,
    );
    return reply.send({ logs: rows });
  });
};

// Recompute ascending ranks for a single indicator/period and push to Redis sorted set.
// Lower-is-better: ascending value => rank 1. Higher-is-better: descending value => rank 1,
// but we store the score as (maxValue - value) so ZRANGE always returns best-first.
export async function rebuildRankings(
  indicatorId: number,
  year: number,
  month: number,
  lowerIsBetter: boolean,
): Promise<void> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT u.id AS user_id, l.value
       FROM pollution_logs l
       JOIN users u ON u.id = l.user_id
      WHERE l.indicator_id = :iid AND l.log_year = :y AND l.log_month = :m
        AND u.opt_out_leaderboard = FALSE
      ORDER BY ${lowerIsBetter ? 'l.value ASC' : 'l.value DESC'}`,
    { iid: indicatorId, y: year, m: month },
  );

  await pool.execute(
    'DELETE FROM rankings WHERE indicator_id = :iid AND log_year = :y AND log_month = :m',
    { iid: indicatorId, y: year, m: month },
  );

  const key = leaderboardKey(indicatorId, year, month);
  await redis.del(key);

  if (rows.length === 0) return;

  // Compute the max value for higher-is-better inversion.
  const maxVal = Math.max(...rows.map((r) => Number(r.value)));

  const rankingRows: Array<[number, number, number]> = [];
  const zAddArgs: Array<[string, number]> = [];
  rows.forEach((row, i) => {
    const userId = Number(row.user_id);
    const value = Number(row.value);
    const rank = i + 1;
    rankingRows.push([userId, rank, value]);
    // Score: lower-is-better => use value (asc); higher-is-better => use (max - value) so best ranks first.
    const score = lowerIsBetter ? value : maxVal - value;
    zAddArgs.push([String(userId), score]);
  });

  const placeholders = rankingRows.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
  const flat = rankingRows.flatMap(([uid, rank, value]) => [uid, indicatorId, year, month, rank, value]);
  await pool.query(
    `INSERT INTO rankings (user_id, indicator_id, log_year, log_month, rank, value) VALUES ${placeholders}`,
    flat,
  );

  // Redis sorted set: score = computed score, member = userId.
  const zAdd = zAddArgs.map(([member, score]) => ({ score, value: member }));
  if (zAdd.length) await redis.zadd(key, ...zAdd.flatMap((z) => [z.score, z.value]));
}

// Calculate combined ranking score for a user/period by summing the 4 indicator values.
// For now this is a simple sum; will be replaced with a realistic weighted formula later.
export async function calculateCombinedScore(
  userId: number,
  year: number,
  month: number,
): Promise<number | null> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT l.value, i.lower_is_better
       FROM pollution_logs l
       JOIN pollution_indicators i ON i.id = l.indicator_id
      WHERE l.user_id = :uid AND l.log_year = :y AND l.log_month = :m`,
    { uid: userId, y: year, m: month },
  );

  // Require all 4 indicator values before ranking a user.
  if (rows.length !== 4) return null;

  // Simple sum of all 4 indicator values (will be refined later).
  // Note: waste_recycled_pct has lower_is_better = false (higher is better),
  // but for the simple sum we just add raw values as requested.
  return rows.reduce((sum, row) => sum + Number(row.value), 0);
}

// Recompute combined rankings for all users in a given period.
// Returns an array of { user_id, combined_score } sorted ascending (best first).
export async function rebuildCombinedRankings(
  year: number,
  month: number,
): Promise<Array<{ user_id: number; combined_score: number }>> {
  // Get all users who have at least one log entry for this period and are not opted out
  const [userRows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT DISTINCT u.id AS user_id
       FROM users u
       JOIN pollution_logs l ON l.user_id = u.id
      WHERE l.log_year = :y AND l.log_month = :m
        AND u.opt_out_leaderboard = FALSE`,
    { y: year, m: month },
  );

  const results: Array<{ user_id: number; combined_score: number }> = [];

  for (const row of userRows) {
    const userId = Number(row.user_id);
    const score = await calculateCombinedScore(userId, year, month);
    if (score !== null) {
      results.push({ user_id: userId, combined_score: score });
    }
  }

  // Sort ascending: lower combined score = better rank
  results.sort((a, b) => a.combined_score - b.combined_score);
  return results;
}

// Rebuild combined rankings and cache in Redis sorted set.
export async function rebuildAndCacheCombinedRankings(
  year: number,
  month: number,
): Promise<void> {
  const results = await rebuildCombinedRankings(year, month);

  const key = combinedLeaderboardKey(year, month);
  await redis.del(key);

  if (results.length === 0) return;

  // Store in Redis sorted set with combined_score as the score
  const zAdd = results.map((r) => ({ score: r.combined_score, value: String(r.user_id) }));
  await redis.zadd(key, ...zAdd.flatMap((z) => [z.score, z.value]));
}

export default pollutionRoutes;
