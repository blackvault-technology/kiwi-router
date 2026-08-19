import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const email = readFileSync(new URL("./email.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

 describe("Neon email outbox contract", () => {
  it("stores queued auth messages in a Neon table with lifecycle metadata", () => {
    expect(schema).toContain('pgEnum("email_outbox_status", ["pending", "claimed", "sent", "failed"])');
    expect(schema).toContain('pgTable("email_outbox"');
    expect(schema).toContain('bodyHtml: text("body_html")');
    expect(schema).toContain('availableAt: timestamp("available_at"');
  });

  it("creates outbox rows through the Neon database service", () => {
    expect(db).toContain("export async function createEmailOutbox");
    expect(db).toContain("getDb().insert(emailOutbox)");
    expect(email).toContain("createEmailOutbox(input)");
    expect(email).not.toContain("api.resend.com");
  });

  it("keeps verification and reset links single-use and routed through the outbox", () => {
    expect(router).toContain('purpose: "email_verify"');
    expect(router).toContain('purpose: "password_reset"');
    expect(router).toContain("sendVerificationEmail(ctx.req, user.id");
    expect(router).toContain("sendPasswordResetEmail(ctx.req, user.id");
    expect(router).toContain("consumeAuthToken");
  });
});
