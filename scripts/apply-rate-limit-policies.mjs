import { Pool } from "@neondatabase/serverless";
if (!process.env.NEON_DATABASE_URL) throw new Error("NEON_DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS rate_limit_policies (id serial PRIMARY KEY, scope varchar(24) NOT NULL, subject varchar(160) NOT NULL, requests_per_minute integer NOT NULL DEFAULT 30, tokens_per_minute integer NOT NULL DEFAULT 10000, is_enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_policies_scope_subject_idx ON rate_limit_policies (scope, subject)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS rate_limit_policies_scope_idx ON rate_limit_policies (scope)`);
  console.log(JSON.stringify({ ok: true, table: "rate_limit_policies" }));
} finally { await pool.end(); }
