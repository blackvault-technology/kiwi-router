import { Pool } from "@neondatabase/serverless";
if (!process.env.NEON_DATABASE_URL) throw new Error("NEON_DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
try {
  await pool.query('ALTER TABLE "provider_credentials" ADD COLUMN IF NOT EXISTS "last_success_at" timestamptz');
  console.log(JSON.stringify({ ok: true, column: "provider_credentials.last_success_at" }));
} finally {
  await pool.end();
}
