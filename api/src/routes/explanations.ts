import mysql from 'mysql2/promise';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { redis } from '../redis.js';

const explanationSchema = z.object({
  content: z.string().min(1).max(2000),
  event_type_id: z.number().int().positive(),
  indicator_id: z.number().int().positive().nullable().default(null),
  log_year: z.number().int().min(2000).max(2100),
  log_month: z.number().int().min(1).max(12),
});

const commentSchema = z.object({
  content: z.string().min(1).max(1000),
  parent_comment_id: z.number().int().positive().nullable().default(null),
});

const explanationRoutes: FastifyPluginAsync = async (app) => {
  // POST /explanations - Create an event explanation
  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = explanationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { content, event_type_id, indicator_id, log_year, log_month } = parsed.data;
    const userId = req.user.sub;

    // Verify event type exists
    const [eventRows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM explanation_events WHERE id = :id LIMIT 1',
      { id: event_type_id },
    );
    if (!eventRows.length) {
      return reply.code(400).send({ error: 'Unknown event type' });
    }

    // Verify indicator exists if provided
    if (indicator_id) {
      const [indRows] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT id FROM pollution_indicators WHERE id = :id LIMIT 1',
        { id: indicator_id },
      );
      if (!indRows.length) {
        return reply.code(400).send({ error: 'Unknown indicator' });
      }
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO event_explanations (user_id, event_type_id, indicator_id, log_year, log_month, content)
       VALUES (:uid, :etid, :iid, :y, :m, :c)`,
      { uid: userId, etid: event_type_id, iid: indicator_id, y: log_year, m: log_month, c: content },
    );

    return reply.code(201).send({ ok: true, id: result.insertId });
  });

  // GET /explanations - List explanations for dashboard wall (optionally filtered by user/period)
  app.get('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const q = req.query as {
      user_id?: string;
      event_code?: string;
      year?: string;
      month?: string;
      limit?: string;
      offset?: string;
    };

    const where: string[] = ['e.is_published = TRUE'];
    const params: Record<string, number | string> = {};

    if (q.user_id) {
      where.push('e.user_id = :uid');
      params.uid = Number(q.user_id);
    }
    if (q.event_code) {
      where.push('ev.code = :code');
      params.code = q.event_code;
    }
    if (q.year) {
      where.push('e.log_year = :y');
      params.y = Number(q.year);
    }
    if (q.month) {
      where.push('e.log_month = :m');
      params.m = Number(q.month);
    }

    const limit = Math.min(Number(q.limit) || 50, 200);
    const offset = Number(q.offset) || 0;

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT e.id AS explanation_id, e.user_id, u.username,
              c.iso_code AS country_iso, ci.name AS city_name,
              ev.code AS event_code, ev.label AS event_label,
              e.indicator_id, pi.code AS indicator_code, pi.label AS indicator_label, pi.unit AS indicator_unit,
              e.log_year, e.log_month, e.content, e.created_at,
              COUNT(c.id) AS comment_count
       FROM event_explanations e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN countries c ON c.id = u.country_id
       LEFT JOIN cities ci ON ci.id = u.city_id
       JOIN explanation_events ev ON ev.id = e.event_type_id
       LEFT JOIN pollution_indicators pi ON pi.id = e.indicator_id
       LEFT JOIN explanation_comments c ON c.explanation_id = e.id AND c.parent_comment_id IS NULL
       WHERE ${where.join(' AND ')}
       GROUP BY e.id
       ORDER BY e.created_at DESC
       LIMIT :lim OFFSET :off`,
      { ...params, lim: limit, off: offset },
    );

    return reply.send({
      explanations: rows.map((r) => ({
        explanation_id: Number(r.explanation_id),
        user_id: Number(r.user_id),
        username: r.username,
        country_iso: r.country_iso ?? null,
        city_name: r.city_name ?? null,
        event_code: r.event_code,
        event_label: r.event_label,
        indicator_id: r.indicator_id ? Number(r.indicator_id) : null,
        indicator_code: r.indicator_code ?? null,
        indicator_label: r.indicator_label ?? null,
        indicator_unit: r.indicator_unit ?? null,
        log_year: Number(r.log_year),
        log_month: Number(r.log_month),
        content: r.content,
        created_at: r.created_at,
        comment_count: Number(r.comment_count || 0),
      })),
    });
  });

  // GET /explanations/:id/comments - List comments for an explanation
  app.get('/:explanationId/comments', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { explanationId } = req.params as { explanationId: string };
    const id = Number(explanationId);
    if (!id) {
      return reply.code(400).send({ error: 'Invalid explanation ID' });
    }

    // Fetch all comments (top-level and replies) in a single query
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT c.id, c.explanation_id, c.user_id, u.username,
              c.parent_comment_id, c.content, c.is_flagged, c.created_at, c.updated_at
       FROM explanation_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.explanation_id = :eid
       ORDER BY c.created_at ASC`,
      { eid: id },
    );

    // Build hierarchical structure in memory
    interface CommentNode {
      id: number;
      explanation_id: number;
      user_id: number;
      username: string;
      parent_comment_id: number | null;
      content: string;
      is_flagged: boolean;
      created_at: Date;
      updated_at: Date;
      replies: CommentNode[];
    }

    const commentMap = new Map<number, CommentNode>();
    const topLevelComments: CommentNode[] = [];

    for (const r of rows) {
      const comment: CommentNode = {
        id: Number(r.id),
        explanation_id: Number(r.explanation_id),
        user_id: Number(r.user_id),
        username: r.username,
        parent_comment_id: r.parent_comment_id ? Number(r.parent_comment_id) : null,
        content: r.content,
        is_flagged: Boolean(r.is_flagged),
        created_at: r.created_at,
        updated_at: r.updated_at,
        replies: [],
      };
      commentMap.set(comment.id, comment);
    }

    for (const comment of commentMap.values()) {
      if (comment.parent_comment_id === null) {
        topLevelComments.push(comment);
      } else {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(comment);
        }
      }
    }

    return reply.send({ comments: topLevelComments });
  });

  // POST /explanations/:id/comments - Add a comment (or reply)
  app.post('/:explanationId/comments', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { explanationId } = req.params as { explanationId: string };
    const id = Number(explanationId);
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { content, parent_comment_id } = parsed.data;
    const userId = req.user.sub;

    // Verify explanation exists and is published
    const [expRows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM event_explanations WHERE id = :id LIMIT 1',
      { id },
    );
    if (!expRows.length) {
      return reply.code(404).send({ error: 'Explanation not found' });
    }

    // Verify parent comment if provided
    if (parent_comment_id) {
      const [parentRows] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT id FROM explanation_comments WHERE id = :id AND explanation_id = :eid LIMIT 1',
        { id: parent_comment_id, eid: id },
      );
      if (!parentRows.length) {
        return reply.code(400).send({ error: 'Parent comment not found for this explanation' });
      }
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO explanation_comments (explanation_id, user_id, parent_comment_id, content)
       VALUES (:eid, :uid, :pid, :c)`,
      { eid: explanationId, uid: userId, pid: parent_comment_id ?? null, c: content },
    );

    return reply.code(201).send({ ok: true, id: result.insertId });
  });

  // GET /explanations/pending - Check if current user has a pending explanation (not yet provided)
  app.get('/pending', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const q = req.query as { year?: string; month?: string };

    const year = Number(q.year) || new Date().getFullYear();
    const month = Number(q.month) || new Date().getMonth() + 1;

    // Check if user has logged anything for this period
    const [logRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM pollution_logs WHERE user_id = :uid AND log_year = :y AND log_month = :m`,
      { uid: userId, y: year, m: month },
    );
    const hasLogs = Number(logRows[0].cnt) > 0;

    // Check if user has provided any explanation for this period
    const [explRows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM event_explanations WHERE user_id = :uid AND log_year = :y AND log_month = :m`,
      { uid: userId, y: year, m: month },
    );
    const hasExplanation = Number(explRows[0].cnt) > 0;

    // Pending if user has logs but no explanation for the period
    const pending = hasLogs && !hasExplanation;

    return reply.send({ pending, year, month, has_logs: hasLogs, has_explanation: hasExplanation });
  });

  // GET /explanations/types - List all event types
  app.get('/types', async (_req, reply) => {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id, code, label, description FROM explanation_events ORDER BY code',
    );
    return reply.send({ event_types: rows });
  });
};

export default explanationRoutes;
