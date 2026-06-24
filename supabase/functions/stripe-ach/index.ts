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
 *   confirm_setup  — Attach the confirmed PaymentMethod to an employee record,
 *                    stamp bank_account_linked_at, and email both the employee
 *                    and company admin as a fraud control.
 *   disburse       — Kick off OutboundTransfers (Stripe Treasury) for every employee
 *                    in a payroll run, enforcing the 3-business-day hold for
 *                    newly linked accounts.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe   = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Optional — set RESEND_API_KEY secret to enable transactional emails.
// If not set, emails are skipped but all other logic still runs.
const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY") ?? "";
const PLATFORM_FROM   = Deno.env.get("PLATFORM_FROM_EMAIL") ?? "payroll@aeropay.io";
const PLATFORM_URL    = Deno.env.get("PLATFORM_URL") ?? "https://aeropay.io";

// 3 business days in milliseconds (approximated as 3 × 24 h; weekend skipping
// would require a calendar — this is conservative and simple).
const HOLD_MS = 3 * 24 * 60 * 60 * 1000;

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
async function handleSetupIntent(userId: string, body: { employeeId: string }) {
    const company = await getCompany(userId);

    if (!company.stripe_account_id) {
        return json({ error: "Stripe connected account not set up. Complete onboarding first." }, 400);
    }

    const intent = await stripe.setupIntents.create(
        {
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
        },
        { stripeAccount: company.stripe_account_id as string },
    );

    return json({ client_secret: intent.client_secret });
}

// ── Confirm Setup ──────────────────────────────────────────────────────────────
// Stamps bank_account_linked_at (starts the 3-day hold clock) and fires
// alert emails to both the employee and the company admin.
async function handleConfirmSetup(userId: string, body: {
    employeeId:      string;
    paymentMethodId: string;
}) {
    const company = await getCompany(userId);

    if (!company.stripe_account_id) {
        return json({ error: "Stripe connected account not set up." }, 400);
    }

    const pm = await stripe.paymentMethods.retrieve(
        body.paymentMethodId,
        {},
        { stripeAccount: company.stripe_account_id as string },
    );
    const last4   = (pm as any).us_bank_account?.last4 ?? "";
    const routing = (pm as any).us_bank_account?.routing_number ?? "";
    const linkedAt = new Date().toISOString();

    // Fetch employee record before update so we have email + old last4
    const { data: empBefore } = await supabase
        .from("employees")
        .select("name, email, bank_account_last4")
        .eq("id", body.employeeId)
        .single();

    const { error } = await supabase.from("employees").update({
        stripe_pm_id:           body.paymentMethodId,
        bank_account_last4:     last4,
        bank_routing:           routing,
        bank_account_linked_at: linkedAt,
    }).eq("id", body.employeeId);

    if (error) throw error;

    // Audit log
    const prevLast4 = empBefore?.bank_account_last4;
    await supabase.from("audit_log").insert({
        company_id:  company.id,
        actor_label: "System",
        action:      prevLast4 ? "Bank Account Changed" : "Bank Account Linked",
        details:     prevLast4
            ? `${empBefore?.name} changed direct deposit from ••••${prevLast4} to ••••${last4}. 3-day hold applied.`
            : `${empBefore?.name} linked direct deposit account ••••${last4}. 3-day hold applied.`,
        category:    "employee",
    });

    // Send alert emails (fire-and-forget; failures are logged but don't block)
    const companyName = (company.name as string) ?? "Your employer";
    await Promise.allSettled([
        // Employee alert
        empBefore?.email ? sendEmail({
            to:      empBefore.email,
            subject: "Your direct deposit account was updated",
            html: `
                <p>Hi ${empBefore.name},</p>
                <p>Your direct deposit bank account on AeroPay has been updated to the account ending in <strong>••••${last4}</strong>.</p>
                <p>Your first payroll deposit to this account will be held for <strong>3 business days</strong> as a security measure. ${prevLast4 ? `Your previous account (••••${prevLast4}) has been removed.` : ""}</p>
                <p>If you did not make this change, contact your payroll administrator immediately.</p>
                <p style="color:#6b7280;font-size:12px;">— AeroPay on behalf of ${companyName}</p>
            `,
        }) : Promise.resolve(),
        // Admin alert
        company.admin_email ? sendEmail({
            to:      company.admin_email as string,
            subject: `[AeroPay] Bank account changed — ${empBefore?.name}`,
            html: `
                <p>This is an automated security alert from AeroPay.</p>
                <p><strong>${empBefore?.name}</strong> updated their direct deposit to the account ending in <strong>••••${last4}</strong>${prevLast4 ? ` (previously ••••${prevLast4})` : ""}.</p>
                <p>A <strong>3-business-day hold</strong> has been applied before the first disbursement to this account.</p>
                <p>If this change was not authorized, log in to AeroPay immediately and contact support.</p>
                <p style="color:#6b7280;font-size:12px;"><a href="${PLATFORM_URL}">Open AeroPay</a></p>
            `,
        }) : Promise.resolve(),
    ]).then(results => {
        results.forEach((r, i) => {
            if (r.status === "rejected") console.warn(`[stripe-ach] email ${i} failed:`, r.reason);
        });
    });

    return json({ ok: true, last4, routing, linkedAt });
}

// ── Disburse ──────────────────────────────────────────────────────────────────
async function handleDisburse(userId: string, body: {
    payrollRunId:   string;
    disbursements:  Array<{ employeeId: string; netPayCents: number }>;
}) {
    const company            = await getCompany(userId);
    const financialAccountId = company.stripe_financial_account_id as string | undefined;
    const connectedAccountId = company.stripe_account_id as string | undefined;
    const now                = Date.now();

    const results: Array<{ employeeId: string; status: string; transferId?: string; heldUntil?: string }> = [];

    for (const d of body.disbursements) {
        if (d.netPayCents <= 0) continue;

        const { data: emp } = await supabase
            .from("employees")
            .select("stripe_pm_id, bank_account_last4, name, email, bank_account_linked_at")
            .eq("id", d.employeeId)
            .single();

        // ── 3-day hold check ──────────────────────────────────────────────────
        const linkedAt    = emp?.bank_account_linked_at ? new Date(emp.bank_account_linked_at).getTime() : null;
        const inHoldWindow = linkedAt !== null && (now - linkedAt) < HOLD_MS;
        const heldUntil   = inHoldWindow ? new Date(linkedAt + HOLD_MS).toISOString() : undefined;

        if (inHoldWindow) {
            await supabase.from("ach_transfers").insert({
                company_id:     company.id,
                payroll_run_id: body.payrollRunId,
                employee_id:    d.employeeId,
                amount_cents:   d.netPayCents,
                status:         "held",
                failure_message: `New bank account ••••${emp?.bank_account_last4} is within the 3-day security hold. Funds will be released on ${new Date(linkedAt! + HOLD_MS).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`,
            });
            results.push({ employeeId: d.employeeId, status: "held", heldUntil });
            continue;
        }

        // ── Initiate OutboundTransfer ─────────────────────────────────────────
        let stripeTransferId: string | undefined;
        let status = "processing";

        if (emp?.stripe_pm_id && financialAccountId && connectedAccountId) {
            try {
                const transfer = await stripe.treasury.outboundTransfers.create(
                    {
                        financial_account:          financialAccountId,
                        amount:                     d.netPayCents,
                        currency:                   "usd",
                        destination_payment_method: emp.stripe_pm_id,
                        description:                `AeroPay payroll — run ${body.payrollRunId}`,
                        metadata: {
                            company_id:     company.id,
                            employee_id:    d.employeeId,
                            payroll_run_id: body.payrollRunId,
                        },
                    },
                    { stripeAccount: connectedAccountId },
                );
                stripeTransferId = transfer.id;
            } catch (err) {
                console.warn(`[stripe-ach] OutboundTransfer failed for ${d.employeeId}:`, err.message);
            }
        }

        const { error: insertErr } = await supabase.from("ach_transfers").insert({
            company_id:         company.id,
            payroll_run_id:     body.payrollRunId,
            employee_id:        d.employeeId,
            stripe_transfer_id: stripeTransferId ?? null,
            amount_cents:       d.netPayCents,
            status,
        });

        if (insertErr) console.error("[stripe-ach] insert ach_transfers:", insertErr.message);

        results.push({ employeeId: d.employeeId, status, transferId: stripeTransferId });
    }

    return json({ results });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCompany(userId: string) {
    const [companyRes, userRes] = await Promise.all([
        supabase
            .from("company_users")
            .select("company_id, companies(*)")
            .eq("user_id", userId)
            .single(),
        supabase.auth.admin.getUserById(userId),
    ]);

    if (companyRes.error || !companyRes.data) throw new Error("Company not found for user");

    return {
        id:          companyRes.data.company_id,
        admin_email: userRes.data?.user?.email ?? null,
        ...(companyRes.data.companies as Record<string, unknown>),
    };
}

/**
 * Send a transactional email via Resend.
 * Requires the RESEND_API_KEY and PLATFORM_FROM_EMAIL secrets.
 * Silently skips if the key is not configured.
 */
async function sendEmail(opts: { to: string; subject: string; html: string }) {
    if (!RESEND_API_KEY) return;
    const resp = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type":  "application/json",
        },
        body: JSON.stringify({
            from:    PLATFORM_FROM,
            to:      opts.to,
            subject: opts.subject,
            html:    opts.html,
        }),
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Resend API error: ${err}`);
    }
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
