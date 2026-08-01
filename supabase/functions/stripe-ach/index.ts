/**
 * GlidePay — Stripe ACH / Treasury Edge Function
 *
 * Security invariants:
 * - Payroll amounts are always loaded from persisted payroll line items.
 * - Only company owners/admins can initiate disbursements.
 * - Every employee and payroll record is scoped to the resolved company.
 * - One deterministic Stripe idempotency key is used per payroll run + employee.
 * - A local transfer row is reserved before calling Stripe for crash recovery.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const PLATFORM_FROM = Deno.env.get("PLATFORM_FROM_EMAIL") ?? "payroll@glidepay.org";
const PLATFORM_URL = Deno.env.get("PLATFORM_URL") ?? "https://glidepay.org";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? PLATFORM_URL;

const CORS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return ok();
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({ error: "Invalid JSON body" }, 400);
    }

    const action = String(body.action ?? "");
    try {
        switch (action) {
            case "setup_intent":
                return await handleSetupIntent(user.id, body as { employeeId: string });
            case "confirm_setup":
                return await handleConfirmSetup(user.id, body as { employeeId: string; paymentMethodId: string });
            case "disburse":
                return await handleDisburse(user.id, body as { payrollRunId: string });
            default:
                return json({ error: `Unknown action: ${action}` }, 400);
        }
    } catch (err) {
        const message = safeError(err);
        console.error(`[stripe-ach] ${action}:`, message);
        return json({ error: message }, 500);
    }
});

async function handleSetupIntent(userId: string, body: { employeeId: string }) {
    if (!body.employeeId) return json({ error: "employeeId is required" }, 400);

    const company = await getCompany(userId, { employeeId: body.employeeId });
    const connectedAccountId = company.stripe_account_id as string | undefined;
    if (!connectedAccountId) {
        return json({ error: "Stripe connected account not set up. Complete onboarding first." }, 400);
    }

    const { data: emp, error: empErr } = await supabase
        .from("employees")
        .select("id, name, email, stripe_customer_id, company_id, user_id")
        .eq("id", body.employeeId)
        .eq("company_id", company.id)
        .single();
    if (empErr || !emp) return json({ error: "Employee not found" }, 404);

    if (company._membershipRole === "employee" && emp.user_id !== userId) {
        return json({ error: "Not allowed to link bank for another employee" }, 403);
    }

    const customerId = await ensureEmployeeCustomer(emp, connectedAccountId, company.id as string);
    const intent = await stripe.setupIntents.create(
        {
            customer: customerId,
            payment_method_types: ["us_bank_account"],
            payment_method_options: {
                us_bank_account: {
                    financial_connections: { permissions: ["payment_method"] },
                    verification_method: "instant",
                },
            },
            metadata: {
                company_id: String(company.id),
                employee_id: body.employeeId,
            },
        },
        {
            stripeAccount: connectedAccountId,
            idempotencyKey: `setup:${company.id}:${body.employeeId}`,
        },
    );

    return json({ client_secret: intent.client_secret, customer_id: customerId });
}

async function handleConfirmSetup(
    userId: string,
    body: { employeeId: string; paymentMethodId: string },
) {
    if (!body.employeeId || !body.paymentMethodId) {
        return json({ error: "employeeId and paymentMethodId are required" }, 400);
    }

    const company = await getCompany(userId, { employeeId: body.employeeId });
    const connectedAccountId = company.stripe_account_id as string | undefined;
    if (!connectedAccountId) return json({ error: "Stripe connected account not set up." }, 400);

    const { data: empBefore, error: empErr } = await supabase
        .from("employees")
        .select("id, name, email, bank_account_last4, stripe_customer_id, company_id, user_id")
        .eq("id", body.employeeId)
        .eq("company_id", company.id)
        .single();
    if (empErr || !empBefore) return json({ error: "Employee not found" }, 404);

    if (company._membershipRole === "employee" && empBefore.user_id !== userId) {
        return json({ error: "Not allowed to link bank for another employee" }, 403);
    }

    const customerId = await ensureEmployeeCustomer(empBefore, connectedAccountId, company.id as string);
    const pm = await stripe.paymentMethods.retrieve(
        body.paymentMethodId,
        {},
        { stripeAccount: connectedAccountId },
    );

    if (pm.type !== "us_bank_account") {
        return json({ error: "Payment method must be a US bank account" }, 400);
    }
    if (pm.customer && pm.customer !== customerId) {
        return json({ error: "Payment method belongs to a different customer" }, 409);
    }

    if (!pm.customer) {
        await stripe.paymentMethods.attach(
            body.paymentMethodId,
            { customer: customerId },
            { stripeAccount: connectedAccountId },
        );
    }

    const bank = (pm as Stripe.PaymentMethod).us_bank_account;
    const last4 = bank?.last4 ?? "";
    const routing = bank?.routing_number ?? "";
    if (!last4) return json({ error: "Bank account details are incomplete" }, 400);

    const linkedAt = new Date().toISOString();
    const { error } = await supabase.from("employees").update({
        stripe_pm_id: body.paymentMethodId,
        stripe_customer_id: customerId,
        bank_account_last4: last4,
        bank_routing: routing,
        bank_account_linked_at: linkedAt,
    }).eq("id", body.employeeId).eq("company_id", company.id);
    if (error) throw error;

    const prevLast4 = empBefore.bank_account_last4;
    await supabase.from("audit_log").insert({
        company_id: company.id,
        actor_label: "System",
        action: prevLast4 ? "Bank Account Changed" : "Bank Account Linked",
        details: prevLast4
            ? `${empBefore.name} changed direct deposit from ••••${prevLast4} to ••••${last4}. 3-business-day hold applied.`
            : `${empBefore.name} linked direct deposit account ••••${last4}. 3-business-day hold applied.`,
        category: "employee",
    });

    const companyName = String(company.name ?? "Your employer");
    await Promise.allSettled([
        empBefore.email ? sendEmail({
            to: empBefore.email,
            subject: "Your direct deposit account was updated",
            html: `<p>Hi ${escapeHtml(empBefore.name ?? "there")},</p>
                <p>Your direct deposit bank account on GlidePay has been updated to the account ending in <strong>••••${last4}</strong>.</p>
                <p>Your first payroll deposit to this account will be held for <strong>3 business days</strong>.</p>
                <p>If you did not make this change, contact your payroll administrator immediately.</p>
                <p style="color:#6b7280;font-size:12px;">— GlidePay on behalf of ${escapeHtml(companyName)}</p>`,
        }) : Promise.resolve(),
        company.admin_email ? sendEmail({
            to: String(company.admin_email),
            subject: `[GlidePay] Bank account changed — ${empBefore.name}`,
            html: `<p>This is an automated security alert from GlidePay.</p>
                <p><strong>${escapeHtml(empBefore.name ?? "Employee")}</strong> updated direct deposit to account <strong>••••${last4}</strong>.</p>
                <p>A <strong>3-business-day hold</strong> has been applied.</p>
                <p><a href="${PLATFORM_URL}">Open GlidePay</a></p>`,
        }) : Promise.resolve(),
    ]);

    return json({ ok: true, last4, routing, linkedAt, customerId });
}

async function handleDisburse(userId: string, body: { payrollRunId: string }) {
    if (!body.payrollRunId) return json({ error: "payrollRunId is required" }, 400);

    const company = await getCompany(userId, { requireAdmin: true });
    const companyId = String(company.id);
    const financialAccountId = company.stripe_financial_account_id as string | undefined;
    const connectedAccountId = company.stripe_account_id as string | undefined;

    if (!financialAccountId || !connectedAccountId) {
        return json({ error: "Company Stripe Treasury account is not ready" }, 409);
    }

    const { data: payrollRun, error: runErr } = await supabase
        .from("payroll_runs")
        .select("id, company_id, status")
        .eq("id", body.payrollRunId)
        .eq("company_id", companyId)
        .single();
    if (runErr || !payrollRun) return json({ error: "Payroll run not found" }, 404);

    const { data: lines, error: lineErr } = await supabase
        .from("payroll_line_items")
        .select("employee_id, net_pay")
        .eq("payroll_run_id", body.payrollRunId)
        .eq("company_id", companyId);
    if (lineErr) throw new Error(lineErr.message);
    if (!lines?.length) return json({ error: "Payroll run has no line items" }, 409);

    const results: Array<Record<string, unknown>> = [];
    for (const line of lines) {
        const employeeId = String(line.employee_id);
        const netPayCents = Math.round(Number(line.net_pay ?? 0) * 100);
        if (!Number.isSafeInteger(netPayCents) || netPayCents <= 0) continue;

        const { data: emp, error: empErr } = await supabase
            .from("employees")
            .select("id, company_id, stripe_pm_id, stripe_customer_id, bank_account_last4, name, bank_account_linked_at")
            .eq("id", employeeId)
            .eq("company_id", companyId)
            .single();
        if (empErr || !emp) {
            results.push({ employeeId, status: "failed", error: "Employee not found in company" });
            continue;
        }

        const heldUntil = emp.bank_account_linked_at
            ? addBusinessDays(new Date(emp.bank_account_linked_at), 3)
            : null;
        if (heldUntil && heldUntil.getTime() > Date.now()) {
            const row = await reserveTransfer({
                companyId,
                payrollRunId: body.payrollRunId,
                employeeId,
                amountCents: netPayCents,
                status: "held",
                failureMessage: `New bank account ••••${emp.bank_account_last4 ?? ""} is within the 3-business-day security hold.`,
            });
            results.push({ employeeId, status: row.status, heldUntil: heldUntil.toISOString() });
            continue;
        }

        if (!emp.stripe_pm_id || !emp.stripe_customer_id) {
            const row = await reserveTransfer({
                companyId,
                payrollRunId: body.payrollRunId,
                employeeId,
                amountCents: netPayCents,
                status: "failed",
                failureMessage: "Employee has no verified linked bank account",
            });
            results.push({ employeeId, status: row.status, error: row.failure_message });
            continue;
        }

        const existing = await findTransfer(body.payrollRunId, employeeId);
        if (existing && ["creating", "processing", "posted", "returned", "held"].includes(existing.status)) {
            results.push({
                employeeId,
                status: existing.status,
                transferId: existing.stripe_transfer_id ?? undefined,
                deduplicated: true,
            });
            continue;
        }

        const reserved = await reserveTransfer({
            companyId,
            payrollRunId: body.payrollRunId,
            employeeId,
            amountCents: netPayCents,
            status: "creating",
            failureMessage: null,
        });
        const idempotencyKey = `payroll:${companyId}:${body.payrollRunId}:${employeeId}`;

        try {
            const payment = await stripe.treasury.outboundPayments.create(
                {
                    financial_account: financialAccountId,
                    amount: netPayCents,
                    currency: "usd",
                    customer: emp.stripe_customer_id,
                    destination_payment_method: emp.stripe_pm_id,
                    description: `GlidePay payroll — run ${body.payrollRunId}`,
                    statement_descriptor: "PAYROLL",
                    metadata: {
                        company_id: companyId,
                        employee_id: employeeId,
                        payroll_run_id: body.payrollRunId,
                        ach_transfer_id: String(reserved.id),
                    },
                },
                { stripeAccount: connectedAccountId, idempotencyKey },
            );

            const { error: updateErr } = await supabase.from("ach_transfers").update({
                stripe_transfer_id: payment.id,
                status: payment.status || "processing",
                failure_message: null,
                idempotency_key: idempotencyKey,
                updated_at: new Date().toISOString(),
            }).eq("id", reserved.id);
            if (updateErr) throw new Error(`Stripe payment created but local update failed: ${updateErr.message}`);

            results.push({ employeeId, status: payment.status || "processing", transferId: payment.id });
        } catch (err) {
            const failureMessage = safeError(err);
            await supabase.from("ach_transfers").update({
                status: "failed",
                failure_message: failureMessage,
                idempotency_key: idempotencyKey,
                updated_at: new Date().toISOString(),
            }).eq("id", reserved.id);
            results.push({ employeeId, status: "failed", error: failureMessage });
        }
    }

    return json({ payrollRunId: body.payrollRunId, results });
}

async function reserveTransfer(input: {
    companyId: string;
    payrollRunId: string;
    employeeId: string;
    amountCents: number;
    status: string;
    failureMessage: string | null;
}) {
    const existing = await findTransfer(input.payrollRunId, input.employeeId);
    if (existing) return existing;

    const { data, error } = await supabase.from("ach_transfers").insert({
        company_id: input.companyId,
        payroll_run_id: input.payrollRunId,
        employee_id: input.employeeId,
        amount_cents: input.amountCents,
        status: input.status,
        failure_message: input.failureMessage,
    }).select("*").single();

    if (!error && data) return data;
    const raced = await findTransfer(input.payrollRunId, input.employeeId);
    if (raced) return raced;
    throw new Error(error?.message ?? "Unable to reserve transfer");
}

async function findTransfer(payrollRunId: string, employeeId: string) {
    const { data, error } = await supabase.from("ach_transfers")
        .select("*")
        .eq("payroll_run_id", payrollRunId)
        .eq("employee_id", employeeId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
}

async function ensureEmployeeCustomer(
    emp: { id: string; name?: string | null; email?: string | null; stripe_customer_id?: string | null },
    connectedAccountId: string,
    companyId: string,
): Promise<string> {
    if (emp.stripe_customer_id) {
        try {
            const customer = await stripe.customers.retrieve(
                emp.stripe_customer_id,
                {},
                { stripeAccount: connectedAccountId },
            );
            if (!customer.deleted && customer.metadata?.employee_id === emp.id) return emp.stripe_customer_id;
        } catch {
            // Recreate below if the stored customer is missing or belongs elsewhere.
        }
    }

    const customer = await stripe.customers.create(
        {
            name: emp.name || undefined,
            email: emp.email || undefined,
            metadata: { employee_id: emp.id, company_id: companyId },
        },
        {
            stripeAccount: connectedAccountId,
            idempotencyKey: `employee-customer:${companyId}:${emp.id}`,
        },
    );

    const { error } = await supabase.from("employees").update({
        stripe_customer_id: customer.id,
    }).eq("id", emp.id).eq("company_id", companyId);
    if (error) throw error;
    return customer.id;
}

async function getCompany(
    userId: string,
    opts: { employeeId?: string; requireAdmin?: boolean } = {},
) {
    const userRes = await supabase.auth.admin.getUserById(userId);
    const adminEmail = userRes.data?.user?.email ?? null;
    let preferredCompanyId: string | null = null;

    if (opts.employeeId) {
        const { data: emp } = await supabase.from("employees")
            .select("company_id, user_id")
            .eq("id", opts.employeeId)
            .maybeSingle();
        if (emp?.company_id) preferredCompanyId = String(emp.company_id);
    }

    const { data: memberships, error } = await supabase.from("company_users")
        .select("company_id, role, companies(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) throw new Error(`Company lookup failed: ${error.message}`);

    const rows = memberships ?? [];
    let chosen = preferredCompanyId
        ? rows.find((row) => String(row.company_id) === preferredCompanyId)
        : null;

    if (opts.requireAdmin) {
        chosen = chosen && ["owner", "admin"].includes(String(chosen.role)) ? chosen : null;
        chosen ??= rows.find((row) =>
            ["owner", "admin"].includes(String(row.role)) &&
            Boolean((row.companies as Record<string, unknown>)?.stripe_account_id)
        ) ?? null;
        if (!chosen) throw new Error("Owner or admin access is required");
    } else if (!chosen) {
        chosen = rows.find((row) => Boolean((row.companies as Record<string, unknown>)?.stripe_account_id))
            ?? rows[0]
            ?? null;
    }

    if (!chosen && preferredCompanyId && !opts.requireAdmin) {
        const { data: employee } = await supabase.from("employees")
            .select("user_id")
            .eq("company_id", preferredCompanyId)
            .eq("id", opts.employeeId ?? "")
            .maybeSingle();
        if (employee?.user_id !== userId) throw new Error("Company access denied");

        const { data: company } = await supabase.from("companies")
            .select("*")
            .eq("id", preferredCompanyId)
            .single();
        if (company) return { ...company, id: company.id, admin_email: adminEmail, _membershipRole: "employee" };
    }

    if (!chosen?.companies) throw new Error("Company not found for user");
    return {
        ...(chosen.companies as Record<string, unknown>),
        id: chosen.company_id,
        admin_email: adminEmail,
        _membershipRole: String(chosen.role ?? "member"),
    };
}

function addBusinessDays(start: Date, days: number) {
    const result = new Date(start);
    let remaining = days;
    while (remaining > 0) {
        result.setUTCDate(result.getUTCDate() + 1);
        const day = result.getUTCDay();
        if (day !== 0 && day !== 6) remaining -= 1;
    }
    return result;
}

async function sendEmail(opts: { to: string; subject: string; html: string }) {
    if (!RESEND_API_KEY) return;
    const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: PLATFORM_FROM, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!resp.ok) throw new Error(`Resend API error: ${(await resp.text()).slice(0, 300)}`);
}

function safeError(err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    return raw.replace(/sk_(live|test)_[A-Za-z0-9]+/g, "[redacted]").slice(0, 500);
}

function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    }[char] ?? char));
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
