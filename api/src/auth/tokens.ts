import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { config } from '../config.js';
import { pool } from '../db.js';
import { hashToken } from './password.js';

export interface AccessTokenPayload {
  sub: number;
  email: string;
}

export function signAccessTokenPayload(userId: number, email: string): AccessTokenPayload {
  return { sub: userId, email };
}

export const ACCESS_TOKEN_TTL = config.ACCESS_TOKEN_TTL;

export async function issueRefreshToken(userId: number): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL * 1000);
  await pool.execute(
    'INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (:uid, :hash, :exp)',
    { uid: userId, hash: tokenHash, exp: expiresAt },
  );
  return raw;
}

export async function consumeRefreshToken(raw: string): Promise<number | null> {
  const tokenHash = hashToken(raw);
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    'SELECT id, user_id, expires_at, revoked_at FROM auth_tokens WHERE token_hash = :hash LIMIT 1',
    { hash: tokenHash },
  );
  const row = rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }
  await pool.execute('UPDATE auth_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = :id', {
    id: row.id,
  });
  return Number(row.user_id);
}
