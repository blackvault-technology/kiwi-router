import { hashPassword } from "./auth";
import { createUser, getUserByEmail, promoteFounderRecord } from "./db";
import { FOUNDER_EMAIL } from "./founder";

export function founderBootstrapConfigured() {
  return Boolean(process.env.FOUNDER_BOOTSTRAP_PASSWORD && process.env.FOUNDER_BOOTSTRAP_PASSWORD.length >= 10);
}

export async function ensureFounderAccount() {
  if (await getUserByEmail(FOUNDER_EMAIL)) {
    await promoteFounderRecord();
    return { created: false };
  }
  const password = process.env.FOUNDER_BOOTSTRAP_PASSWORD;
  if (!password) {
    console.warn("[Founder] Bootstrap password is not configured; the founder account will be created when the founder registers.");
    return { created: false };
  }
  await createUser({ name: "Kiwi Founder", email: FOUNDER_EMAIL, passwordHash: await hashPassword(password) });
  return { created: true };
}
