/**
 * Stripe Treasury webhook reconciliation.
 *
 * Deploy without Supabase JWT verification because Stripe signs the raw body:
 *   supabase functions deploy stripe-treasury-webhook --no-verify-jwt
 *
 * Required secret:
 *   STRIPE_TREASURY_WEBHOOK_SECRET=whsec_...
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const webhookSecret = Deno.env.get("STRIPE_TREASURY_WEBHOOK_SECRET") ?? "";
const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req: Request) => {
    if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
    if (!webhookSecret) return response({ error: "Webhook secret is not configured" }, 500);

    const signature = req.headers.get("stripe-signature");
    if (!signature) return response({ error: "Missing Stripe signature" }, 400);

    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
        event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
        console.warn("[stripe-treasury-webhook] invalid signature", safeError(err));
        return response({ error: "Invalid signature" }, 400);
    }

    if (!event.type.startsWith("treasury.outbound_payment.")) {
        return response({ received: true, ignored: true });
    }

    const payment = event.data.object as Stripe.Treasury.OutboundPayment;
    const companyId = payment.metadata?.company_id;
    const payrollRunId = payment.metadata?.payroll_run_id;
    const employeeId = payment.metadata?.employee_id;

    if (!companyId || !payrollRunId || !employeeId) {
        console.error("[stripe-treasury-webhook] missing metadata", event.id, payment.id);
        return response({ error: "OutboundPayment metadata is incomplete" }, 422);
    }

    // Connect webhook events include the connected account at the event level.
    // Confirm it maps to the company before changing local payroll state.
    if (event.account) {
        const { data: company } = await supabase.from("companies")
            .select("id")
            .eq("id", companyId)
            .eq("stripe_account_id", event.account)
            .maybeSingle();
        if (!company) return response({ error: "Connected account does not match company" }, 403);
    }

    const status = normalizeStatus(event.type, payment.status);
    const failureMessage = extractFailure(payment);

    const { data: existing, error: lookupErr } = await supabase.from("ach_transfers")
        .select("id, stripe_event_id")
        .eq("payroll_run_id", payrollRunId)
        .eq("employee_id", employeeId)
        .maybeSingle();
    if (lookupErr) return response({ error: lookupErr.message }, 500);

    if (existing?.stripe_event_id === event.id) {
        return response({ received: true, duplicate: true });
    }

    const payload = {
        company_id: companyId,
        payroll_run_id: payrollRunId,
        employee_id: employeeId,
        stripe_transfer_id: payment.id,
        amount_cents: payment.amount,
        status,
        failure_message: failureMessage,
        stripe_event_id: event.id,
        updated_at: new Date().toISOString(),
    };

    const operation = existing
        ? supabase.from("ach_transfers").update(payload).eq("id", existing.id)
        : supabase.from("ach_transfers").insert(payload);
    const { error: writeErr } = await operation;
    if (writeErr) {
        // A concurrent duplicate event can lose the unique-index race; report success
        // only when the transfer already reflects this event.
        const { data: raced } = await supabase.from("ach_transfers")
            .select("stripe_event_id")
            .eq("stripe_transfer_id", payment.id)
            .maybeSingle();
        if (raced?.stripe_event_id !== event.id) return response({ error: writeErr.message }, 500);
    }

    await supabase.from("audit_log").insert({
        company_id: companyId,
        actor_label: "Stripe",
        action: `Payroll transfer ${status}`,
        details: `OutboundPayment ${payment.id} for employee ${employeeId} is ${status}${failureMessage ? `: ${failureMessage}` : ""}.`,
        category: "payroll",
    });

    return response({ received: true, status });
});

function normalizeStatus(eventType: string, objectStatus: string | null) {
    const suffix = eventType.split(".").pop();
    if (["posted", "failed", "returned", "canceled", "processing"].includes(suffix ?? "")) {
        return suffix as string;
    }
    return objectStatus || "processing";
}

function extractFailure(payment: Stripe.Treasury.OutboundPayment) {
    const failure = payment.failure_details as { code?: string | null } | null;
    const returned = payment.returned_details as { code?: string | null } | null;
    return failure?.code || returned?.code || null;
}

function safeError(err: unknown) {
    return (err instanceof Error ? err.message : String(err)).slice(0, 300);
}

function response(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
