import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const pythonRoot = join(root, "resources", "python");
const isWin = process.platform === "win32";
const embeddedPython = isWin
  ? join(pythonRoot, "Scripts", "python.exe")
  : join(pythonRoot, "bin", "python3");
const readyMarker = join(pythonRoot, ".jike-adobe2api-python-ready");

if (!existsSync(embeddedPython)) {
  console.error(`[check-adobe2api-python] missing embedded Python: ${embeddedPython}`);
  console.error("Run npm run prepare:adobe2api-python first.");
  process.exit(1);
}

if (!existsSync(readyMarker)) {
  console.error(`[check-adobe2api-python] missing ready marker: ${readyMarker}`);
  console.error("The Python environment may be incomplete. Run npm run prepare:adobe2api-python again.");
  process.exit(1);
}

const code = [
  "import sys",
  "mods=['fastapi','uvicorn','pydantic','requests','curl_cffi','itsdangerous','PIL']",
  "missing=[]",
  "for m in mods:",
  "    try: __import__(m)",
  "    except Exception as e: missing.append(f'{m}: {e}')",
  "print(sys.executable)",
  "print(sys.version)",
  "if missing:",
  "    print('\\n'.join(missing))",
  "    raise SystemExit(1)",
].join("\n");

const result = spawnSync(embeddedPython, ["-c", code], {
  encoding: "utf-8",
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("[check-adobe2api-python] embedded Python OK");
