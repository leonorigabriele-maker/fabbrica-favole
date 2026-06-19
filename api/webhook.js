// api/webhook.js — Riceve gli eventi Stripe e aggiorna Supabase
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const config = { api: { bodyParser: false } };

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let event;
  try {
    const buf = await buffer(req);
    const sig = req.headers["stripe-signature"];
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(buf.toString());
    }
  } catch (err) {
    res.status(400).json({ error: "Webhook signature error", detail: String(err) });
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.client_reference_id || (session.metadata && session.metadata.userId);
      const piano = session.metadata && session.metadata.piano;
      const customerId = session.customer;

      if (userId) {
        const scadenza = new Date();
        if (piano === "annuale") scadenza.setFullYear(scadenza.getFullYear() + 1);
        else scadenza.setMonth(scadenza.getMonth() + 1);

        await sb.from("abbonamenti").upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          piano: piano || "mensile",
          attivo: true,
          scadenza: scadenza.toISOString()
        }, { onConflict: "user_id" });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      await sb.from("abbonamenti").update({ attivo: false }).eq("stripe_customer_id", sub.customer);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(500).json({ error: "server", detail: String(err) });
  }
}
