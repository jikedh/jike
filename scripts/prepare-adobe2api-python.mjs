import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const pythonRoot = join(root, "resources", "python");
const requirements = join(root, "resources", "adobe2api-master", "requirements.txt");
const hostPython = process.env.PYTHON || "python";
const isWin = process.platform === "win32";
const embeddedPython = isWin
  ? join(pythonRoot, "python.exe")
  : join(pythonRoot, "bin", "python3");
const readyMarker = join(pythonRoot, ".jike-adobe2api-python-ready");

const excludedRuntimeEntries = new Set([
  "Doc",
  "include",
  "libs",
  "Scripts",
  "site-packages",
  "tcl",
  "__pycache__",
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio ?? "inherit",
    shell: false,
    encoding: options.encoding,
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

function hostPythonInfo() {
  const code = [
    "import json, sys, sysconfig",
    "print(json.dumps({",
    "  'executable': sys.executable,",
    "  'basePrefix': sys.base_prefix,",
    "  'version': sys.version,",
    "  'major': sys.version_info.major,",
    "  'minor': sys.version_info.minor,",
    "  'purelib': sysconfig.get_paths().get('purelib'),",
    "  'platlib': sysconfig.get_paths().get('platlib'),",
    "}))",
  ].join("\n");
  const result = run(hostPython, ["-c", code], {
    stdio: "pipe",
    encoding: "utf-8",
  });
  return JSON.parse(result.stdout);
}

function hostDistributionFiles(requirementsPath) {
  const code = String.raw`
import importlib.metadata as md
import json
import pathlib
import re
import sys

requirements_path = pathlib.Path(sys.argv[1])
pending = []
for line in requirements_path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    pending.append(re.split(r"[<>=!~;\[]", line, maxsplit=1)[0].strip())

seen = {}

def canonical(name):
    return re.sub(r"[-_.]+", "-", name).lower()

while pending:
    requested = pending.pop(0)
    key = canonical(requested)
    if key in seen:
        continue
    dist = md.distribution(requested)
    dist_name = dist.metadata.get("Name", requested)
    files = []
    for file in dist.files or []:
        src = pathlib.Path(dist.locate_file(file))
        if src.exists() and src.is_file():
            files.append({
                "src": str(src),
                "rel": str(file).replace("\\", "/"),
            })
    seen[canonical(dist_name)] = {
        "name": dist_name,
        "files": files,
    }
    for requirement in dist.requires or []:
        if "extra ==" in requirement or "extra==" in requirement:
            continue
        match = re.match(r"\s*([A-Za-z0-9_.-]+)", requirement)
        if match:
            dep = match.group(1)
            dep_key = canonical(dep)
            if dep_key not in seen:
                pending.append(dep)

print(json.dumps(list(seen.values())))
`;
  const result = run(hostPython, ["-c", code, requirementsPath], {
    stdio: "pipe",
    encoding: "utf-8",
  });
  return JSON.parse(result.stdout);
}

function copyWindowsRuntime(info) {
  mkdirSync(pythonRoot, { recursive: true });

  for (const entry of ["DLLs", "Lib"]) {
    const from = join(info.basePrefix, entry);
    if (existsSync(from)) {
      cpSync(from, join(pythonRoot, entry), {
        recursive: true,
        force: true,
        filter: (source) => !source.split(/[\\/]/).some((part) => excludedRuntimeEntries.has(part)),
      });
    }
  }

  for (const entry of [
    "python.exe",
    "python3.dll",
    `python${info.major}${info.minor}.dll`,
    "vcruntime140.dll",
    "vcruntime140_1.dll",
  ]) {
    const from = join(info.basePrefix, entry);
    if (existsSync(from)) {
      copyFileSync(from, join(pythonRoot, entry));
    }
  }
}

function copyHostDistributions(info) {
  const sitePackagesRoot = isWin
    ? join(pythonRoot, "Lib", "site-packages")
    : join(pythonRoot, "lib", `python${info.major}.${info.minor}`, "site-packages");
  mkdirSync(sitePackagesRoot, { recursive: true });

  let distributions = [];
  try {
    distributions = hostDistributionFiles(requirements);
  } catch (error) {
    console.warn(
      `[prepare-adobe2api-python] host packages are incomplete, falling back to pip install: ${
        error instanceof Error ? error.message : error
      }`,
    );
    return false;
  }
  for (const distribution of distributions) {
    for (const file of distribution.files) {
      const source = file.src;
      const target = join(sitePackagesRoot, file.rel);
      const sourceStat = statSync(source);
      if (!sourceStat.isFile()) {
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
  }

  console.log(
    `[prepare-adobe2api-python] copied ${distributions.length} Python distributions from host site-packages`,
  );
  return true;
}

function prepareRuntime(info) {
  rmSync(pythonRoot, { recursive: true, force: true });

  if (isWin) {
    copyWindowsRuntime(info);
  } else {
    mkdirSync(dirname(pythonRoot), { recursive: true });
    run(hostPython, ["-m", "venv", pythonRoot]);
  }
}

if (!existsSync(requirements)) {
  throw new Error(`Missing Adobe2API requirements: ${requirements}`);
}

const info = hostPythonInfo();
prepareRuntime(info);
const copiedFromHost = copyHostDistributions(info);

try {
  run(embeddedPython, [
    "-c",
    "import fastapi, uvicorn, pydantic, requests, curl_cffi, itsdangerous, PIL",
  ]);
} catch (error) {
  if (copiedFromHost) {
    console.warn(
      `[prepare-adobe2api-python] copied packages failed validation, falling back to pip install: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
  run(embeddedPython, ["-m", "ensurepip", "--upgrade"]);
  run(embeddedPython, ["-m", "pip", "install", "-r", requirements]);
  run(embeddedPython, [
    "-c",
    "import fastapi, uvicorn, pydantic, requests, curl_cffi, itsdangerous, PIL",
  ]);
}

writeFileSync(
  readyMarker,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      hostPython: info.executable,
      hostBasePrefix: info.basePrefix,
      embeddedPython,
      version: info.version,
    },
    null,
    2,
  ),
  "utf-8",
);

console.log(`[prepare-adobe2api-python] embedded Python ready: ${embeddedPython}`);
