import { describe, expect, it } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  markEmailVerified: vi.fn(),
  promoteFounderRecord: vi.fn(),
}));

vi.mock("./db", () => db);
vi.mock("./auth", () => ({ hashPassword: vi.fn().mockResolvedValue("hash") }));

import { ensureFounderAccount, founderBootstrapConfigured } from "./founderBootstrap";

describe("founder bootstrap configuration", () => {
  beforeEach(() => {
    process.env.FOUNDER_BOOTSTRAP_PASSWORD = "Mypass@2008";
    vi.clearAllMocks();
    db.markEmailVerified.mockResolvedValue({});
    db.promoteFounderRecord.mockResolvedValue({});
  });

  it("makes the supplied founder bootstrap secret available to the server initialization path", () => {
    expect(founderBootstrapConfigured()).toBe(true);
  });

  it("verifies an existing founder account that has not yet completed email verification", async () => {
    db.getUserByEmail.mockResolvedValue({ id: 42, emailVerifiedAt: null });

    await expect(ensureFounderAccount()).resolves.toEqual({ created: false });

    expect(db.promoteFounderRecord).toHaveBeenCalledOnce();
    expect(db.markEmailVerified).toHaveBeenCalledWith(42);
  });

  it("verifies a newly bootstrapped founder account", async () => {
    db.getUserByEmail.mockResolvedValue(undefined);
    db.createUser.mockResolvedValue({ id: 43 });

    await expect(ensureFounderAccount()).resolves.toEqual({ created: true });

    expect(db.markEmailVerified).toHaveBeenCalledWith(43);
  });
});
