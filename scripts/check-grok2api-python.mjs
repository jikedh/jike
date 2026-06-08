import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const grokRoot = join(root, "resources", "grok2api-main");
const isWin = process.platform === "win32";
const venvRoot = join(grokRoot, ".venv");
const venvPythonCandidates = isWin
  ? [join(venvRoot, "Scripts", "python.exe")]
  : [join(venvRoot, "bin", "python3"), join(venvRoot, "bin", "python")];
const venvPython = venvPythonCandidates.find((candidate) =>
  existsSync(candidate),
);
const readyMarker = join(grokRoot, ".jike-grok2api-python-ready");
const requiredPython = { major: 3, minor: 13 };
const requiredImports = [
  "aiohttp",
  "aiohttp_socks",
  "aiomysql",
  "asyncpg",
  "certifi",
  "cryptography",
  "curl_cffi",
  "dotenv",
  "fastapi",
  "granian",
  "greenlet",
  "itsdangerous",
  "loguru",
  "orjson",
  "PIL",
  "pydantic",
  "redis",
  "requests",
  "sqlalchemy",
  "starlette",
  "tiktoken",
  "tomli_w",
  "uvicorn",
];

if (!venvPython) {
  console.error(`[check-grok2api-python] missing Grok2API venv in: ${venvRoot}`);
  console.error("Run npm run prepare:grok2api-python first.");
  process.exit(1);
}

if (!existsSync(readyMarker)) {
  console.error(`[check-grok2api-python] missing ready marker: ${readyMarker}`);
  console.error("Run npm run prepare:grok2api-python first.");
  process.exit(1);
}

const code = [
  "import sys",
  `required=(${requiredPython.major}, ${requiredPython.minor})`,
  "errors=[]",
  "if sys.version_info[:2] != required:",
  "    errors.append(f'Expected Python {required[0]}.{required[1]}, got {sys.version}')",
  `mods=${JSON.stringify(requiredImports)}`,
  "for m in mods:",
  "    try: __import__(m)",
  "    except Exception as e: errors.append(f'{m}: {e}')",
  "print(sys.executable)",
  "print(sys.version)",
  "if errors:",
  "    print('\\n'.join(errors))",
  "    raise SystemExit(1)",
].join("\n");

const result = spawnSync(venvPython, ["-c", code], {
  cwd: grokRoot,
  encoding: "utf-8",
  env: { ...process.env, PYTHONNOUSERSITE: "1" },
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

console.log("[check-grok2api-python] Grok2API Python OK");
