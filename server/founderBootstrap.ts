import { hashPassword } from "./auth";
import { createUser, getUserByEmail, markEmailVerified, promoteFounderRecord } from "./db";
import { FOUNDER_EMAIL } from "./founder";

export function founderBootstrapConfigured() {
  return Boolean(process.env.FOUNDER_BOOTSTRAP_PASSWORD && process.env.FOUNDER_BOOTSTRAP_PASSWORD.length >= 10);
}

export async function ensureFounderAccount() {
  const existing = await getUserByEmail(FOUNDER_EMAIL);
  if (existing) {
    await promoteFounderRecord();
    if (!existing.emailVerifiedAt) await markEmailVerified(existing.id);
    return { created: false };
  }
  const password = process.env.FOUNDER_BOOTSTRAP_PASSWORD;
  if (!password) {
    console.warn("[Founder] Bootstrap password is not configured; the founder account will be created when the founder registers.");
    return { created: false };
  }
  const founder = await createUser({ name: "Kiwi Founder", email: FOUNDER_EMAIL, passwordHash: await hashPassword(password) });
  await markEmailVerified(founder.id);
  return { created: true };
}
