/**
 * AeroPay — Stripe Customer Portal Edge Function
 * supabase/functions/stripe-portal/index.ts
 *
 * Deploy:
 *   supabase functions deploy stripe-portal
 *
 * Opens the Stripe-hosted Customer Portal for the authenticated company.
 * Customers can update payment methods, view invoices, and cancel.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe   = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { returnUrl } = await req.json();

    try {
        // Resolve company for this user
        const { data: companyUser } = await supabase
            .from("company_users")
            .select("company_id")
            .eq("user_id", user.id)
            .single();

        if (!companyUser) return json({ error: "Company not found" }, 404);

        // Get Stripe customer ID from subscription table
        const { data: sub } = await supabase
            .from("subscriptions")
            .select("stripe_customer_id")
            .eq("company_id", companyUser.company_id)
            .maybeSingle();

        if (!sub?.stripe_customer_id) {
            return json({ error: "No Stripe customer found. Please subscribe first." }, 404);
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer:   sub.stripe_customer_id,
            return_url: returnUrl || "https://ojvnxnlrghatkwjrlnop.supabase.co",
        });

        return json({ url: portalSession.url });
    } catch (err) {
        console.error("[stripe-portal]", err);
        return json({ error: err.message }, 500);
    }
});

function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}
