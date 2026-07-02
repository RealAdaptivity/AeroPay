/**
 * GlidePay — Tax E-File Edge Function
 * supabase/functions/file-tax/index.ts
 *
 * Deploy:
 *   supabase functions deploy file-tax
 *
 * Submits payroll tax filings to a third-party e-file provider that is
 * authorized to transmit to the IRS / SSA / state agencies (e.g. a service
 * exposing a REST API). GlidePay is not itself an IRS-authorized transmitter,
 * so the actual transmission is delegated to the configured provider.
 *
 * Provider configuration (Supabase secrets — set with `supabase secrets set`):
 *   EFILE_API_URL       Base URL of the provider's REST API.
 *   EFILE_API_KEY       Bearer token / API key for the provider.
 *   EFILE_PROVIDER      Human-readable provider name (shown in the UI/audit log).
 * If EFILE_API_URL / EFILE_API_KEY are unset, the function responds with
 * { configured: false } and 200 so the client can show a "connect a provider"
 * message instead of erroring.
 *
 * Actions:
 *   submit      — Create/refresh a submission row and POST the filing to the
 *                 provider. Returns { submissionId, providerSubmissionId, status }.
 *   get_status  — Poll the provider for a submission and update our row.
 *   list        — Return all submissions for the current company.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EFILE_API_URL  = Deno.env.get("EFILE_API_URL")  ?? "";
const EFILE_API_KEY  = Deno.env.get("EFILE_API_KEY")  ?? "";
const EFILE_PROVIDER = Deno.env.get("EFILE_PROVIDER") ?? "E-File Provider";

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map an arbitrary provider status string onto our normalized enum.
function normalizeStatus(raw: string | undefined): string {
    const s = (raw ?? "").toLowerCase();
    if (["accepted", "acknowledged", "ack", "complete", "completed", "success"].includes(s)) return "accepted";
    if (["rejected", "denied", "failed", "error"].includes(s)) return "rejected";
    if (["submitted", "transmitted", "pending", "processing", "queued", "received"].includes(s)) return "submitted";
    return "submitted";
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // Guard: no provider configured yet — let the client show guidance.
    if (!EFILE_API_URL || !EFILE_API_KEY) {
        return json({ configured: false, provider: EFILE_PROVIDER }, 200);
    }

    const body   = await req.json().catch(() => ({}));
    const action = body.action as string;

    try {
        switch (action) {
            case "submit":     return await handleSubmit(user.id, body);
            case "get_status": return await handleGetStatus(user.id, body);
            case "list":       return await handleList(user.id);
            default:           return json({ error: `Unknown action: ${action}` }, 400);
        }
    } catch (err) {
        console.error(`[file-tax] ${action}:`, err);
        return json({ error: (err as Error).message }, 500);
    }
});

// ── Submit ──────────────────────────────────────────────────────────────────────
async function handleSubmit(userId: string, body: {
    formRef?: string; formType?: string; period?: string;
    agency?: string; amount?: number; formData?: Record<string, unknown>;
}) {
    const company = await getCompanyForUser(userId);

    if (!body.formRef || !body.formType) {
        return json({ error: "formRef and formType are required" }, 400);
    }

    // Upsert a submission row in "submitting" state first, so a failed provider
    // call still leaves an auditable record the client can retry.
    const { data: row, error: upErr } = await supabase
        .from("tax_filing_submissions")
        .upsert({
            company_id:    company.id,
            form_ref:      body.formRef,
            form_type:     body.formType,
            period:        body.period ?? "",
            agency:        body.agency ?? "",
            amount:        body.amount ?? 0,
            provider:      EFILE_PROVIDER,
            status:        "submitting",
            status_detail: null,
            submitted_at:  new Date().toISOString(),
            updated_at:    new Date().toISOString(),
            filed_by:      userId,
        }, { onConflict: "company_id,form_ref" })
        .select()
        .single();

    if (upErr) throw new Error(upErr.message);

    // Transmit to the provider. Payload is intentionally generic so it can be
    // adapted to a specific provider by adjusting field names below.
    let providerSubmissionId: string | null = null;
    let status = "submitted";
    let detail: string | null = null;

    try {
        const resp = await fetch(`${EFILE_API_URL.replace(/\/$/, "")}/filings`, {
            method:  "POST",
            headers: {
                "Authorization": `Bearer ${EFILE_API_KEY}`,
                "Content-Type":  "application/json",
            },
            body: JSON.stringify({
                form_type:   body.formType,
                tax_period:  body.period,
                agency:      body.agency,
                payer: {
                    name: company.name,
                    ein:  company.ein,
                },
                amount:      body.amount ?? 0,
                form_data:   body.formData ?? {},
                external_id: `${company.id}:${body.formRef}`,
            }),
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            status = "error";
            detail = data.error || data.message || `Provider returned ${resp.status}`;
        } else {
            providerSubmissionId = data.id ?? data.submission_id ?? data.filing_id ?? null;
            status = normalizeStatus(data.status);
            detail = data.message ?? null;
        }
    } catch (err) {
        status = "error";
        detail = (err as Error).message;
    }

    const { data: updated } = await supabase
        .from("tax_filing_submissions")
        .update({
            provider_submission_id: providerSubmissionId,
            status,
            status_detail: detail,
            updated_at:    new Date().toISOString(),
        })
        .eq("id", row.id)
        .select()
        .single();

    await supabase.from("audit_log").insert({
        company_id:  company.id,
        actor_label: "System",
        action:      status === "error" ? "Tax E-File Failed" : "Tax E-File Submitted",
        details:     `${body.formType} (${body.period}) — ${EFILE_PROVIDER}` +
                     (status === "error" ? `: ${detail}` : ` → ${status}`),
        category:    "payroll",
    });

    return json({
        submissionId:         row.id,
        providerSubmissionId,
        status,
        statusDetail:         detail,
        submission:           updated ?? row,
    }, status === "error" ? 502 : 200);
}

// ── Get Status ────────────────────────────────────────────────────────────────
async function handleGetStatus(userId: string, body: { submissionId?: string }) {
    const company = await getCompanyForUser(userId);
    if (!body.submissionId) return json({ error: "submissionId is required" }, 400);

    const { data: row, error } = await supabase
        .from("tax_filing_submissions")
        .select("*")
        .eq("id", body.submissionId)
        .eq("company_id", company.id)
        .single();

    if (error || !row) return json({ error: "Submission not found" }, 404);

    // Nothing to poll if we never got a provider id (e.g. prior error) or it's terminal.
    if (!row.provider_submission_id || row.status === "accepted" || row.status === "rejected") {
        return json({ status: row.status, statusDetail: row.status_detail, submission: row });
    }

    let status = row.status;
    let detail = row.status_detail;
    try {
        const resp = await fetch(
            `${EFILE_API_URL.replace(/\/$/, "")}/filings/${row.provider_submission_id}`,
            { headers: { "Authorization": `Bearer ${EFILE_API_KEY}` } },
        );
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) {
            status = normalizeStatus(data.status);
            detail = data.message ?? data.rejection_reason ?? detail;
        }
    } catch (err) {
        detail = (err as Error).message;
    }

    const { data: updated } = await supabase
        .from("tax_filing_submissions")
        .update({ status, status_detail: detail, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .select()
        .single();

    return json({ status, statusDetail: detail, submission: updated ?? row });
}

// ── List ──────────────────────────────────────────────────────────────────────
async function handleList(userId: string) {
    const company = await getCompanyForUser(userId);
    const { data } = await supabase
        .from("tax_filing_submissions")
        .select("*")
        .eq("company_id", company.id)
        .order("updated_at", { ascending: false });
    return json({ submissions: data ?? [] });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getCompanyForUser(userId: string) {
    const { data, error } = await supabase
        .from("company_users")
        .select("company_id, companies(*)")
        .eq("user_id", userId)
        .single();

    if (error || !data) throw new Error("Company not found for user");
    return { id: data.company_id, ...(data.companies as Record<string, unknown>) } as Record<string, any>;
}

function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}
