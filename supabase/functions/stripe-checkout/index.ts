/**
 * AeroPay — Stripe Checkout Edge Function
 * supabase/functions/stripe-checkout/index.ts
 *
 * Deploy:
 *   supabase functions deploy stripe-checkout
 *
 * Handles two actions:
 *   1. default — create a new Checkout Session (new subscription)
 *   2. update_seats — update quantity on an existing subscription
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe    = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const supabase  = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    // Authenticate caller via Supabase JWT
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action = "checkout" } = body;

    try {
        if (action === "update_seats") {
            return await handleUpdateSeats(user.id, body);
        }
        return await handleCheckout(user.id, body);
    } catch (err) {
        console.error("[stripe-checkout]", err);
        return json({ error: err.message }, 500);
    }
});

// ── Create Checkout Session ────────────────────────────────────
async function handleCheckout(userId: string, body: any) {
    const { companyId, companyName, employeeCount, priceBaseId, priceSeatId, successUrl, cancelUrl } = body;

    // Look up or create Stripe customer for this company
    let stripeCustomerId: string | undefined;

    const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("company_id", companyId)
        .maybeSingle();

    if (existingSub?.stripe_customer_id) {
        stripeCustomerId = existingSub.stripe_customer_id;
    } else {
        // Get user email from auth
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        const customer = await stripe.customers.create({
            email:    user?.email,
            name:     companyName,
            metadata: { company_id: companyId, user_id: userId },
        });
        stripeCustomerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
        customer:   stripeCustomerId,
        mode:       "subscription",
        line_items: [
            {
                price:    priceBaseId,
                quantity: 1,
            },
            {
                price:    priceSeatId,
                quantity: Math.max(1, employeeCount),
            },
        ],
        subscription_data: {
            metadata: { company_id: companyId },
        },
        allow_promotion_codes: true,
        billing_address_collection: "required",
        success_url: successUrl,
        cancel_url:  cancelUrl,
    });

    return json({ url: session.url });
}

// ── Update Seat Count on Existing Subscription ─────────────────
async function handleUpdateSeats(userId: string, body: any) {
    const { employeeCount } = body;

    // Find the company for this user
    const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", userId)
        .single();

    if (!companyUser) return json({ error: "Company not found" }, 404);

    const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("company_id", companyUser.company_id)
        .eq("status", "active")
        .maybeSingle();

    if (!sub?.stripe_subscription_id) {
        // No active sub — nothing to update
        return json({ updated: false });
    }

    // Find the per-seat item on the subscription
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const seatItem  = stripeSub.items.data.find(
        (item) => item.price?.metadata?.type === "per_seat"
    );

    if (!seatItem) return json({ updated: false });

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ id: seatItem.id, quantity: Math.max(1, employeeCount) }],
        proration_behavior: "create_prorations",
    });

    return json({ updated: true });
}

function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}
