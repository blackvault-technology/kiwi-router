import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

describe("Neon configuration", () => {
  it("requires a valid NEON_DATABASE_URL", () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString).toBeTruthy();
    expect(() => new URL(connectionString!)).not.toThrow();
  });

  it.skipIf(process.env.RUN_NEON_NETWORK_TEST !== "1")("connects with NEON_DATABASE_URL when the network smoke test is enabled", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString).toBeTruthy();
    const sql = neon(connectionString!);
    let result: { connected: number }[];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    try {
      result = await sql.query("SELECT 1 AS connected", [], { fetchOptions: { signal: controller.signal } });
    } finally {
      clearTimeout(timeout);
    }

    expect(result).toEqual([{ connected: 1 }]);
  }, 45_000);
});
