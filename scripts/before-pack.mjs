import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const steps = [
  ["prepare-adobe2api-python.mjs", "prepare embedded Python"],
  ["prepare-grok2api-python.mjs", "prepare Grok2API Python dependencies"],
  ["check-adobe2api-resources.mjs", "check Adobe2API resources"],
  ["check-adobe2api-python.mjs", "check embedded Python"],
  ["check-grok2api-python.mjs", "check Grok2API Python dependencies"],
];

export default async function beforePack() {
  for (const [script, label] of steps) {
    console.log(`[before-pack] ${label}`);
    const result = spawnSync(process.execPath, [resolve(__dirname, script)], {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`[before-pack] ${label} failed with ${result.status}`);
    }
  }
}
