import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pythonRoot = join(root, "resources", "python");
const grokRoot = join(root, "resources", "grok2api-main");
const pyproject = join(grokRoot, "pyproject.toml");
const isWin = process.platform === "win32";
const embeddedPython = isWin
  ? join(pythonRoot, "python.exe")
  : join(pythonRoot, "bin", "python3");
const venvRoot = join(grokRoot, ".venv");
const venvPython = isWin
  ? join(venvRoot, "Scripts", "python.exe")
  : join(venvRoot, "bin", "python3");
const readyMarker = join(grokRoot, ".jike-grok2api-python-ready");
const pythonEnv = { ...process.env, PYTHONNOUSERSITE: "1" };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio ?? "inherit",
    shell: false,
    encoding: options.encoding,
    env: options.env ?? pythonEnv,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
  return result;
}

function validationCode() {
  return [
    "import sys",
    "mods=['aiohttp','aiohttp_socks','aiomysql','asyncpg','certifi','cryptography','curl_cffi','dotenv','fastapi','granian','greenlet','itsdangerous','loguru','orjson','PIL','pydantic','redis','requests','sqlalchemy','starlette','tiktoken','tomli_w','uvicorn']",
    "errors=[]",
    "for m in mods:",
    "    try: __import__(m)",
    "    except Exception as e: errors.append(f'{m}: {e}')",
    "if errors:",
    "    print('\\n'.join(errors))",
    "    raise SystemExit(1)",
  ].join("\n");
}

function isReady() {
  if (!existsSync(readyMarker) || !existsSync(venvPython)) {
    return false;
  }
  const result = spawnSync(venvPython, ["-c", validationCode()], {
    cwd: grokRoot,
    stdio: "ignore",
    shell: false,
    env: pythonEnv,
  });
  return !result.error && result.status === 0;
}

function readDependencies() {
  const code = [
    "import json, pathlib, tomllib",
    "data=tomllib.loads(pathlib.Path('pyproject.toml').read_text(encoding='utf-8'))",
    "print(json.dumps(data['project']['dependencies']))",
  ].join("\n");
  const result = run(embeddedPython, ["-c", code], {
    cwd: grokRoot,
    stdio: "pipe",
    encoding: "utf-8",
  });
  return JSON.parse(result.stdout);
}

if (!existsSync(embeddedPython)) {
  throw new Error(
    `Missing embedded Python: ${embeddedPython}. Run npm run prepare:adobe2api-python first.`,
  );
}

if (!existsSync(pyproject)) {
  throw new Error(`Missing Grok2API pyproject: ${pyproject}`);
}

if (isReady()) {
  console.log(`[prepare-grok2api-python] existing Grok2API Python ready: ${venvPython}`);
  process.exit(0);
}

const dependencies = readDependencies();
if (!existsSync(venvPython)) {
  run(embeddedPython, ["-m", "venv", venvRoot]);
}
run(venvPython, ["-m", "ensurepip", "--upgrade"]);
run(venvPython, ["-m", "pip", "install", "--no-user", ...dependencies]);
run(venvPython, ["-c", validationCode()], { cwd: grokRoot });

writeFileSync(
  readyMarker,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      venvPython,
      grokRoot,
    },
    null,
    2,
  ),
  "utf-8",
);

console.log(`[prepare-grok2api-python] Grok2API Python ready: ${venvPython}`);
