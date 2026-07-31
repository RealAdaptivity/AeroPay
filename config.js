/**
 * GlidePay — Environment Configuration
 *
 * Auto-detects sandbox vs. live based on hostname.
 * localhost / 127.0.0.1 / *.local / *.vercel.app preview URLs → sandbox.
 * Everything else (glidepay.org) → live — unless live keys/prices are still
 * placeholders, in which case we fall back to sandbox so Checkout works.
 *
 * To force sandbox on any host: add ?sandbox=1 to the URL, or set
 *   localStorage.setItem('aeropay_env', 'sandbox')
 * To force live (only after LIVE keys/prices are filled):
 *   localStorage.setItem('aeropay_env', 'live')
 * Placeholder LIVE prices always fall back to SANDBOX (forced live is cleared).
 */

const AeroConfig = (() => {
    const SANDBOX_HOSTS = ["localhost", "127.0.0.1"];
    const isSandboxHost = SANDBOX_HOSTS.includes(location.hostname)
        || location.hostname.endsWith(".local")
        || location.hostname.endsWith(".vercel.app")
        || location.hostname.endsWith(".github.io")
        || new URLSearchParams(location.search).get("sandbox") === "1";

    // ── Sandbox (test-mode) config ────────────────────────────────────────────
    // GlidePay Test sandbox — acct_1TkoXCAsgAzfeB6D
    const SANDBOX = {
        stripePublishableKey: "pk_test_51TkoXCAsgAzfeB6D4ktKPKED969ZbEemhjEfXoEybDqh45GFfm5Oflziwkc4QLwfc1IaTNvCojYBqNpRrIMz2Mck00uHoKZHlZ",
        priceBaseId:          "price_1TzIdaAsgAzfeB6DKeordaY7",
        priceSeatId:          "price_1TzIdbAsgAzfeB6D0GyWkgXK",
        trialDays:            14,
        supabaseUrl:          "https://ojvnxnlrghatkwjrlnop.supabase.co",
        // Edge functions are the same URL; secrets on the Supabase side switch
        // between live and test keys via `supabase secrets set`.
        checkoutFunctionUrl:  "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-checkout",
        portalFunctionUrl:    "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-portal",
        achFunctionUrl:       "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-ach",
        connectFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-connect",
        fileTaxFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/file-tax",
        inviteEmployeeFunctionUrl: "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/invite-employee",
    };

    // ── Live config ───────────────────────────────────────────────────────────
    // Fresh Stripe account — fill via scripts/setup-stripe.sh after `stripe login`.
    // Do not reuse keys from a prior AeroPay account.
    const LIVE = {
        stripePublishableKey: "pk_live_REPLACE_WITH_FRESH_ACCOUNT_KEY",
        priceBaseId:          "price_REPLACE_WITH_LIVE_BASE_PRICE",
        priceSeatId:          "price_REPLACE_WITH_LIVE_SEAT_PRICE",
        trialDays:            14,
        supabaseUrl:          "https://ojvnxnlrghatkwjrlnop.supabase.co",
        checkoutFunctionUrl:  "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-checkout",
        portalFunctionUrl:    "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-portal",
        achFunctionUrl:       "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-ach",
        connectFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-connect",
        fileTaxFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/file-tax",
        inviteEmployeeFunctionUrl: "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/invite-employee",
    };

    const isPlaceholder = (cfg) =>
        !cfg.stripePublishableKey
        || cfg.stripePublishableKey.includes("REPLACE")
        || !cfg.priceBaseId
        || cfg.priceBaseId.includes("REPLACE")
        || !cfg.priceSeatId
        || cfg.priceSeatId.includes("REPLACE");

    const override = localStorage.getItem("aeropay_env");
    let env = override === "live"    ? "live"
            : override === "sandbox" ? "sandbox"
            : isSandboxHost          ? "sandbox"
            : "live";

    // Never send placeholder LIVE price IDs to Stripe — even if aeropay_env=live.
    // Until real live keys/prices are filled in config.js, always use SANDBOX.
    if (env === "live" && isPlaceholder(LIVE)) {
        console.warn(
            "[GlidePay] Live Stripe keys/prices are still placeholders — using SANDBOX. " +
            "Fill LIVE in config.js for real charges. Clear localStorage aeropay_env if you forced live."
        );
        env = "sandbox";
        try { localStorage.removeItem("aeropay_env"); } catch (_) { /* private mode */ }
    }

    const cfg = env === "sandbox" ? SANDBOX : LIVE;

    if (env === "sandbox") {
        console.info(
            "%c[GlidePay] Running in SANDBOX mode — no real money will move.",
            "background:#f59e0b;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;"
        );
    }

    return { env, ...cfg };
})();
