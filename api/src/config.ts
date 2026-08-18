import { z } from 'zod';

const envSchema = z.object({
  MARIADB_HOST: z.string().default('db'),
  MARIADB_PORT: z.coerce.number().default(3306),
  MARIADB_DATABASE: z.string().default('ecology_champions'),
  MARIADB_USER: z.string().default('eco'),
  MARIADB_PASSWORD: z.string().default(''),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  API_PORT: z.coerce.number().default(4000),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().default(60 * 60 * 24 * 30),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
