const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const ignored = new Set([".git", "node_modules", "check-security.js"]);
const secretPatterns = [
    /\bsk_(?:live|test)_[A-Za-z0-9]{12,}/,
    /\brk_(?:live|test)_[A-Za-z0-9]{12,}/,
    /\bwhsec_[A-Za-z0-9]{12,}/,
    /\bsb_secret_[A-Za-z0-9_-]{12,}/,
];

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        if (ignored.has(name)) return [];
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

const findings = [];
for (const file of walk(root)) {
    if (/\.(png|jpg|jpeg|gif|ico)$/i.test(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const pattern of secretPatterns) {
        if (pattern.test(content)) findings.push(`${relative(root, file)} matches ${pattern}`);
    }
}

if (findings.length) {
    console.error("Potential committed secrets found:\n" + findings.join("\n"));
    process.exit(1);
}

console.log("Secret-pattern scan passed.");
