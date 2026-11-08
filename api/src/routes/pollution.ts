import mysql from 'mysql2/promise';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { redis, leaderboardKey, combinedLeaderboardKey } from '../redis.js';
import { detectExplanationEvent, getOrCreateEventTypeId } from '../services/explanationEvents.js';

const logSchema = z.object({
  indicator_id: z.number().int().positive(),
  log_year: z.number().int().min(2000).max(2100),
  log_month: z.number().int().min(1).max(12),
  value: z.number(),
  note: z.string().max(255).optional(),
});

const bulkLogSchema = z.object({
  log_year: z.number().int().min(2000).max(2100),
  log_month: z.number().int().min(1).max(12),
  entries: z.array(z.object({
    indicator_id: z.number().int().positive(),
    value: z.number(),
    note: z.string().max(255).optional(),
  })),
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

    // Detect if this triggers an event explanation requirement
    try {
      const { required, event_code } = await detectExplanationEvent(userId, indicator_id, log_year, log_month);
      if (required && event_code) {
        const eventTypeId = await getOrCreateEventTypeId(event_code);
        if (eventTypeId) {
          // Check if an explanation already exists to avoid duplicates
          // (UNIQUE constraint will enforce this at DB level, but we guard here too)
          const [existing] = await pool.execute<mysql.RowDataPacket[]>(
            `SELECT id FROM event_explanations WHERE user_id = :uid AND event_type_id = :etid AND indicator_id = :iid AND log_year = :y AND log_month = :m`,
            { uid: userId, etid: eventTypeId, iid: indicator_id, y: log_year, m: log_month },
          );
          if (!existing.length) {
            // Insert the event explanation (auto-dismissed to dashboard wall)
            await pool.execute(
              `INSERT INTO event_explanations (user_id, event_type_id, indicator_id, log_year, log_month, content)
               VALUES (:uid, :etid, :iid, :y, :m, :c)`,
              { uid: userId, etid: eventTypeId, iid: indicator_id, y: log_year, m: log_month, c: '' },
            );
          }
        }
      }
    } catch (e) {
      // Don't block logging if explanation detection fails
      console.error('Explanation detection error:', e);
    }

    // Rebuild this period's rankings in MariaDB, then mirror to Redis.
    await rebuildRankings(indicator_id, log_year, log_month, Boolean(indicator.lower_is_better));

    // Also rebuild combined rankings for this period and cache in Redis.
    await rebuildAndCacheCombinedRankings(log_year, log_month);

    return reply.code(201).send({ ok: true });
  });

  // Bulk upsert multiple monthly pollution logs for a single period
  app.post('/bulk', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = bulkLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { log_year, log_month, entries } = parsed.data;
    const userId = req.user.sub;

    // Validate all indicator IDs exist
    const indicatorIds = entries.map((e) => e.indicator_id);
    const idPlaceholders = indicatorIds.map(() => '?').join(',');
    const [indicatorRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT id, lower_is_better FROM pollution_indicators WHERE id IN (${idPlaceholders})`,
      indicatorIds,
    );
    const validIndicatorIds = new Set(indicatorRows.map((r) => Number(r.id)));
    const indicatorMap = new Map<number, boolean>();
    for (const row of indicatorRows) {
      indicatorMap.set(Number(row.id), Boolean(row.lower_is_better));
    }

    // Check for invalid indicators
    const invalidEntries = entries.filter((e) => !validIndicatorIds.has(e.indicator_id));
    if (invalidEntries.length > 0) {
      return reply.code(400).send({ error: 'Unknown indicator(s)' });
    }

    // Build the insert query with ON DUPLICATE KEY UPDATE
    const placeholders = entries.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const flat = entries.flatMap((e) => [
      userId,
      e.indicator_id,
      log_year,
      log_month,
      e.value,
      e.note ?? null,
    ]);

    await pool.query(
      `INSERT INTO pollution_logs (user_id, indicator_id, log_year, log_month, value, note)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE value = VALUES(value), note = VALUES(note)`,
      flat,
    );

    // Check for first_report BEFORE inserting - we need to know if this is the user's
    // first log ever for this period. Since we already inserted, we check how many
    // entries were newly created (not updates). If all entries were new and user had
    // no prior logs for this period, the first one triggers first_report.
    const [periodRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM pollution_logs WHERE user_id = :uid AND log_year = :y AND log_month = :m`,
      { uid: userId, y: log_year, m: log_month },
    );
    const logsAfterInsert = Number(periodRows[0].total);
    const hadLogsBefore = logsAfterInsert > entries.length;

    // Detect event explanations for each indicator
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const lowerIsBetter = indicatorMap.get(entry.indicator_id) ?? true;
      await rebuildRankings(entry.indicator_id, log_year, log_month, lowerIsBetter);

      // Also detect event explanations for each entry
      // For first_report: only trigger on the first entry if user had no logs for this period before
      try {
        let { required, event_code } = await detectExplanationEvent(userId, entry.indicator_id, log_year, log_month);

        // Special handling for first_report: only fire on the first NEW entry if user had no prior logs
        if (event_code === 'first_report') {
          required = !hadLogsBefore && i === 0;
        }

        if (required && event_code) {
          const eventTypeId = await getOrCreateEventTypeId(event_code);
          if (eventTypeId) {
            // Check if an explanation already exists for this user/period/event to avoid duplicates
            // (UNIQUE constraint will enforce this at DB level, but we guard here too)
            const [existing] = await pool.execute<mysql.RowDataPacket[]>(
              `SELECT id FROM event_explanations WHERE user_id = :uid AND event_type_id = :etid AND indicator_id = :iid AND log_year = :y AND log_month = :m`,
              { uid: userId, etid: eventTypeId, iid: entry.indicator_id, y: log_year, m: log_month },
            );
            if (!existing.length) {
              await pool.execute(
                `INSERT INTO event_explanations (user_id, event_type_id, indicator_id, log_year, log_month, content)
                 VALUES (:uid, :etid, :iid, :y, :m, :c)`,
                { uid: userId, etid: eventTypeId, iid: entry.indicator_id, y: log_year, m: log_month, c: '' },
              );
            }
          }
        }
      } catch (e) {
        console.error('Explanation detection error:', e);
      }
    }

    // Rebuild combined rankings for this period
    await rebuildAndCacheCombinedRankings(log_year, log_month);

    return reply.code(201).send({ ok: true, count: entries.length });
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

  // GET /pollution/history?page=&limit=&year=&month=
  // Paginated history of all user's periods (10 per page default). Each period
  // is one row: Year, Month, then one value/note column pair per indicator.
  app.get('/history', { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as { page?: string; limit?: string; year?: string; month?: string };
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(Math.max(1, Number(q.limit) || 10), 50);

    const [periods] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT DISTINCT log_year, log_month FROM pollution_logs WHERE user_id = :uid ORDER BY log_year DESC, log_month DESC`,
      { uid: req.user.sub },
    );

    const totalPeriods = periods.length;
    const totalPages = Math.max(1, Math.ceil(totalPeriods / limit));
    const currentPage = Math.min(page, totalPages);
    const pagePeriods = periods.slice((currentPage - 1) * limit, currentPage * limit);

    const results = [];
    for (const period of pagePeriods) {
      const year = Number(period.log_year);
      const month = Number(period.log_month);
      const [logs] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT l.id, l.indicator_id, i.code, i.label, i.unit, l.log_year, l.log_month, l.value, l.note
         FROM pollution_logs l
         JOIN pollution_indicators i ON i.id = l.indicator_id
         WHERE l.user_id = :uid AND l.log_year = :y AND l.log_month = :m
         ORDER BY l.indicator_id`,
        { uid: req.user.sub, y: year, m: month },
      );

      results.push({
        year,
        month,
        logs: logs.map((log) => ({
          id: log.id,
          indicator_id: log.indicator_id,
          code: log.code,
          label: log.label,
          unit: log.unit,
          log_year: log.log_year,
          log_month: log.log_month,
          value: log.value,
          note: log.note,
        })),
      });
    }

    return reply.send({
      periods: results,
      page: currentPage,
      limit,
      totalPages,
      totalPeriods,
    });
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

// Calculate combined ranking score for a user/period.
// For lower_is_better indicators: lower value = better = lower score.
// For higher_is_better indicators (e.g., waste_recycled_pct): higher value = better = lower score.
// We invert the higher_is_better values so the sum rewards improvement in all indicators.
// Requires all 4 indicators logged, otherwise returns null.
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

  // Sum with direction awareness:
  // - lower_is_better: add raw value (lower is better)
  // - higher_is_better (lower_is_better=false): add inverted value so higher raw = lower score
  return rows.reduce((sum, row) => {
    const val = Number(row.value);
    if (Boolean(row.lower_is_better)) {
      return sum + val;
    }
    // Higher_is_better: value >= 0, so invert
    return sum + (200 - val);
  }, 0);
}

// Recompute combined rankings for all users in a given period using a single query.
// We use a subquery approach: join with pollution_logs, compute a weighting for each
// indicator value (inverting lower_is_better), then sum the weights per user.
export async function rebuildCombinedRankings(
  year: number,
  month: number,
): Promise<Array<{ user_id: number; combined_score: number }>> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT u.id AS user_id,
            SUM(
              CASE pi.lower_is_better
                WHEN TRUE THEN v.raw_val
                WHEN FALSE THEN (200 - v.raw_val)  -- higher is better => larger score when raw is small
              END
            ) AS combined_score
       FROM users u
       JOIN pollution_logs l ON l.user_id = u.id AND l.log_year = :y AND l.log_month = :m
       JOIN pollution_indicators pi ON pi.id = l.indicator_id
       JOIN (
         SELECT v.user_id, v.indicator_id, v.raw_val
         FROM (
           SELECT l2.user_id AS user_id, l2.indicator_id AS indicator_id, l2.value AS raw_val
           FROM pollution_logs l2
           WHERE l2.log_year = :y AND l2.log_month = :m
         ) v
       ) v ON v.user_id = u.id AND v.indicator_id = l.indicator_id
      WHERE u.opt_out_leaderboard = FALSE
     GROUP BY u.id
     ORDER BY combined_score ASC`,
    { y: year, m: month },
  );

  // Flatten the result to the expected return type
  const results: Array<{ user_id: number; combined_score: number }> = [];
  for (const row of rows) {
    results.push({ user_id: Number(row.user_id), combined_score: Number(row.combined_score) });
  }
  return results;
}

// Rebuild combined rankings and cache in Redis sorted set.
// Returns the ranked results for use by callers that need the data immediately.
export async function rebuildAndCacheCombinedRankings(
  year: number,
  month: number,
): Promise<Array<{ user_id: number; combined_score: number }>> {
  const results = await rebuildCombinedRankings(year, month);

  const key = combinedLeaderboardKey(year, month);
  await redis.del(key);

  if (results.length === 0) return results;

  // Store in Redis sorted set with combined_score as the score
  const zAdd = results.map((r) => ({ score: r.combined_score, value: String(r.user_id) }));
  await redis.zadd(key, ...zAdd.flatMap((z) => [z.score, z.value]));
  return results;
}

export default pollutionRoutes;
