/**
 * GlidePay — Tax E-File Edge Function
 * supabase/functions/file-tax/index.ts
 *
 * Deploy:
 *   supabase functions deploy file-tax
 *
 * Providers (checked in order):
 *   1. TaxBandit — when TAXBANDIT_CLIENT_ID / SECRET / USER_TOKEN are set
 *   2. Generic REST — when EFILE_API_URL + EFILE_API_KEY are set
 *
 * TaxBandit sandbox secrets:
 *   TAXBANDIT_CLIENT_ID
 *   TAXBANDIT_CLIENT_SECRET
 *   TAXBANDIT_USER_TOKEN
 *   TAXBANDIT_AUTH_URL   (optional, default testoauth)
 *   TAXBANDIT_API_BASE   (optional, default testapi v1.7.3)
 *   EFILE_PROVIDER       (optional display name, default "TaxBandit")
 *
 * Actions: submit | get_status | list
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EFILE_API_URL  = Deno.env.get("EFILE_API_URL")  ?? "";
const EFILE_API_KEY  = Deno.env.get("EFILE_API_KEY")  ?? "";
const EFILE_PROVIDER = Deno.env.get("EFILE_PROVIDER") ?? "";

const TB_CLIENT_ID     = Deno.env.get("TAXBANDIT_CLIENT_ID")     ?? "";
const TB_CLIENT_SECRET = Deno.env.get("TAXBANDIT_CLIENT_SECRET") ?? "";
const TB_USER_TOKEN    = Deno.env.get("TAXBANDIT_USER_TOKEN")    ?? "";
const TB_AUTH_URL      = Deno.env.get("TAXBANDIT_AUTH_URL")
    ?? "https://testoauth.expressauth.net/v2/tbsauth";
const TB_API_BASE      = (Deno.env.get("TAXBANDIT_API_BASE")
    ?? "https://testapi.taxbandits.com/v1.7.3").replace(/\/$/, "");

const useTaxBandit = !!(TB_CLIENT_ID && TB_CLIENT_SECRET && TB_USER_TOKEN);
const useGeneric   = !!(EFILE_API_URL && EFILE_API_KEY);
const providerName = EFILE_PROVIDER
    || (useTaxBandit ? "TaxBandit" : "E-File Provider");

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedAccessToken: { token: string; exp: number } | null = null;

function normalizeStatus(raw: string | undefined): string {
    const s = (raw ?? "").toLowerCase();
    if (["accepted", "acknowledged", "ack", "complete", "completed", "success", "efile_success"].includes(s)) {
        return "accepted";
    }
    if (["rejected", "denied", "failed", "error", "efile_rejected"].includes(s)) return "rejected";
    if (["submitted", "transmitted", "pending", "processing", "queued", "received", "created", "under_process"].includes(s)) {
        return "submitted";
    }
    return "submitted";
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    if (!useTaxBandit && !useGeneric) {
        return json({
            configured: false,
            provider: providerName,
            hint: "Set TAXBANDIT_CLIENT_ID, TAXBANDIT_CLIENT_SECRET, and TAXBANDIT_USER_TOKEN (sandbox) as Supabase secrets.",
        }, 200);
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

    const { data: row, error: upErr } = await supabase
        .from("tax_filing_submissions")
        .upsert({
            company_id:    company.id,
            form_ref:      body.formRef,
            form_type:     body.formType,
            period:        body.period ?? "",
            agency:        body.agency ?? "",
            amount:        body.amount ?? 0,
            provider:      providerName,
            status:        "submitting",
            status_detail: null,
            submitted_at:  new Date().toISOString(),
            updated_at:    new Date().toISOString(),
            filed_by:      userId,
        }, { onConflict: "company_id,form_ref" })
        .select()
        .single();

    if (upErr) throw new Error(upErr.message);

    let providerSubmissionId: string | null = null;
    let status = "submitted";
    let detail: string | null = null;

    try {
        const result = useTaxBandit
            ? await submitTaxBandit(company, body)
            : await submitGeneric(company, body);
        providerSubmissionId = result.submissionId;
        status = result.status;
        detail = result.detail;
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
        details:     `${body.formType} (${body.period}) — ${providerName}` +
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

    if (!row.provider_submission_id || row.status === "accepted" || row.status === "rejected") {
        return json({ status: row.status, statusDetail: row.status_detail, submission: row });
    }

    let status = row.status;
    let detail = row.status_detail;
    try {
        const polled = useTaxBandit
            ? await pollTaxBandit(row.form_type as string, row.provider_submission_id)
            : await pollGeneric(row.provider_submission_id);
        status = polled.status;
        detail = polled.detail ?? detail;
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

async function handleList(userId: string) {
    const company = await getCompanyForUser(userId);
    const { data } = await supabase
        .from("tax_filing_submissions")
        .select("*")
        .eq("company_id", company.id)
        .order("updated_at", { ascending: false });
    return json({ submissions: data ?? [], provider: providerName, configured: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TaxBandit
// ═══════════════════════════════════════════════════════════════════════════════

async function getTaxBanditAccessToken(): Promise<string> {
    if (cachedAccessToken && cachedAccessToken.exp > Date.now() + 60_000) {
        return cachedAccessToken.token;
    }

    const jws = await createTaxBanditJws(TB_CLIENT_ID, TB_CLIENT_SECRET, TB_USER_TOKEN);
    const resp = await fetch(TB_AUTH_URL, {
        method:  "GET",
        headers: { "Authentication": jws, "Content-Type": "application/json" },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.AccessToken) {
        throw new Error(
            data.StatusMessage || data.message ||
            `TaxBandit OAuth failed (${resp.status})`,
        );
    }

    // Access tokens are typically ~1 hour; refresh a few minutes early.
    cachedAccessToken = { token: data.AccessToken, exp: Date.now() + 50 * 60_000 };
    return data.AccessToken;
}

async function createTaxBanditJws(clientId: string, clientSecret: string, userToken: string): Promise<string> {
    const enc = new TextEncoder();
    const b64url = (input: string | ArrayBuffer) => {
        const bytes = typeof input === "string" ? enc.encode(input) : new Uint8Array(input);
        let bin = "";
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    };

    const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = b64url(JSON.stringify({
        iss: clientId,
        sub: clientId,
        aud: userToken,
        iat: Math.floor(Date.now() / 1000),
    }));
    const signingInput = `${header}.${payload}`;

    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(clientSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
    return `${signingInput}.${b64url(sig)}`;
}

async function tbFetch(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    const token = await getTaxBanditAccessToken();
    const url = path.startsWith("http") ? path : `${TB_API_BASE}/${path.replace(/^\//, "")}`;
    const resp = await fetch(url, {
        ...init,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept":        "application/json",
            "Content-Type":  "application/json",
            ...(init.headers || {}),
        },
    });
    const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
    if (!resp.ok) {
        const msg = extractTbError(data) || `TaxBandit ${path} failed (${resp.status})`;
        throw new Error(msg);
    }
    // TaxBandit often returns 200 with StatusCode != 1 for validation errors
    const code = data.StatusCode ?? data.Status ?? data.statusCode;
    if (code != null && Number(code) !== 1 && Number(code) !== 200) {
        throw new Error(extractTbError(data) || `TaxBandit StatusCode ${code}`);
    }
    return data;
}

function extractTbError(data: Record<string, unknown>): string | null {
    if (typeof data.StatusMessage === "string" && data.StatusMessage) return data.StatusMessage;
    if (typeof data.message === "string" && data.message) return data.message;
    if (typeof data.ErrorMessage === "string" && data.ErrorMessage) return data.ErrorMessage;
    const errors = data.Errors || data.errors || data.ErrorRecords;
    if (Array.isArray(errors) && errors.length) {
        return errors.map((e: any) => e.Message || e.message || JSON.stringify(e)).join("; ");
    }
    return null;
}

function businessPayload(company: Record<string, any>) {
    const ein = String(company.ein || "").replace(/\D/g, "") || "000000000";
    return {
        BusinessNm:         company.name || "GlidePay Company",
        PayerRef:           company.id,
        IsEIN:              true,
        EINorSSN:           ein.length === 9 ? `${ein.slice(0, 2)}-${ein.slice(2)}` : ein,
        Email:              company.ownerEmail || "owner@glidepay.org",
        ContactNm:          company.name || "Owner",
        Phone:              "0000000000",
        IsForeign:          false,
        IsBusinessTerminated: false,
        BusinessType:       "ESTE",
        KindOfPayer:        "REGULAR941",
        SigningAuthority: {
            Name:               "Authorized Signer",
            Phone:              "0000000000",
            BusinessMemberType: "ADMINISTRATOR",
        },
        USAddress: {
            Address1: "1 Main St",
            City:     "Wilmington",
            State:    "DE",
            ZipCd:    "19801",
        },
    };
}

async function ensureTaxBanditBusiness(company: Record<string, any>): Promise<string> {
    // Prefer creating with PayerRef; TaxBandit merges duplicate EINs.
    try {
        const created = await tbFetch("Business/Create", {
            method: "POST",
            body:   JSON.stringify(businessPayload(company)),
        });
        const id = (created.BusinessId || (created as any).businessId) as string | undefined;
        if (id) return String(id);
    } catch (err) {
        // Fall through to list lookup (business may already exist)
        console.warn("[file-tax] Business/Create:", (err as Error).message);
    }

    const list = await tbFetch("Business/List?Page=1&PageSize=100", { method: "GET" });
    const rows = (list.Businesses || list.businesses || list.BusinessList || []) as any[];
    const einDigits = String(company.ein || "").replace(/\D/g, "");
    const match = rows.find((b) =>
        String(b.PayerRef || "") === company.id ||
        String(b.EINorSSN || "").replace(/\D/g, "") === einDigits ||
        String(b.BusinessNm || "") === company.name,
    );
    if (match?.BusinessId) return String(match.BusinessId);
    throw new Error("Could not create or find TaxBandit business for this company");
}

function parsePeriod(period: string | undefined): { taxYr: string; qtr: string } {
    const now = new Date();
    const fallbackYr = String(now.getFullYear());
    const fallbackQ  = `Q${Math.floor(now.getMonth() / 3) + 1}`;
    if (!period) return { taxYr: fallbackYr, qtr: fallbackQ };

    const qMatch = period.match(/Q([1-4])/i);
    const yMatch = period.match(/(20\d{2})/);
    return {
        taxYr: yMatch ? yMatch[1] : fallbackYr,
        qtr:   qMatch ? `Q${qMatch[1]}` : fallbackQ,
    };
}

function formRoute(formType: string): { create: string; transmit: string; status: string } | null {
    const t = formType.toLowerCase();
    if (t.includes("941")) {
        return { create: "Form941/Create", transmit: "Form941/Transmit", status: "Form941/Status" };
    }
    if (t.includes("940")) {
        return { create: "Form940/Create", transmit: "Form940/Transmit", status: "Form940/Status" };
    }
    if (t.includes("w-2") || t.includes("w2") || t.includes("w-3")) {
        return { create: "FormW2/Create", transmit: "FormW2/Transmit", status: "FormW2/Status" };
    }
    if (t.includes("1099")) {
        return { create: "Form1099NEC/Create", transmit: "Form1099NEC/Transmit", status: "Form1099NEC/Status" };
    }
    return null;
}

async function submitTaxBandit(
    company: Record<string, any>,
    body: { formType?: string; period?: string; amount?: number; formData?: Record<string, unknown> },
): Promise<{ submissionId: string | null; status: string; detail: string | null }> {
    const route = formRoute(body.formType || "");
    if (!route) {
        throw new Error(`Unsupported form type for TaxBandit: ${body.formType}`);
    }

    const businessId = await ensureTaxBanditBusiness(company);
    const { taxYr, qtr } = parsePeriod(body.period);
    const createBody = buildCreatePayload(body.formType || "", businessId, company, taxYr, qtr, body);

    const created = await tbFetch(route.create, {
        method: "POST",
        body:   JSON.stringify(createBody),
    });

    const submissionId = String(
        created.SubmissionId ||
        created.submissionId ||
        (created as any).SubmissionManifest?.SubmissionId ||
        "",
    ) || null;

    if (!submissionId) {
        return {
            submissionId: null,
            status: "error",
            detail: extractTbError(created) || "TaxBandit Create returned no SubmissionId",
        };
    }

    // Transmit to IRS/SSA simulation in sandbox
    try {
        await tbFetch(route.transmit, {
            method: "POST",
            body:   JSON.stringify({ SubmissionId: submissionId }),
        });
        return {
            submissionId,
            status: "submitted",
            detail: `Created & transmitted via TaxBandit (${taxYr} ${qtr})`,
        };
    } catch (err) {
        // Create succeeded; transmit may need more data — keep submission for retry/status
        return {
            submissionId,
            status: "submitted",
            detail: `Created in TaxBandit; transmit pending: ${(err as Error).message}`,
        };
    }
}

function buildCreatePayload(
    formType: string,
    businessId: string,
    company: Record<string, any>,
    taxYr: string,
    qtr: string,
    body: { amount?: number; formData?: Record<string, unknown> },
): Record<string, unknown> {
    const t = formType.toLowerCase();
    const fd = body.formData || {};
    const wages = Number(fd.wagesAmt ?? fd.grossPayroll ?? body.amount ?? 0);
    const fit   = Number(fd.fedIncomeTaxWHAmt ?? fd.federalWithheld ?? wages * 0.12);
    const empCnt = Number(fd.employeeCnt ?? fd.employeeCount ?? 1);

    if (t.includes("941")) {
        const ssWages = Number(fd.ssWages ?? wages);
        const medWages = Number(fd.medicareWages ?? wages);
        const ssTax = Math.round(ssWages * 0.124 * 100) / 100;
        const medTax = Math.round(medWages * 0.029 * 100) / 100;
        const totalTax = Math.round((fit + ssTax + medTax) * 100) / 100;
        return {
            Form941Records: [{
                Sequence: "Record1",
                ReturnHeader: {
                    TaxYr: taxYr,
                    Qtr:   qtr,
                    Business: { BusinessId: businessId },
                    BusinessStatusDetails: {
                        IsBusinessClosed: false,
                        IsBusinessTransferred: false,
                        IsSeasonalEmployer: false,
                    },
                    IsThirdPartyDesignee: false,
                    SignatureDetails: {
                        SignatureType: "ONLINE_SIGN_PIN",
                        OnlineSignaturePIN: { PIN: "123456" },
                    },
                },
                ReturnData: {
                    Form941: {
                        EmployeeCnt: empCnt,
                        WagesAmt: wages,
                        FedIncomeTaxWHAmt: fit,
                        WagesNotSubjToSSMedcrTaxInd: false,
                        SocialSecurityTaxCashWagesAmt_Col1: ssWages,
                        TaxableSocSecTipsAmt_Col1: 0,
                        TaxableMedicareWagesTipsAmt_Col1: medWages,
                        TxblWageTipsSubjAddnlMedcrAmt_Col1: 0,
                        SocialSecurityTaxAmt_Col2: ssTax,
                        TaxOnSocialSecurityTipsAmt_Col2: 0,
                        TaxOnMedicareWagesTipsAmt_Col2: medTax,
                        TaxOnWageTipsSubjAddnlMedcrAmt_Col2: 0,
                        TotSSMdcrTaxAmt: ssTax + medTax,
                        TaxOnUnreportedTips3121qAmt: 0,
                        TotalTaxBeforeAdjustmentAmt: totalTax,
                        TotalTaxAfterAdjustmentAmt: totalTax,
                        TotTaxAmt: totalTax,
                        TotTaxDepositAmt: totalTax,
                        BalanceDueAmt: 0,
                        OverpaidAmt: 0,
                        IsPayrollTaxCredit: false,
                    },
                    DepositScheduleType: {
                        DepositorType: "MINTAXLIABILITY",
                        TaxLiabilityTotalAmt: totalTax,
                    },
                },
            }],
        };
    }

    if (t.includes("940")) {
        return {
            Form940Records: [{
                Sequence: "Record1",
                ReturnHeader: {
                    TaxYr: taxYr,
                    Business: { BusinessId: businessId },
                    SignatureDetails: {
                        SignatureType: "ONLINE_SIGN_PIN",
                        OnlineSignaturePIN: { PIN: "123456" },
                    },
                },
                ReturnData: {
                    Form940: {
                        WagesAmt: wages,
                        TaxableWagesAmt: wages,
                        FUTATaxBeforeAdjustmentAmt: Math.round(wages * 0.006 * 100) / 100,
                        TotalTaxAmt: Math.round(wages * 0.006 * 100) / 100,
                    },
                },
            }],
        };
    }

    if (t.includes("w-2") || t.includes("w2") || t.includes("w-3")) {
        const employees = (fd.employees as any[]) || [{
            firstName: "Test", lastName: "Employee", ssn: "000000000",
            wages, federalWithheld: fit,
        }];
        return {
            SubmissionManifest: {
                TaxYear: taxYr,
                IsFederalFiling: true,
                IsStateFiling: false,
                IsPostal: false,
                IsOnlineAccess: false,
            },
            ReturnHeader: { Business: { BusinessId: businessId } },
            ReturnData: employees.map((e, i) => ({
                SequenceId: String(i + 1),
                Employee: {
                    FirstNm: e.firstName || e.FirstNm || "Test",
                    LastNm:  e.lastName  || e.LastNm  || "Employee",
                    SSN:     String(e.ssn || e.SSN || "000000000").replace(/\D/g, ""),
                },
                W2FormData: {
                    WagesAmt: Number(e.wages ?? wages),
                    FedIncomeTaxWHAmt: Number(e.federalWithheld ?? fit),
                    SocialSecurityWagesAmt: Number(e.wages ?? wages),
                    SocialSecurityTaxAmt: Math.round(Number(e.wages ?? wages) * 0.062 * 100) / 100,
                    MedicareWagesAmt: Number(e.wages ?? wages),
                    MedicareTaxAmt: Math.round(Number(e.wages ?? wages) * 0.0145 * 100) / 100,
                },
            })),
        };
    }

    // 1099-NEC
    const recipients = (fd.recipients as any[]) || [{
        firstName: "Test", lastName: "Contractor", tin: "000000000",
        amount: wages || Number(body.amount || 0),
    }];
    return {
        SubmissionManifest: {
            TaxYear: taxYr,
            IsFederalFiling: true,
            IsStateFiling: false,
            IsPostal: false,
            IsOnlineAccess: false,
        },
        ReturnHeader: { Business: { BusinessId: businessId } },
        ReturnData: recipients.map((r, i) => ({
            SequenceId: String(i + 1),
            Recipient: {
                FirstNm: r.firstName || r.FirstNm || "Test",
                LastNm:  r.lastName  || r.LastNm  || "Contractor",
                TIN:     String(r.tin || r.TIN || r.ssn || "000000000").replace(/\D/g, ""),
                IsTINValid: true,
            },
            NECFormData: {
                B1NEC: Number(r.amount ?? wages ?? body.amount ?? 0),
                Is2ndTINNotice: false,
            },
        })),
    };
}

async function pollTaxBandit(formType: string, submissionId: string) {
    const route = formRoute(formType);
    if (!route) return { status: "submitted", detail: null as string | null };

    const data = await tbFetch(`${route.status}?SubmissionId=${encodeURIComponent(submissionId)}`, {
        method: "GET",
    });

    const records = (data.Form941Records || data.Form940Records || data.FormW2Records ||
        data.Form1099NECRecords || data.Records || []) as any[];
    const rawStatus =
        data.Status ||
        data.FilingStatus ||
        records[0]?.Status ||
        records[0]?.FederalReturn?.Status ||
        "submitted";

    return {
        status: normalizeStatus(String(rawStatus)),
        detail: extractTbError(data) || String(rawStatus),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Generic provider (legacy)
// ═══════════════════════════════════════════════════════════════════════════════

async function submitGeneric(
    company: Record<string, any>,
    body: { formType?: string; period?: string; agency?: string; amount?: number; formData?: Record<string, unknown>; formRef?: string },
) {
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
            payer:       { name: company.name, ein: company.ein },
            amount:      body.amount ?? 0,
            form_data:   body.formData ?? {},
            external_id: `${company.id}:${body.formRef}`,
        }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        return {
            submissionId: null,
            status: "error",
            detail: data.error || data.message || `Provider returned ${resp.status}`,
        };
    }
    return {
        submissionId: data.id ?? data.submission_id ?? data.filing_id ?? null,
        status: normalizeStatus(data.status),
        detail: data.message ?? null,
    };
}

async function pollGeneric(providerSubmissionId: string) {
    const resp = await fetch(
        `${EFILE_API_URL.replace(/\/$/, "")}/filings/${providerSubmissionId}`,
        { headers: { "Authorization": `Bearer ${EFILE_API_KEY}` } },
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { status: "submitted", detail: null as string | null };
    return {
        status: normalizeStatus(data.status),
        detail: data.message ?? data.rejection_reason ?? null,
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getCompanyForUser(userId: string) {
    const { data, error } = await supabase
        .from("company_users")
        .select("company_id, companies(*)")
        .eq("user_id", userId)
        .single();

    if (error || !data) {
        // Fallback: owner_id on companies
        const { data: owned, error: ownedErr } = await supabase
            .from("companies")
            .select("*")
            .eq("owner_id", userId)
            .maybeSingle();
        if (ownedErr || !owned) throw new Error("Company not found for user");
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        return { ...owned, ownerEmail: authUser?.user?.email };
    }

    const company = { id: data.company_id, ...(data.companies as Record<string, unknown>) } as Record<string, any>;
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    company.ownerEmail = authUser?.user?.email;
    return company;
}

function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}
