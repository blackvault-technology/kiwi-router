import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { addCredits } from "./credits";
import { getCreditPack } from "./creditPacks";
import { setStripeCustomerId } from "./db";

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function createCreditCheckout(input: { userId: number; email: string; name: string; packId: string; origin: string }) {
  const pack = getCreditPack(input.packId);
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    client_reference_id: String(input.userId),
    metadata: { user_id: String(input.userId), customer_email: input.email, customer_name: input.name, kiwi_credits: String(pack.credits), pack_id: input.packId },
    line_items: [{ price_data: { currency: "usd", product_data: { name: `${pack.label} Kiwi Credits`, description: `${pack.credits.toLocaleString()} non-expiring Kiwi Credits` }, unit_amount: pack.unitAmount }, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${input.origin}/?checkout=success`,
    cancel_url: `${input.origin}/?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe Checkout did not return a URL");
  return { url: session.url };
}

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const signature = req.header("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).json({ error: "Missing Stripe signature configuration" });
    let event: Stripe.Event;
    try { event = stripeClient().webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET); }
    catch { return res.status(400).json({ error: "Invalid webhook signature" }); }
    if (event.id.startsWith("evt_test_")) return res.json({ verified: true });
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = Number(session.metadata?.user_id ?? session.client_reference_id);
      const credits = Number(session.metadata?.kiwi_credits ?? 0);
      if (userId && credits > 0) {
        await addCredits({ userId, amount: credits, bucket: "purchased", entryType: "purchase", description: `Stripe ${session.metadata?.pack_id ?? "credit"} pack`, stripePaymentIntentId: String(session.payment_intent ?? session.id) });
        if (typeof session.customer === "string") await setStripeCustomerId(userId, session.customer);
      }
    }
    return res.json({ received: true });
  });
}
