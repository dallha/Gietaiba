import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Pool configuration using DATABASE_URL strictly from process.env
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('[Neon Pool Error]:', err.message);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

/**
 * Initializes the full relational schema in Neon PostgreSQL if not already present.
 * Uses a single ACID transaction.
 */
export async function initSchema(): Promise<void> {
  const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[Neon] Schema initialized successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Neon] Failed to initialize schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Atomically retrieves the next sequential number for a domain and year using PostgreSQL function.
 */
export async function getNextBusinessSequence(type: string, year: number = 0, client?: pg.PoolClient): Promise<number> {
  const runner = client || pool;
  const res = await runner.query<{ get_next_business_sequence: number }>(
    `SELECT get_next_business_sequence($1, $2) as get_next_business_sequence`,
    [type, year]
  );
  return Number(res.rows[0].get_next_business_sequence);
}

