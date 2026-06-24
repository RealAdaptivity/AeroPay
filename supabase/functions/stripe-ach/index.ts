/**
 * AeroPay — Stripe ACH Edge Function
 * supabase/functions/stripe-ach/index.ts
 *
 * Deploy:
 *   supabase functions deploy stripe-ach
 *
 * Actions:
 *   setup_intent   — Create a SetupIntent so the frontend can collect an employee's
 *                    bank account via Stripe.js (us_bank_account payment method).
 *   confirm_setup  — Attach the confirmed PaymentMethod to an employee record.
 *   disburse       — Kick off OutboundTransfers (Stripe Treasury) for every employee
 *                    in a payroll run.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe   = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return ok();

    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body   = await req.json();
    const action = body.action as string;

    try {
        switch (action) {
            case "setup_intent":  return await handleSetupIntent(user.id, body);
            case "confirm_setup": return await handleConfirmSetup(user.id, body);
            case "disburse":      return await handleDisburse(user.id, body);
            default:              return json({ error: `Unknown action: ${action}` }, 400);
        }
    } catch (err) {
        console.error(`[stripe-ach] ${action}:`, err);
        return json({ error: err.message }, 500);
    }
});

// ── Setup Intent ───────────────────────────────────────────────────────────────
// Creates a SetupIntent so the frontend can securely collect an employee's bank
// account via Stripe.js without routing/account numbers touching our servers.
async function handleSetupIntent(userId: string, body: { employeeId: string }) {
    const company = await getCompany(userId);

    // Resolve or create a Stripe customer to anchor the payment method
    const stripeCustomerId = await ensureStripeCustomer(company);

    const intent = await stripe.setupIntents.create({
        customer:             stripeCustomerId,
        payment_method_types: ["us_bank_account"],
        payment_method_options: {
            us_bank_account: {
                financial_connections: { permissions: ["payment_method"] },
                verification_method: "instant",
            },
        },
        metadata: {
            company_id:  company.id,
            employee_id: body.employeeId,
        },
    });

    return json({ client_secret: intent.client_secret });
}

// ── Confirm Setup ──────────────────────────────────────────────────────────────
// After Stripe.js confirms the SetupIntent, the frontend calls here so we can
// store the PaymentMethod ID and last-4 on the employee record.
async function handleConfirmSetup(userId: string, body: {
    employeeId:      string;
    paymentMethodId: string;
}) {
    await getCompany(userId); // auth check

    const pm = await stripe.paymentMethods.retrieve(body.paymentMethodId);
    const last4   = (pm as any).us_bank_account?.last4 ?? "";
    const routing = (pm as any).us_bank_account?.routing_number ?? "";

    const { error } = await supabase.from("employees").update({
        stripe_pm_id:       body.paymentMethodId,
        bank_account_last4: last4,
        bank_routing:       routing,
    }).eq("id", body.employeeId);

    if (error) throw error;

    return json({ ok: true, last4, routing });
}

// ── Disburse ──────────────────────────────────────────────────────────────────
// Creates an ach_transfer record for each employee in the run and initiates
// an OutboundTransfer via Stripe Treasury (requires Treasury to be enabled).
// Falls back to "processing" status (manual ACH) if Treasury is not enabled.
async function handleDisburse(userId: string, body: {
    payrollRunId:   string;
    disbursements:  Array<{ employeeId: string; netPayCents: number }>;
}) {
    const company = await getCompany(userId);
    const financialAccountId = company.stripe_financial_account_id as string | undefined;

    const results: Array<{ employeeId: string; status: string; transferId?: string }> = [];

    for (const d of body.disbursements) {
        if (d.netPayCents <= 0) continue;

        // Fetch employee's Stripe payment method
        const { data: emp } = await supabase
            .from("employees")
            .select("stripe_pm_id, bank_account_last4, name")
            .eq("id", d.employeeId)
            .single();

        let stripeTransferId: string | undefined;
        let status = "processing";

        if (emp?.stripe_pm_id && financialAccountId) {
            try {
                const transfer = await stripe.treasury.outboundTransfers.create({
                    financial_account: financialAccountId,
                    amount:            d.netPayCents,
                    currency:          "usd",
                    destination_payment_method: emp.stripe_pm_id,
                    description:       `AeroPay payroll — run ${body.payrollRunId}`,
                    metadata: {
                        company_id:     company.id,
                        employee_id:    d.employeeId,
                        payroll_run_id: body.payrollRunId,
                    },
                });
                stripeTransferId = transfer.id;
                status = "processing";
            } catch (treasuryErr) {
                console.warn(`[stripe-ach] Treasury transfer failed for ${d.employeeId}:`, treasuryErr.message);
                // Fall through with status = "processing" (manual ACH fallback)
            }
        }

        // Persist transfer record
        const { error: insertErr } = await supabase.from("ach_transfers").insert({
            company_id:        company.id,
            payroll_run_id:    body.payrollRunId,
            employee_id:       d.employeeId,
            stripe_transfer_id: stripeTransferId ?? null,
            amount_cents:      d.netPayCents,
            status,
        });

        if (insertErr) console.error("[stripe-ach] insert ach_transfers:", insertErr.message);

        results.push({ employeeId: d.employeeId, status, transferId: stripeTransferId });
    }

    return json({ results });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCompany(userId: string) {
    const { data, error } = await supabase
        .from("company_users")
        .select("company_id, companies(*)")
        .eq("user_id", userId)
        .single();

    if (error || !data) throw new Error("Company not found for user");
    return { id: data.company_id, ...(data.companies as Record<string, unknown>) };
}

async function ensureStripeCustomer(company: Record<string, unknown>): Promise<string> {
    const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("company_id", company.id)
        .maybeSingle();

    if (sub?.stripe_customer_id) return sub.stripe_customer_id as string;

    const customer = await stripe.customers.create({
        name:     company.name as string,
        metadata: { company_id: company.id as string },
    });
    return customer.id;
}

function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}

function ok() {
    return new Response("ok", { headers: CORS });
}
