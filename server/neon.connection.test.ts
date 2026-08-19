import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

describe("Neon configuration", () => {
  it("connects with NEON_DATABASE_URL", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString).toBeTruthy();

    const sql = neon(connectionString!);
    const result = await sql`SELECT 1 AS connected`;

    expect(result).toEqual([{ connected: 1 }]);
  }, 20_000);
});
