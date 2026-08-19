import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { creditLedger, models, users } from "../drizzle/schema";
import { getDb } from "./db";

export type CreditBucket = "stipend" | "purchased";
export type CreditEntryType = "grant" | "airdrop" | "purchase" | "spend" | "expiry";

const number = (value: unknown) => Number(value ?? 0);

export function balanceOf(user: { stipendCredits: string; purchasedCredits: string }) {
  return number(user.stipendCredits) + number(user.purchasedCredits);
}

export function creditsForTokens(creditCostPer1kTokens: number, inputTokens: number, outputTokens: number) {
  return Math.ceil(((Math.max(0, inputTokens) + Math.max(0, outputTokens)) / 1000) * Math.max(0, creditCostPer1kTokens));
}

export async function creditSummary(userId: number) {
  const user = (await getDb().select({ stipendCredits: users.stipendCredits, purchasedCredits: users.purchasedCredits }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) throw new Error("User not found");
  return { stipend: number(user.stipendCredits), purchased: number(user.purchasedCredits), total: balanceOf(user) };
}

export async function addCredits(input: { userId: number; amount: number; bucket: CreditBucket; entryType: Exclude<CreditEntryType, "spend" | "expiry">; description: string; expiresAt?: Date; stripePaymentIntentId?: string }) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Credit amount must be positive");
  const db = getDb();
  if (input.stripePaymentIntentId) {
    const alreadyFulfilled = (await db.select({ id: creditLedger.id }).from(creditLedger).where(eq(creditLedger.stripePaymentIntentId, input.stripePaymentIntentId)).limit(1))[0];
    if (alreadyFulfilled) return creditSummary(input.userId);
  }
  const column = input.bucket === "stipend" ? users.stipendCredits : users.purchasedCredits;
  await db.update(users).set({ [input.bucket === "stipend" ? "stipendCredits" : "purchasedCredits"]: sql`${column} + ${input.amount}`, updatedAt: new Date() }).where(eq(users.id, input.userId));
  await db.insert(creditLedger).values({ ...input, amount: input.amount.toFixed(3) });
  return creditSummary(input.userId);
}

export async function quoteCredits(modelSlug: string, inputTokens: number, outputTokens: number) {
  const model = (await getDb().select({ creditCost: models.creditCostPer1kTokens }).from(models).where(eq(models.slug, modelSlug)).limit(1))[0];
  if (!model) return 0;
  return creditsForTokens(number(model.creditCost), inputTokens, outputTokens);
}

export async function canSpendCredits(user: { id: number; role: string; stipendCredits: string; purchasedCredits: string }, modelSlug: string, reserveTokens: number) {
  if (user.role === "founder") return { allowed: true, required: 0, balance: balanceOf(user) };
  const required = await quoteCredits(modelSlug, reserveTokens, 0);
  return { allowed: balanceOf(user) >= required, required, balance: balanceOf(user) };
}

export async function spendCredits(userId: number, modelSlug: string, inputTokens: number, outputTokens: number, description: string) {
  const db = getDb();
  const user = (await db.select({ role: users.role, stipendCredits: users.stipendCredits, purchasedCredits: users.purchasedCredits }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user || user.role === "founder") return 0;
  const amount = await quoteCredits(modelSlug, inputTokens, outputTokens);
  if (amount <= 0) return 0;
  let remaining = amount;
  const stipendUsed = Math.min(number(user.stipendCredits), remaining);
  if (stipendUsed) {
    await db.update(users).set({ stipendCredits: sql`GREATEST(${users.stipendCredits} - ${stipendUsed}, 0)`, updatedAt: new Date() }).where(eq(users.id, userId));
    await db.insert(creditLedger).values({ userId, amount: (-stipendUsed).toFixed(3), entryType: "spend", bucket: "stipend", description });
    remaining -= stipendUsed;
  }
  if (remaining > 0) {
    await db.update(users).set({ purchasedCredits: sql`GREATEST(${users.purchasedCredits} - ${remaining}, 0)`, updatedAt: new Date() }).where(eq(users.id, userId));
    await db.insert(creditLedger).values({ userId, amount: (-remaining).toFixed(3), entryType: "spend", bucket: "purchased", description });
  }
  return amount;
}

export async function dailyCreditMaintenance(now = new Date()) {
  const db = getDb();
  const expiredStipends = await db.select({ id: creditLedger.id, userId: creditLedger.userId, amount: creditLedger.amount }).from(creditLedger)
    .where(and(eq(creditLedger.bucket, "stipend"), isNull(creditLedger.expiredAt), lt(creditLedger.expiresAt, now)));
  let expired = 0;
  for (const stipend of expiredStipends) {
    const amount = number(stipend.amount);
    if (amount > 0) {
      await db.update(users).set({ stipendCredits: sql`GREATEST(${users.stipendCredits} - ${amount}, 0)`, updatedAt: now }).where(eq(users.id, stipend.userId));
      await db.update(creditLedger).set({ expiredAt: now }).where(eq(creditLedger.id, stipend.id));
      await db.insert(creditLedger).values({ userId: stipend.userId, amount: (-amount).toFixed(3), entryType: "expiry", bucket: "stipend", description: "Expired daily Kiwi Credit stipend", expiredAt: now });
      expired += 1;
    }
  }
  const recipients = await db.select({ id: users.id, stipendCredits: users.stipendCredits, purchasedCredits: users.purchasedCredits, role: users.role }).from(users);
  let granted = 0;
  for (const user of recipients) {
    if (user.role === "founder" || balanceOf(user) >= 100) continue;
    const description = `Daily Kiwi Credit stipend ${now.toISOString().slice(0, 10)}`;
    const alreadyGranted = (await db.select({ id: creditLedger.id }).from(creditLedger).where(and(eq(creditLedger.userId, user.id), eq(creditLedger.description, description))).limit(1))[0];
    if (alreadyGranted) continue;
    await addCredits({ userId: user.id, amount: 50, bucket: "stipend", entryType: "grant", description, expiresAt: new Date(now.getTime() + 86_400_000) });
    granted += 1;
  }
  return { expired, granted };
}

export async function listCreditLedger(userId: number) {
  return getDb().select().from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.createdAt)).limit(1000);
}
