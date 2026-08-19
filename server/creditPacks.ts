export const CREDIT_PACKS = {
  sprout: { label: "Sprout", credits: 500, unitAmount: 500 },
  grove: { label: "Grove", credits: 2500, unitAmount: 2000 },
  orchard: { label: "Orchard", credits: 7500, unitAmount: 5000 },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export function getCreditPack(id: string) {
  const pack = CREDIT_PACKS[id as CreditPackId];
  if (!pack) throw new Error("Unknown Kiwi Credit pack");
  return pack;
}
