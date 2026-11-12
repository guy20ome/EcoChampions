import mysql from 'mysql2/promise';
import { pool } from '../db.js';
import { getSignificantChangeEvent, SIGNIFICANT_CHANGE_PCT } from './domainRules.js';

export { SIGNIFICANT_CHANGE_PCT };

// Returns the previous period's value for a given user/indicator, if any.
export async function getPreviousPeriodValue(
  userId: number,
  indicatorId: number,
  year: number,
  month: number,
): Promise<{ prevYear: number; prevMonth: number; prevValue: number } | null> {
  // Look at the immediately preceding month.
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = year - 1;
  }

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT value FROM pollution_logs
     WHERE user_id = :uid AND indicator_id = :iid AND log_year = :y AND log_month = :m
     LIMIT 1`,
    { uid: userId, iid: indicatorId, y: prevYear, m: prevMonth },
  );

  if (!rows.length) return null;
  return { prevYear, prevMonth: prevMonth, prevValue: Number(rows[0].value) };
}

// Detects whether a newly submitted log triggers an explanation requirement.
// Returns { required: true, event_code } or { required: false, event_code: null }.
//   - first_report: user has never logged any indicator before
//   - significant_increase: indicator value increased >= SIGNIFICANT_CHANGE_PCT vs previous month
//   - significant_decrease: indicator value decreased >= SIGNIFICANT_CHANGE_PCT vs previous month
export async function detectExplanationEvent(
  userId: number,
  indicatorId: number,
  year: number,
  month: number,
): Promise<{ required: boolean; event_code: string | null }> {
  // First report ever for this user (any indicator, any period)
  const [countRows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM pollution_logs WHERE user_id = :uid`,
    { uid: userId },
  );
  const totalLogs = Number(countRows[0].cnt);

  // If this is the user's very first log entry ever, require a first_report explanation.
  if (totalLogs <= 1) {
    return { required: true, event_code: 'first_report' };
  }

  // Check for significant change vs previous month for this indicator.
  const prev = await getPreviousPeriodValue(userId, indicatorId, year, month);
  if (!prev) {
    return { required: false, event_code: null };
  }

  const [indRows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT lower_is_better FROM pollution_indicators WHERE id = :id LIMIT 1`,
    { id: indicatorId },
  );
  const indicator = indRows[0];
  const lowerIsBetter = Boolean(indicator.lower_is_better);

  const [curRows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT value FROM pollution_logs
     WHERE user_id = :uid AND indicator_id = :iid AND log_year = :y AND log_month = :m
     LIMIT 1`,
    { uid: userId, iid: indicatorId, y: year, m: month },
  );
  if (!curRows.length) return { required: false, event_code: null };

  const curValue = Number(curRows[0].value);
  const oldValue = prev.prevValue;

  const eventCode = getSignificantChangeEvent(curValue, oldValue, lowerIsBetter);
  return eventCode
    ? { required: true, event_code: eventCode }
    : { required: false, event_code: null };
}

// Returns the explanation_event id for a given code, inserting the type if missing.
export async function getOrCreateEventTypeId(code: string): Promise<number | null> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT id FROM explanation_events WHERE code = :code LIMIT 1`,
    { code },
  );
  if (rows.length) return Number(rows[0].id);

  const labels: Record<string, string> = {
    first_report: 'First Monthly Report',
    significant_increase: 'Significant Increase',
    significant_decrease: 'Significant Decrease',
  };
  const label = labels[code] || code;
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO explanation_events (code, label, description) VALUES (:code, :label, NULL)`,
    { code, label },
  );
  return Number(result.insertId);
}
