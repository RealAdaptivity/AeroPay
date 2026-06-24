/**
 * AeroPay — Environment Configuration
 *
 * Auto-detects sandbox vs. live based on hostname.
 * localhost / 127.0.0.1 / *.local / *.vercel.app preview URLs → sandbox.
 * Everything else (aeropay.io) → live.
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
        || new URLSearchParams(location.search).get("sandbox") === "1";

    const override = localStorage.getItem("aeropay_env");
    const env = override === "live"    ? "live"
              : override === "sandbox" ? "sandbox"
              : isSandboxHost          ? "sandbox"
              : "live";

    // ── Sandbox (test-mode) config ────────────────────────────────────────────
    // Replace these values with your Stripe test-mode keys and price IDs.
    // Test price IDs must be created in your Stripe Dashboard (test mode).
    const SANDBOX = {
        stripePublishableKey: "pk_test_51TkoXCAsgAzfeB6D4ktKPKED969ZbEemhjEfXoEybDqh45GFfm5Oflziwkc4QLwfc1IaTNvCojYBqNpRrIMz2Mck00uHoKZHlZ",
        priceBaseId:          "price_REPLACE_WITH_TEST_BASE_PRICE",
        priceSeatId:          "price_REPLACE_WITH_TEST_SEAT_PRICE",
        supabaseUrl:          "https://ojvnxnlrghatkwjrlnop.supabase.co",
        // Edge functions are the same URL; secrets on the Supabase side switch
        // between live and test keys via `supabase secrets set`.
        checkoutFunctionUrl:  "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-checkout",
        portalFunctionUrl:    "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-portal",
        achFunctionUrl:       "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-ach",
        connectFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-connect",
    };

    // ── Live config ───────────────────────────────────────────────────────────
    const LIVE = {
        stripePublishableKey: "pk_live_51ThUrM63pkYFHroZwSp81uptqXfbshYAyng2LMObi4IEgSiwN9WC9vLTXNgethWELkrYf5jfuC5gNOa8bdhq3xA300HfpMxCaz",
        priceBaseId:          "price_1TlwbdPRpbEk768fwPu4TQdW",
        priceSeatId:          "price_1TlwbdPRpbEk768fxCal4aPP",
        supabaseUrl:          "https://ojvnxnlrghatkwjrlnop.supabase.co",
        checkoutFunctionUrl:  "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-checkout",
        portalFunctionUrl:    "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-portal",
        achFunctionUrl:       "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-ach",
        connectFunctionUrl:   "https://ojvnxnlrghatkwjrlnop.supabase.co/functions/v1/stripe-connect",
    };

    const cfg = env === "sandbox" ? SANDBOX : LIVE;

    if (env === "sandbox") {
        console.info(
            "%c[AeroPay] Running in SANDBOX mode — no real money will move.",
            "background:#f59e0b;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;"
        );
    }

    return { env, ...cfg };
})();
