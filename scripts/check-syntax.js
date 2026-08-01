const { execFileSync } = require("node:child_process");
const { readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const root = join(__dirname, "..");
const ignored = new Set([".git", "node_modules"]);

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        if (ignored.has(name)) return [];
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

for (const file of walk(root).filter((path) => path.endsWith(".js"))) {
    execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

console.log(`JavaScript syntax check passed (${relative(root, root) || "."}).`);
