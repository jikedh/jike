import { spawnSync } from "node:child_process";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const pythonRoot = join(root, "resources", "python");
const requirements = join(
  root,
  "resources",
  "adobe2api-master",
  "requirements.txt",
);
const isWin = process.platform === "win32";
const requiredPython = { major: 3, minor: 13 };
const hostPythonCandidates = process.env.PYTHON
  ? [{ command: process.env.PYTHON, args: [] }]
  : isWin
    ? [
        { command: "py", args: ["-3.13"] },
        { command: "python", args: [] },
      ]
    : [
        { command: "python3.13", args: [] },
        { command: "python", args: [] },
      ];
let selectedHostPython = null;
const embeddedPython = isWin
  ? join(pythonRoot, "python.exe")
  : join(pythonRoot, "bin", "python3");
const readyMarker = join(pythonRoot, ".jike-adobe2api-python-ready");

const requiredImports = [
  "fastapi",
  "uvicorn",
  "pydantic",
  "requests",
  "curl_cffi",
  "itsdangerous",
  "PIL",
];

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
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}`,
    );
  }
  return result;
}

function hostPythonLabel(candidate) {
  return [candidate.command, ...candidate.args].join(" ");
}

function runHostPython(args, options = {}) {
  if (!selectedHostPython) {
    throw new Error("Host Python has not been selected");
  }
  return run(
    selectedHostPython.command,
    [...selectedHostPython.args, ...args],
    options,
  );
}

function validationCode() {
  return [
    "import importlib.metadata as md, pathlib, re, sys",
    `required=(${requiredPython.major}, ${requiredPython.minor})`,
    "errors=[]",
    "if sys.version_info[:2] != required:",
    "    errors.append(f'Expected Python {required[0]}.{required[1]}, got {sys.version}')",
    `mods=${JSON.stringify(requiredImports)}`,
    "for m in mods:",
    "    try: __import__(m)",
    "    except Exception as e: errors.append(f'{m}: {e}')",
    `requirements_path=pathlib.Path(${JSON.stringify(requirements)})`,
    "for line in requirements_path.read_text(encoding='utf-8').splitlines():",
    "    line=line.strip()",
    "    if not line or line.startswith('#'): continue",
    "    match=re.match(r'^([A-Za-z0-9_.-]+)==([^;\\s]+)', line)",
    "    if not match: continue",
    "    name, expected = match.groups()",
    "    try: actual = md.version(name)",
    "    except Exception as e: errors.append(f'{name}: {e}'); continue",
    "    if actual != expected:",
    "        errors.append(f'{name}: expected {expected}, got {actual}')",
    "if errors:",
    "    print('\\n'.join(errors))",
    "    raise SystemExit(1)",
  ].join("\n");
}

function isEmbeddedPythonReady() {
  if (!existsSync(readyMarker) || !existsSync(embeddedPython)) {
    return false;
  }

  const result = spawnSync(embeddedPython, ["-c", validationCode()], {
    stdio: "ignore",
    shell: false,
  });

  return !result.error && result.status === 0;
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
  let lastError = null;
  for (const candidate of hostPythonCandidates) {
    try {
      const result = run(candidate.command, [...candidate.args, "-c", code], {
        stdio: "pipe",
        encoding: "utf-8",
      });
      const info = JSON.parse(result.stdout);
      if (
        info.major === requiredPython.major &&
        info.minor === requiredPython.minor
      ) {
        selectedHostPython = candidate;
        return info;
      }
      lastError = new Error(
        `${hostPythonLabel(candidate)} is Python ${info.major}.${info.minor}`,
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Unable to find Python ${requiredPython.major}.${requiredPython.minor}. Last error: ${
      lastError instanceof Error ? lastError.message : lastError
    }`,
  );
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
  const result = runHostPython(["-c", code, requirementsPath], {
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
        filter: (source) =>
          !source
            .split(/[\\/]/)
            .some((part) => excludedRuntimeEntries.has(part)),
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
    : join(
        pythonRoot,
        "lib",
        `python${info.major}.${info.minor}`,
        "site-packages",
      );
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
    runHostPython(["-m", "venv", pythonRoot]);
  }
}

if (!existsSync(requirements)) {
  throw new Error(`Missing Adobe2API requirements: ${requirements}`);
}

if (isEmbeddedPythonReady()) {
  console.log(
    `[prepare-adobe2api-python] existing embedded Python ready: ${embeddedPython}`,
  );
  process.exit(0);
}

const info = hostPythonInfo();
if (
  info.major !== requiredPython.major ||
  info.minor !== requiredPython.minor
) {
  throw new Error(
    `Adobe2API embedded Python must be ${requiredPython.major}.${requiredPython.minor}; got ${info.major}.${info.minor} from ${info.executable}`,
  );
}
prepareRuntime(info);
const copiedFromHost = copyHostDistributions(info);

try {
  run(embeddedPython, ["-c", validationCode()]);
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
  run(embeddedPython, ["-c", validationCode()]);
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

console.log(
  `[prepare-adobe2api-python] embedded Python ready: ${embeddedPython}`,
);
