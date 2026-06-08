import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const adobeRoot = join(root, "resources", "adobe2api-master");

const requiredPaths = [
  "app.py",
  "requirements.txt",
  "api/routes/admin.py",
  "api/routes/generation.py",
  "core/adobe_client.py",
  "core/models/catalog.py",
  "core/models/payloads.py",
  "core/models/resolver.py",
  "static/admin.html",
  "static/admin.js",
  "static/login.html",
];

const forbiddenPaths = [
  "config/config.json",
  "config/tokens.json",
  "config/refresh_profile.json",
  "tokens.json",
  "data/request_logs.jsonl",
  "data/request_errors.jsonl",
];

const missing = requiredPaths.filter((path) => !existsSync(join(adobeRoot, path)));
const presentForbidden = forbiddenPaths.filter((path) =>
  existsSync(join(adobeRoot, path)),
);

if (missing.length > 0) {
  console.error("[check-adobe2api] missing required files:");
  for (const path of missing) {
    console.error(`  - ${path}`);
  }
  process.exit(1);
}

if (presentForbidden.length > 0) {
  console.warn("[check-adobe2api] runtime/private files are present locally:");
  for (const path of presentForbidden) {
    console.warn(`  - ${path}`);
  }
  console.warn(
    "[check-adobe2api] they are ignored by resources/adobe2api-master/.gitignore and excluded from packaging.",
  );
}

console.log(`[check-adobe2api] resources OK: ${adobeRoot}`);
