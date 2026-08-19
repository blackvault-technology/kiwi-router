import { describe, expect, it } from "vitest";
import { queryRows } from "./db";

describe("queryRows", () => {
  it("accepts direct SQL arrays used by local database adapters", () => {
    expect(queryRows<{ id: number }>([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it("extracts the rows array returned by Neon HTTP query execution", () => {
    expect(queryRows<{ day: string }>({ rows: [{ day: "Aug 19" }] })).toEqual([{ day: "Aug 19" }]);
  });

  it("returns an empty series for unknown query results rather than breaking dashboard rendering", () => {
    expect(queryRows(undefined)).toEqual([]);
    expect(queryRows({ rows: null })).toEqual([]);
  });
});
