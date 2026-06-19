// api/checkout.js — Crea una sessione di pagamento Stripe
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  mensile: "price_1Tk29WHk95H90gWCTS7GFpPN",
  annuale: "price_1Tk2LAHk95H90gWCLAwHDkpk"
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { piano, userId, email } = req.body || {};
    const priceId = PRICE_IDS[piano];
    if (!priceId) {
      res.status(400).json({ error: "piano non valido" });
      return;
    }
    if (!userId) {
      res.status(400).json({ error: "userId mancante" });
      return;
    }

    const origin = req.headers.origin || "https://fabbrica-favole.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: origin + "/?abbonamento=ok",
      cancel_url: origin + "/?abbonamento=annullato",
      customer_email: email || undefined,
      client_reference_id: userId,
      metadata: { piano, userId }
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: "server", detail: String(err) });
  }
}
