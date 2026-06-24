/**
 * AeroPay — Billing Module
 * Handles Stripe Checkout, Customer Portal, and subscription state.
 *
 * Add to index.html AFTER config.js and supabase.js:
 *   <script src="billing.js"></script>
 *
 * Keys and price IDs are resolved from AeroConfig (config.js), which
 * auto-switches between sandbox and live based on hostname.
 *
 * Stripe Price IDs (live):
 *   Base $29/mo  : price_1TjzIk63pkYFHroZF5MNkxjQ
 *   Per seat $4  : price_1TjzIn63pkYFHroZ5OPRo0NM
 */

// All values come from config.js (loaded before this file).
const STRIPE_PUBLISHABLE_KEY = AeroConfig.stripePublishableKey;
const CHECKOUT_FUNCTION_URL  = AeroConfig.checkoutFunctionUrl;
const PORTAL_FUNCTION_URL    = AeroConfig.portalFunctionUrl;
const PRICE_BASE_ID          = AeroConfig.priceBaseId;
const PRICE_SEAT_ID          = AeroConfig.priceSeatId;

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────
const AeroBilling = {

    /**
     * Start a Stripe Checkout session for a new subscription.
     * Redirects the browser to Stripe-hosted Checkout.
     *
     * @param {number} employeeCount  Number of employees (drives seat price quantity)
     */
    async startCheckout(employeeCount = 1) {
        const session = await _sb.auth.getSession();
        const token   = session.data?.session?.access_token;

        if (!token) {
            AeroApp.showToast("Please sign in before subscribing.", "warning");
            return;
        }

        const company = await AeroDB.getCompany();

        const resp = await fetch(CHECKOUT_FUNCTION_URL, {
            method:  "POST",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                companyId:     company.id,
                companyName:   company.name,
                employeeCount: Math.max(1, employeeCount),
                priceBaseId:   PRICE_BASE_ID,
                priceSeatId:   PRICE_SEAT_ID,
                successUrl:    window.location.origin + window.location.pathname + "?checkout=success",
                cancelUrl:     window.location.origin + window.location.pathname + "?checkout=canceled",
            }),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            AeroApp.showToast(err.error || "Failed to start checkout. Please try again.", "danger");
            return;
        }

        const { url } = await resp.json();
        window.location.href = url;
    },

    /**
     * Open the Stripe Customer Portal for the current company.
     * Customers can update payment methods, view invoices, cancel.
     */
    async openPortal() {
        const session = await _sb.auth.getSession();
        const token   = session.data?.session?.access_token;

        if (!token) {
            AeroApp.showToast("Please sign in first.", "warning");
            return;
        }

        const resp = await fetch(PORTAL_FUNCTION_URL, {
            method:  "POST",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                returnUrl: window.location.href,
            }),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            AeroApp.showToast(err.error || "Failed to open billing portal.", "danger");
            return;
        }

        const { url } = await resp.json();
        window.location.href = url;
    },

    /**
     * Fetch the current subscription record from Supabase.
     * Returns null if no subscription exists.
     */
    async getSubscription() {
        const { data, error } = await _sb
            .from("subscriptions")
            .select("*")
            .maybeSingle();

        if (error) {
            console.error("[AeroBilling] getSubscription:", error.message);
            return null;
        }
        return data;
    },

    /**
     * Returns true if the company has an active or trialing subscription.
     */
    async isActive() {
        const sub = await this.getSubscription();
        return sub ? ["active", "trialing"].includes(sub.status) : false;
    },

    /**
     * Update the seat count on the live subscription when employee count changes.
     * Called after addEmployee / deleteEmployee.
     *
     * @param {number} newCount  New total active employee count
     */
    async updateSeatCount(newCount) {
        const session = await _sb.auth.getSession();
        const token   = session.data?.session?.access_token;
        if (!token) return;

        // We call the same checkout function but with action: "update_seats"
        await fetch(CHECKOUT_FUNCTION_URL, {
            method:  "POST",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                action:       "update_seats",
                employeeCount: Math.max(1, newCount),
            }),
        });
        // Fire-and-forget — webhook will sync the result
    },

    /**
     * Render a billing banner in the app when subscription is inactive.
     * Call this from _loadStateAndNavigate after state is loaded.
     */
    async renderBillingBanner() {
        const sub     = await this.getSubscription();
        const banner  = document.getElementById("aeroBillingBanner");
        if (!banner) return;

        if (!sub || sub.status === "incomplete" || sub.status === "incomplete_expired") {
            // Never subscribed
            banner.innerHTML = _buildBanner(
                "warning",
                "⚡ No active subscription — upgrade to unlock payroll processing and ACH disbursements.",
                "Start Free Trial",
                `AeroBilling.startCheckout(${(window.AeroApp?.state?.employees?.length) || 1})`
            );
            banner.style.display = "flex";
        } else if (sub.status === "past_due") {
            banner.innerHTML = _buildBanner(
                "danger",
                "⚠️ Payment failed — update your payment method to prevent service interruption.",
                "Fix Payment",
                "AeroBilling.openPortal()"
            );
            banner.style.display = "flex";
        } else if (sub.status === "canceled") {
            banner.innerHTML = _buildBanner(
                "danger",
                "Subscription canceled — reactivate to continue processing payroll.",
                "Reactivate",
                `AeroBilling.startCheckout(${(window.AeroApp?.state?.employees?.length) || 1})`
            );
            banner.style.display = "flex";
        } else {
            // active / trialing — hide banner
            banner.style.display = "none";
        }
    },

    /**
     * Handle redirect back from Stripe Checkout (?checkout=success|canceled).
     * Call once on page load.
     */
    handleCheckoutReturn() {
        const params = new URLSearchParams(window.location.search);
        if (params.get("checkout") === "success") {
            AeroApp.showToast("🎉 Subscription activated! Welcome to AeroPay.", "success");
            // Clean the URL
            window.history.replaceState({}, "", window.location.pathname);
            // Give webhook a moment then refresh billing banner
            setTimeout(() => AeroBilling.renderBillingBanner(), 3000);
        } else if (params.get("checkout") === "canceled") {
            AeroApp.showToast("Checkout canceled — no charges were made.", "info");
            window.history.replaceState({}, "", window.location.pathname);
        }
    },

    /**
     * Render the full Billing Settings view (injected into the settings panel).
     */
    async renderBillingView() {
        const sub = await this.getSubscription();
        const employeeCount = window.AeroApp?.state?.employees?.length || 1;
        const monthlyTotal  = sub?.status === "active"
            ? (29 + (sub.seat_count * 4)).toFixed(2)
            : (29 + (employeeCount * 4)).toFixed(2);

        const statusBadge = sub ? _statusBadge(sub.status) : _statusBadge("none");
        const periodEnd   = sub?.current_period_end
            ? new Date(sub.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : "—";

        return `
        <div class="card" style="max-width:680px;">
            <div class="section-title">
                <span>Subscription & Billing</span>
                ${statusBadge}
            </div>

            ${!sub || ["incomplete","incomplete_expired","canceled","none"].includes(sub?.status ?? "none") ? `
            <!-- No active plan -->
            <div style="padding:24px; text-align:center; border:1px dashed var(--border-color); border-radius:var(--radius-md); margin-bottom:24px;">
                <div style="font-size:32px; margin-bottom:12px;">🚀</div>
                <h3 style="font-family:var(--font-heading); margin-bottom:8px;">Start your AeroPay subscription</h3>
                <p style="font-size:14px; color:var(--text-secondary); margin-bottom:20px;">
                    $29/mo base + $4/employee · Instant activation · Cancel any time
                </p>
                <div style="display:flex; justify-content:center; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
                    <div class="billing-feature-pill">✓ Unlimited payroll runs</div>
                    <div class="billing-feature-pill">✓ Same-Day ACH</div>
                    <div class="billing-feature-pill">✓ W-2 & 1099 e-filing</div>
                    <div class="billing-feature-pill">✓ Tax compliance</div>
                </div>
                <button class="btn btn-primary" style="min-width:200px;" onclick="AeroBilling.startCheckout(${employeeCount})">
                    Subscribe Now — $${monthlyTotal}/mo
                </button>
                <p style="font-size:11px; color:var(--text-tertiary); margin-top:10px;">
                    Secured by Stripe · 256-bit SSL encryption
                </p>
            </div>
            ` : `
            <!-- Active plan -->
            <div class="billing-info-grid">
                <div class="billing-info-item">
                    <span class="billing-info-label">Plan</span>
                    <span class="billing-info-value">AeroPay — ${sub.seat_count} seat${sub.seat_count !== 1 ? "s" : ""}</span>
                </div>
                <div class="billing-info-item">
                    <span class="billing-info-label">Monthly Total</span>
                    <span class="billing-info-value">$${monthlyTotal}</span>
                </div>
                <div class="billing-info-item">
                    <span class="billing-info-label">Next Billing Date</span>
                    <span class="billing-info-value">${periodEnd}</span>
                </div>
                <div class="billing-info-item">
                    <span class="billing-info-label">Cancel at Period End</span>
                    <span class="billing-info-value">${sub.cancel_at_period_end ? "Yes — access until " + periodEnd : "No"}</span>
                </div>
            </div>

            <div style="margin-top:20px; padding-top:20px; border-top:1px solid var(--border-color); display:flex; gap:12px; flex-wrap:wrap;">
                <button class="btn btn-secondary" onclick="AeroBilling.openPortal()">
                    Manage Billing & Invoices
                </button>
                <button class="btn btn-secondary" onclick="AeroBilling.openPortal()">
                    Update Payment Method
                </button>
            </div>
            `}

            <!-- Pricing breakdown -->
            <div style="margin-top:24px; padding-top:20px; border-top:1px solid var(--border-color);">
                <p style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:12px;">Pricing Breakdown</p>
                <div style="display:flex; flex-direction:column; gap:8px; font-size:13px; color:var(--text-secondary);">
                    <div style="display:flex; justify-content:space-between;">
                        <span>Base platform fee</span>
                        <span style="font-weight:600; color:var(--text-primary);">$29.00 / mo</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>Per employee (${employeeCount} × $4.00)</span>
                        <span style="font-weight:600; color:var(--text-primary);">$${(employeeCount * 4).toFixed(2)} / mo</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid var(--border-color); font-weight:700; color:var(--text-primary);">
                        <span>Estimated monthly total</span>
                        <span>$${monthlyTotal}</span>
                    </div>
                </div>
            </div>
        </div>`;
    },
};

// ─────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────

function _buildBanner(type, message, btnLabel, btnAction) {
    const colors = {
        warning: { bg: "var(--warning-light)", border: "var(--warning)", text: "#92400e" },
        danger:  { bg: "var(--danger-light)",  border: "var(--danger)",  text: "#991b1b" },
    };
    const c = colors[type] || colors.warning;
    return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
                    background:${c.bg};border:1px solid ${c.border};border-radius:var(--radius-md);
                    padding:12px 16px;color:${c.text};font-size:13px;font-weight:500;width:100%;box-sizing:border-box;">
            <span>${message}</span>
            <button class="btn btn-secondary" style="white-space:nowrap;flex-shrink:0;" onclick="${btnAction}">
                ${btnLabel}
            </button>
        </div>`;
}

function _statusBadge(status) {
    const map = {
        active:             { label: "Active",            color: "var(--success)",  bg: "var(--success-light)"  },
        trialing:           { label: "Trial",             color: "#3b82f6",         bg: "#eff6ff"               },
        past_due:           { label: "Past Due",          color: "var(--danger)",   bg: "var(--danger-light)"   },
        canceled:           { label: "Canceled",          color: "var(--text-tertiary)", bg: "var(--bg-tertiary)" },
        incomplete:         { label: "Incomplete",        color: "var(--warning)",  bg: "var(--warning-light)"  },
        incomplete_expired: { label: "Expired",           color: "var(--danger)",   bg: "var(--danger-light)"   },
        unpaid:             { label: "Unpaid",            color: "var(--danger)",   bg: "var(--danger-light)"   },
        paused:             { label: "Paused",            color: "var(--warning)",  bg: "var(--warning-light)"  },
        none:               { label: "No Subscription",  color: "var(--text-tertiary)", bg: "var(--bg-tertiary)" },
    };
    const s = map[status] || map.none;
    return `<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:var(--radius-full);
                         background:${s.bg};color:${s.color};">${s.label}</span>`;
}
