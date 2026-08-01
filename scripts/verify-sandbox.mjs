const supabaseUrl = (process.env.SANDBOX_SUPABASE_URL
    || "https://ojvnxnlrghatkwjrlnop.supabase.co").replace(/\/$/, "");
const allowedOrigin = process.env.SANDBOX_ORIGIN || "http://localhost:5500";

const authenticatedFunctions = [
    "stripe-checkout",
    "stripe-portal",
    "stripe-connect",
    "stripe-ach",
    "file-tax",
    "invite-employee",
];

let failures = 0;

function pass(message) {
    console.log(`PASS ${message}`);
}

function fail(message) {
    failures += 1;
    console.error(`FAIL ${message}`);
}

for (const name of authenticatedFunctions) {
    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
            method: "OPTIONS",
            headers: {
                Origin: allowedOrigin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        });
        const origin = response.headers.get("access-control-allow-origin");
        if (response.ok && origin === allowedOrigin) {
            pass(`${name} preflight allows only the configured sandbox origin`);
        } else {
            fail(`${name} preflight returned ${response.status}, origin=${origin || "missing"}`);
        }
    } catch (error) {
        fail(`${name} is unreachable: ${error.message}`);
    }
}

try {
    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    if (response.status === 400) {
        pass("stripe-webhook rejects unsigned requests");
    } else {
        fail(`stripe-webhook returned ${response.status} for an unsigned request`);
    }
} catch (error) {
    fail(`stripe-webhook is unreachable: ${error.message}`);
}

if (failures) {
    console.error(`\nSandbox preflight failed (${failures} check${failures === 1 ? "" : "s"}).`);
    process.exit(1);
}

console.log("\nSandbox endpoint preflight passed. Continue with SANDBOX_TESTING.md.");
