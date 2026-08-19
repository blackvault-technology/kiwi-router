import { Pool } from "@neondatabase/serverless";

if (!process.env.NEON_DATABASE_URL) throw new Error("NEON_DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
const statements = [
  `CREATE TABLE IF NOT EXISTS provider_credentials (id serial PRIMARY KEY NOT NULL, provider_id integer NOT NULL REFERENCES providers(id) ON DELETE CASCADE, name varchar(80) NOT NULL, encrypted_api_key text NOT NULL, key_hint varchar(16) NOT NULL, is_active boolean DEFAULT true NOT NULL, last_tested_at timestamptz, last_test_ok boolean, last_test_latency_ms integer, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS provider_health_checks (id bigserial PRIMARY KEY NOT NULL, provider_id integer NOT NULL REFERENCES providers(id) ON DELETE CASCADE, credential_id integer REFERENCES provider_credentials(id) ON DELETE SET NULL, ok boolean NOT NULL, status_code integer, latency_ms integer DEFAULT 0 NOT NULL, detail varchar(160) NOT NULL, created_at timestamptz DEFAULT now() NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS api_key_provider_access (id serial PRIMARY KEY NOT NULL, api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE, provider_id integer NOT NULL REFERENCES providers(id) ON DELETE CASCADE, is_enabled boolean DEFAULT true NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS provider_credentials_provider_name_idx ON provider_credentials(provider_id, name)`,
  `CREATE INDEX IF NOT EXISTS provider_credentials_provider_idx ON provider_credentials(provider_id)`,
  `CREATE INDEX IF NOT EXISTS provider_health_checks_provider_created_idx ON provider_health_checks(provider_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS api_key_provider_access_key_provider_idx ON api_key_provider_access(api_key_id, provider_id)`,
  `CREATE INDEX IF NOT EXISTS api_key_provider_access_provider_idx ON api_key_provider_access(provider_id)`,
];
try {
  for (const statement of statements) await pool.query(statement);
  console.log(JSON.stringify({ ok: true, tables: ["provider_credentials", "provider_health_checks", "api_key_provider_access"] }));
} finally {
  await pool.end();
}
