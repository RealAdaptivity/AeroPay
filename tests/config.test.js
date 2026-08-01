const test = require("node:test");
const assert = require("node:assert/strict");

const {
    resolveAeroEnvironment,
    isAeroBillingConfigured,
    escapeHTML,
    escapeAttr,
} = require("../config.js");

test("only explicit local development hosts use sandbox", () => {
    assert.equal(resolveAeroEnvironment("localhost"), "sandbox");
    assert.equal(resolveAeroEnvironment("127.0.0.1"), "sandbox");
    assert.equal(resolveAeroEnvironment("glidepay.local"), "sandbox");
});

test("untrusted markup and attribute values are escaped", () => {
    assert.equal(escapeHTML(`<img src=x onerror="alert('x')">`), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;");
    assert.equal(escapeAttr("'`\"&<>"), "&#39;&#96;&quot;&amp;&lt;&gt;");
});

test("all public and preview hosts use live configuration", () => {
    assert.equal(resolveAeroEnvironment("glidepay.org"), "live");
    assert.equal(resolveAeroEnvironment("www.glidepay.org"), "live");
    assert.equal(resolveAeroEnvironment("realadaptivity.github.io"), "live");
    assert.equal(resolveAeroEnvironment("preview.vercel.app"), "live");
});

test("billing configuration rejects placeholders and missing values", () => {
    assert.equal(isAeroBillingConfigured({
        stripePublishableKey: "pk_live_REPLACE",
        priceBaseId: "price_base",
        priceSeatId: "price_seat",
    }), false);
    assert.equal(isAeroBillingConfigured({
        stripePublishableKey: "pk_live_example",
        priceBaseId: "price_base",
        priceSeatId: "price_seat",
    }), true);
});
