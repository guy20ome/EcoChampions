import IORedis from 'ioredis';
import { config } from './config.js';

export const redis = new IORedis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

// Leaderboard sorted-set key for a given indicator + period.
export function leaderboardKey(indicatorId: number, year: number, month: number): string {
  return `lb:${indicatorId}:${year}-${String(month).padStart(2, '0')}`;
}
