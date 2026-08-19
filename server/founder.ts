export const FOUNDER_EMAIL = "indiasikhotechno@gmail.com";

/** Normalize aliases consistently so one mailbox cannot create parallel accounts. */
export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at).split("+")[0] ?? "";
  return `${local}${email.slice(at)}`;
}

export function isFounderEmail(email: string) {
  return normalizeEmail(email) === FOUNDER_EMAIL;
}

export function getRequestIp(headers: Record<string, string | string[] | undefined>) {
  const forwarded = headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(",")[0]?.trim() || undefined;
}
