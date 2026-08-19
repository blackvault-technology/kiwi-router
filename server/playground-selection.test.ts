import { describe, expect, it } from "vitest";
import { playgroundSessionKeyId, rememberPlaygroundKey, selectPlaygroundKey } from "../client/src/lib/playground";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("Playground API-key selection", () => {
  it("uses a raw key only when the same browser session previously created it", () => {
    const storage = createStorage();
    const id = "5fa5e37a-ef1a-4e61-8d6d-2d3c28dc840a";

    expect(selectPlaygroundKey(storage, id)).toBeNull();
    rememberPlaygroundKey(storage, id, "kiwi_sk_current_browser_only");
    expect(playgroundSessionKeyId(id)).toBe("kiwi-playground-key:5fa5e37a-ef1a-4e61-8d6d-2d3c28dc840a");
    expect(selectPlaygroundKey(storage, id)).toBe("kiwi_sk_current_browser_only");
  });
});
