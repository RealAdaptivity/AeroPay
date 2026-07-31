/**
 * GlidePay — Environment Configuration
 *
 * Auto-detects sandbox vs. live based on hostname.
 * localhost / 127.0.0.1 / *.local / *.vercel.app preview URLs → sandbox.
 * Everything else (glidepay.org) → live.
 *
 * To force sandbox on any host: add ?sandbox=1 to the URL, or set
 *   localStorage.setItem('aeropay_env', 'sandbox')
 * To force live:
 *   localStorage.setItem('aeropay_env', 'live')
 */

const AeroConfig = (() => {
    const SANDBOX_HOSTS = ["localhost", "127.0.0.1"];
    const isSandboxHost = SANDBOX_HOSTS.includes(location.hostname)
        || location.hostname.endsWith(".local")
        || location.hostname.endsWith(".vercel.app")
        || new URLSearchParams(location.search).get("sandbox") === "1";

    const override = localStorage.getItem("aeropay_env");
    const env = override === "live"    ? "live"
              : override === "sandbox" ? "sandbox"
              : isSandboxHost          ? "sandbox"
              : "live";

    // ── Sandbox (test-mode) config ────────────────────────────────────────────
    // GlidePay Test sandbox (acct …TkoXC…). Price IDs: paste from Dashboard → Products.
    const SANDBOX = {
        stripePublishableKey: "pk_test_51TkoXCAsgAzfeB6D4ktKPKED969ZbEemhjEfXoEybDqh45GFfm5Oflziwkc4QLwfc1IaTNvCojYBqNpRrIMz2Mck00uHoKZHlZ",
        priceBaseId:          "price_REPLACE_WITH_GLIDEPAY_TEST_BASE",
        priceSeatId:          "price_REPLACE_WITH_GLIDEPAY_TEST_SEAT",
        supabaseUrl:          "https://ojvnxnlrghatkwjrlnop.supabase.co",
        // Edge functions are the same URL; secrets on the Supabase side switch
        // between live and test keys via `supabase secrets set`.
        checkoutFunctionUrl:  "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-checkout",
        portalFunctionUrl:    "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-portal",
        achFunctionUrl:       "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-ach",
        connectFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-connect",
        fileTaxFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/file-tax",
    };

    // ── Live config ───────────────────────────────────────────────────────────
    // Fresh Stripe account — fill via scripts/setup-stripe.sh after `stripe login`.
    // Do not reuse keys from a prior AeroPay account.
    const LIVE = {
        stripePublishableKey: "pk_live_REPLACE_WITH_FRESH_ACCOUNT_KEY",
        priceBaseId:          "price_REPLACE_WITH_LIVE_BASE_PRICE",
        priceSeatId:          "price_REPLACE_WITH_LIVE_SEAT_PRICE",
        supabaseUrl:          "https://ojvnxnlrghatkwjrlnop.supabase.co",
        checkoutFunctionUrl:  "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-checkout",
        portalFunctionUrl:    "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-portal",
        achFunctionUrl:       "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-ach",
        connectFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-connect",
        fileTaxFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/file-tax",
    };

    const cfg = env === "sandbox" ? SANDBOX : LIVE;

    if (env === "sandbox") {
        console.info(
            "%c[GlidePay] Running in SANDBOX mode — no real money will move.",
            "background:#f59e0b;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;"
        );
    }

    return { env, ...cfg };
})();
