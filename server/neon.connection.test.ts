import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

describe("Neon configuration", () => {
  it("connects with NEON_DATABASE_URL", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString).toBeTruthy();

    const sql = neon(connectionString!);
    let lastError: unknown;
    let result: { connected: number }[] | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await sql`SELECT 1 AS connected`;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    if (!result) throw lastError;

    expect(result).toEqual([{ connected: 1 }]);
  }, 30_000);
});
