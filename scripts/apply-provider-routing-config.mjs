import { Pool } from "@neondatabase/serverless";
if (!process.env.NEON_DATABASE_URL) throw new Error("NEON_DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
try {
  await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS protocol varchar(24) NOT NULL DEFAULT 'openai'`);
  await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS request_headers jsonb NOT NULL DEFAULT '{}'::jsonb`);
  console.log(JSON.stringify({ ok: true, table: "providers", fields: ["protocol", "request_headers"] }));
} finally { await pool.end(); }
