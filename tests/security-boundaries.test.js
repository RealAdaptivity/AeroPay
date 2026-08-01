const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const edgeFunctions = [
    "file-tax",
    "invite-employee",
    "stripe-ach",
    "stripe-checkout",
    "stripe-connect",
    "stripe-portal",
];

test("authenticated Edge Functions do not allow every browser origin", () => {
    for (const name of edgeFunctions) {
        const source = readFileSync(join(root, "supabase", "functions", name, "index.ts"), "utf8");
        assert.doesNotMatch(source, /"Access-Control-Allow-Origin"\s*:\s*"\*"/, name);
        assert.match(source, /req\.method !== "POST"/, name);
    }
});

test("checkout resolves sensitive inputs on the server", () => {
    const server = readFileSync(
        join(root, "supabase", "functions", "stripe-checkout", "index.ts"),
        "utf8",
    );
    const client = readFileSync(join(root, "billing.js"), "utf8");

    assert.match(server, /STRIPE_PRICE_BASE_ID/);
    assert.match(server, /\.eq\("user_id", userId\)/);
    assert.doesNotMatch(client, /companyId\s*:/);
    assert.doesNotMatch(client, /successUrl\s*:/);
    assert.doesNotMatch(client, /priceBaseId\s*:/);
});

test("webhook processing failures request a retry", () => {
    const source = readFileSync(
        join(root, "supabase", "functions", "stripe-webhook", "index.ts"),
        "utf8",
    );
    assert.match(source, /status:\s*500/);
    assert.match(source, /claimEvent\(event\)/);
    assert.match(source, /stripe_webhook_events/);
    assert.match(source, /Webhook processing failed/);
    assert.doesNotMatch(source, /JSON\.stringify\(\{ error: \(err as Error\)\.message \}\)/);
});

test("Stripe lifecycle handlers cover retry, cancellation, payment failure, and ACH returns", () => {
    const webhook = readFileSync(
        join(root, "supabase", "functions", "stripe-webhook", "index.ts"),
        "utf8",
    );
    const ach = readFileSync(join(root, "supabase", "functions", "stripe-ach", "index.ts"), "utf8");

    for (const eventType of [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
        "treasury.outbound_transfer.posted",
        "treasury.outbound_transfer.failed",
        "treasury.outbound_transfer.returned",
        "account.updated",
    ]) assert.match(webhook, new RegExp(eventType.replaceAll(".", "\\.")), eventType);

    assert.match(webhook, /existing\.status === "processed"/);
    assert.match(webhook, /Date\.now\(\) - 5 \* 60 \* 1000/);
    assert.match(webhook, /status: "failed"/);
    assert.match(webhook, /message\.slice\(0, 2000\)/);
    assert.match(ach, /\["processing", "succeeded"\]\.includes\(existing\.status\)/);
    assert.match(ach, /status:\s*"held"/);
    assert.match(ach, /status = "failed"/);
});

test("ACH payouts use approved database values and stable operation keys", () => {
    const source = readFileSync(
        join(root, "supabase", "functions", "stripe-ach", "index.ts"),
        "utf8",
    );
    assert.match(source, /run\.status !== "completed"/);
    assert.match(source, /\.in\("role", \["owner", "admin"\]\)/);
    assert.match(source, /\.from\("payroll_line_items"\)/);
    assert.doesNotMatch(source, /body\.disbursements/);
    assert.match(source, /operation_key: operationKey/);
    assert.match(source, /idempotencyKey: operationKey/);
});

test("Stripe safety migration isolates its ledger tables", () => {
    const migration = readFileSync(
        join(root, "supabase", "migrations", "20260801141121_stripe_sandbox_idempotency.sql"),
        "utf8",
    );
    assert.match(migration, /stripe_webhook_events/);
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /REVOKE ALL .* anon, authenticated/);
    assert.match(migration, /ach_transfers_operation_key_uidx/);
});

test("company authorization separates administrators from employee members", () => {
    const migration = readFileSync(
        join(root, "supabase", "migrations", "20260801143315_harden_company_authorization.sql"),
        "utf8",
    );
    assert.match(migration, /private\.is_company_admin\(company_id\)/);
    assert.match(migration, /company_users_owner_bootstrap/);
    assert.match(migration, /role\s*=\s*'owner'/);
    assert.match(migration, /pay_advances_self_insert[\s\S]*status='pending'/);
    assert.match(migration, /pto_requests_self_insert[\s\S]*status='pending'/);
    assert.doesNotMatch(migration, /FOR ALL TO authenticated\s+USING \(company_id = public\.current_company_id\(\)\)/);
});

test("remote Supabase dependencies are pinned", () => {
    const functionRoot = join(root, "supabase", "functions");
    for (const name of [...edgeFunctions, "stripe-webhook"]) {
        const source = readFileSync(join(functionRoot, name, "index.ts"), "utf8");
        assert.doesNotMatch(source, /supabase-js@2["?]/, name);
        assert.match(source, /supabase-js@2\.106\.2/, name);
    }
});

test("sandbox Stripe functions reject live secret keys", () => {
    for (const name of ["stripe-ach", "stripe-checkout", "stripe-connect", "stripe-portal", "stripe-webhook"]) {
        const source = readFileSync(
            join(root, "supabase", "functions", name, "index.ts"),
            "utf8",
        );
        assert.match(source, /\^\(sk\|rk\)_test_/, name);
    }
});

test("browser shell limits capabilities and renders toast messages as text", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    const app = readFileSync(join(root, "app.js"), "utf8");
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /object-src 'none'/);
    assert.match(html, /Permissions-Policy/);
    assert.match(app, /messageEl\.textContent = String\(message\)/);
    assert.doesNotMatch(app, /toast\.innerHTML\s*=/);
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(app, /_modalReturnFocus/);
});

test("user-authored browser content is escaped before HTML rendering", () => {
    const app = readFileSync(join(root, "app.js"), "utf8");
    const components = readFileSync(join(root, "components.js"), "utf8");

    assert.match(app, /replaceChildren\(\.\.\.hourlyEmps\.map\(e => new Option/);
    assert.doesNotMatch(app, /<option value="\$\{e\.id\}">\$\{e\.name\}<\/option>/);
    for (const field of ["ann.title", "ann.body", "ann.author", "ann.date"]) {
        assert.match(components, new RegExp(`escapeHTML\\(${field.replace(".", "\\.")}\\)`), field);
    }
    for (const field of ["entry.action", "entry.details", "entry.ts", "entry.actor"]) {
        assert.match(components, new RegExp(`escapeHTML\\(${field.replace(".", "\\.")}\\)`), field);
    }
    assert.match(components, /escapeAttr\(d\)/);
    assert.match(components, /escapeHTML\(d\)/);
    assert.match(app, /escapeAttr\(safeInviteLink\)/);
    assert.match(app, /escapeHTML\(safeInviteLink\)/);
    assert.doesNotMatch(app, /navigator\.clipboard\.writeText\(\$\{JSON\.stringify\(result\.inviteLink\)\}/);
});

test("financial and identity actions reject duplicate in-flight requests", () => {
    const app = readFileSync(join(root, "app.js"), "utf8");
    const billing = readFileSync(join(root, "billing.js"), "utf8");

    assert.match(app, /_operations: new Set\(\)/);
    for (const key of [
        "payroll:submit",
        "payroll:approve:",
        "efile:",
        "stripe:connect-onboarding",
        "bank-link:",
        "pay-advance:",
        "employee-invite:",
    ]) assert.match(app, new RegExp(key.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")), key);

    assert.match(billing, /_operations: new Set\(\)/);
    assert.match(billing, /_operations\.has\('checkout'\)/);
    assert.match(billing, /_operations\.has\('portal'\)/);
    assert.match(billing, /finally\s*\{[\s\S]*?_operations\.delete\('portal'\)/);
});

test("payroll invariants lock terminal runs and cross-company line items", () => {
    const migration = readFileSync(
        join(root, "supabase", "migrations", "20260801145644_enforce_payroll_invariants.sql"),
        "utf8",
    );
    assert.match(migration, /Terminal payroll runs are immutable/);
    assert.match(migration, /Invalid payroll transition/);
    assert.match(migration, /Payroll line item tenant mismatch/);
    assert.match(migration, /private\.valid_daily_hours/);
    assert.match(migration, /consume_edge_rate_limit/);
});

test("legacy sandbox rows are covered by validated financial constraints", () => {
    const migration = readFileSync(
        join(root, "supabase", "migrations", "20260801190947_validate_existing_constraints.sql"),
        "utf8",
    );
    assert.match(migration, /ach_transfers_positive_amount/);
    assert.match(migration, /payroll_runs_totals_valid/);
    assert.match(migration, /payroll_line_items_amounts_valid/);
    assert.match(migration, /tax_filing_status_valid/);
    assert.match(migration, /timesheets_hours_valid/);
});

test("local hardening migration versions match deployed Supabase history", () => {
    const expected = [
        "20260801141121_stripe_sandbox_idempotency.sql",
        "20260801142232_restrict_admin_helper.sql",
        "20260801143315_harden_company_authorization.sql",
        "20260801143413_finish_rls_hardening.sql",
        "20260801143505_retire_exposed_auth_helpers.sql",
        "20260801143608_add_fk_indexes_and_optimize_rls.sql",
        "20260801145644_enforce_payroll_invariants.sql",
        "20260801150428_bind_payroll_actors.sql",
        "20260801185616_constrain_tax_filings.sql",
        "20260801190947_validate_existing_constraints.sql",
    ];
    for (const filename of expected) {
        assert.doesNotThrow(() => readFileSync(join(root, "supabase", "migrations", filename), "utf8"), filename);
    }
});

test("authenticated Edge operations enforce payload and rate limits", () => {
    const shared = readFileSync(join(root, "supabase", "functions", "_shared", "security.ts"), "utf8");
    assert.match(shared, /Request body too large/);
    assert.match(shared, /consume_edge_rate_limit/);
    for (const name of edgeFunctions) {
        const source = readFileSync(join(root, "supabase", "functions", name, "index.ts"), "utf8");
        assert.match(source, /enforceUserRateLimit/, name);
        assert.match(source, /readJsonObject/, name);
    }
});
