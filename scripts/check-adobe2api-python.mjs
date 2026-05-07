import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pythonRoot = join(root, "resources", "python");
const isWin = process.platform === "win32";
const embeddedPythonCandidates = isWin
  ? [join(pythonRoot, "python.exe"), join(pythonRoot, "Scripts", "python.exe")]
  : [join(pythonRoot, "bin", "python3"), join(pythonRoot, "bin", "python")];
const embeddedPython = embeddedPythonCandidates.find((candidate) =>
  existsSync(candidate),
);
const readyMarker = join(pythonRoot, ".jike-adobe2api-python-ready");
const requiredPython = { major: 3, minor: 13 };
const requiredImports = [
  "fastapi",
  "uvicorn",
  "pydantic",
  "requests",
  "curl_cffi",
  "itsdangerous",
  "PIL",
];
const requirements = join(
  root,
  "resources",
  "adobe2api-master",
  "requirements.txt",
);

if (!embeddedPython) {
  console.error(
    `[check-adobe2api-python] missing embedded Python in: ${pythonRoot}`,
  );
  console.error("Run npm run prepare:adobe2api-python first.");
  process.exit(1);
}

if (!existsSync(readyMarker)) {
  console.error(
    `[check-adobe2api-python] missing ready marker: ${readyMarker}`,
  );
  console.error(
    "The Python environment may be incomplete. Run npm run prepare:adobe2api-python again.",
  );
  process.exit(1);
}

const code = [
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
  "print(sys.executable)",
  "print(sys.version)",
  "if errors:",
  "    print('\\n'.join(errors))",
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
