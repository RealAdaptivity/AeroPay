/**
 * AeroPay — Stripe Webhook Handler
 * Supabase Edge Function: supabase/functions/stripe-webhook/index.ts
 *
 * Deploy:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *
 * Set secrets:
 *   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
 *   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *
 * Register this URL in Stripe Dashboard → Webhooks:
 *   https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-webhook
 *
 * Events to enable in Stripe:
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.payment_succeeded
 *   invoice.payment_failed
 *   customer.updated
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Environment ──────────────────────────────────────────────
const STRIPE_SECRET_KEY      = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET  = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL           = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// Service-role client bypasses RLS so webhook can write freely
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Handler ──────────────────────────────────────────────────
serve(async (req: Request) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
        return new Response("Missing stripe-signature header", { status: 400 });
    }

    let event: Stripe.Event;
    const body = await req.text();

    try {
        event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error("[webhook] Signature verification failed:", err.message);
        return new Response(`Webhook error: ${err.message}`, { status: 400 });
    }

    console.log(`[webhook] Received: ${event.type}`);

    try {
        switch (event.type) {
            case "customer.subscription.created":
            case "customer.subscription.updated":
                await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
                break;

            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;

            case "invoice.payment_succeeded":
                await handleInvoicePaid(event.data.object as Stripe.Invoice);
                break;

            case "invoice.payment_failed":
                await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                break;

            default:
                console.log(`[webhook] Unhandled event type: ${event.type}`);
        }
    } catch (err) {
        console.error(`[webhook] Error handling ${event.type}:`, err);
        // Return 200 so Stripe doesn't retry endlessly for logic errors.
        // Change to 500 only if you want Stripe to retry.
        return new Response(JSON.stringify({ error: err.message }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});

// ── Helpers ───────────────────────────────────────────────────

/**
 * Upsert subscription record when created or updated.
 * Resolves company_id from stripe_customer_id stored in the subscriptions table
 * or from the customer's metadata (set during Checkout).
 */
async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
    const customerId = sub.customer as string;
    const companyId  = await resolveCompanyId(customerId);

    if (!companyId) {
        console.warn(`[webhook] No company found for Stripe customer ${customerId}`);
        return;
    }

    // Count seats from the per-seat price item quantity
    let seatCount = 1;
    for (const item of sub.items.data) {
        const meta = item.price?.metadata;
        if (meta?.type === "per_seat") {
            seatCount = item.quantity ?? 1;
            break;
        }
    }

    const { error } = await supabase.from("subscriptions").upsert({
        company_id:              companyId,
        stripe_customer_id:      customerId,
        stripe_subscription_id:  sub.id,
        status:                  sub.status,
        seat_count:              seatCount,
        current_period_start:    new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end:      new Date(sub.current_period_end   * 1000).toISOString(),
        cancel_at_period_end:    sub.cancel_at_period_end,
        canceled_at:             sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        trial_end:               sub.trial_end   ? new Date(sub.trial_end   * 1000).toISOString() : null,
    }, { onConflict: "company_id" });

    if (error) throw error;

    console.log(`[webhook] Subscription ${sub.id} → ${sub.status} for company ${companyId}`);
}

/**
 * Mark subscription as canceled when deleted.
 */
async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const { error } = await supabase
        .from("subscriptions")
        .update({
            status:      "canceled",
            canceled_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);

    if (error) throw error;
    console.log(`[webhook] Subscription ${sub.id} canceled.`);
}

/**
 * On successful invoice payment, ensure subscription status is active
 * and log to the audit trail.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
    if (!invoice.subscription) return;

    const { data: subRow } = await supabase
        .from("subscriptions")
        .select("company_id")
        .eq("stripe_subscription_id", invoice.subscription)
        .single();

    if (!subRow) return;

    // Mark active in case it was past_due
    await supabase
        .from("subscriptions")
        .update({ status: "active" })
        .eq("stripe_subscription_id", invoice.subscription as string);

    // Write audit log
    await supabase.from("audit_log").insert({
        company_id:  subRow.company_id,
        actor_label: "Stripe",
        action:      "Invoice Paid",
        details:     `Invoice ${invoice.number} paid — $${((invoice.amount_paid ?? 0) / 100).toFixed(2)}`,
        category:    "settings",
    });

    console.log(`[webhook] Invoice ${invoice.id} paid for company ${subRow.company_id}.`);
}

/**
 * On payment failure, flip subscription to past_due and log it.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    if (!invoice.subscription) return;

    const { data: subRow } = await supabase
        .from("subscriptions")
        .select("company_id")
        .eq("stripe_subscription_id", invoice.subscription)
        .single();

    if (!subRow) return;

    await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("stripe_subscription_id", invoice.subscription as string);

    await supabase.from("audit_log").insert({
        company_id:  subRow.company_id,
        actor_label: "Stripe",
        action:      "Payment Failed",
        details:     `Invoice ${invoice.number} payment failed — $${((invoice.amount_due ?? 0) / 100).toFixed(2)}. Stripe will retry automatically.`,
        category:    "settings",
    });

    console.log(`[webhook] Payment failed for company ${subRow.company_id}.`);
}

/**
 * Resolve company_id from a Stripe customer ID.
 * First checks our subscriptions table, then falls back to
 * customer metadata (set via checkout session metadata).
 */
async function resolveCompanyId(customerId: string): Promise<string | null> {
    // Try existing subscription row
    const { data: existing } = await supabase
        .from("subscriptions")
        .select("company_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

    if (existing?.company_id) return existing.company_id;

    // Try Stripe customer metadata (set during Checkout)
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer) return null;

    const companyId = (customer as Stripe.Customer).metadata?.company_id;
    return companyId ?? null;
}
