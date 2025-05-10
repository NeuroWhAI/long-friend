import { env } from '@/env';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types';

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
  }),
});

export const db = new Kysely<Database>({
  dialect,
});
