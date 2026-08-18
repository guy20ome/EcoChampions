import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// SHA-256 hash for storing refresh tokens (the raw token is returned to the client).
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
