import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const jikeRoot = resolve(__dirname, "..");
const sourceRoot = process.env.ADOBE2API_SOURCE_DIR
  ? resolve(process.env.ADOBE2API_SOURCE_DIR)
  : null;
const targetRoot = resolve(jikeRoot, "resources", "adobe2api-master");

const excludedNames = new Set([
  ".git",
  ".github",
  "__pycache__",
  ".pytest_cache",
  "data",
  "tests",
]);

const excludedRelativePaths = new Set([
  "config/config.json",
  "config/tokens.json",
  "config/refresh_profile.json",
  "tokens.json",
]);

function assertExists(path, message) {
  if (!existsSync(path)) {
    throw new Error(message);
  }
}

function copyDirContents(sourceDir, targetDir, relativeDir = "") {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    if (excludedNames.has(entry)) {
      continue;
    }
    const relativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
    if (excludedRelativePaths.has(relativePath)) {
      continue;
    }
    const from = join(sourceDir, entry);
    const to = join(targetDir, entry);
    if (statSync(from).isDirectory()) {
      copyDirContents(from, to, relativePath);
    } else {
      cpSync(from, to);
    }
  }
}

function patchFile(filePath, patcher) {
  const before = readFileSync(filePath, "utf-8");
  const after = patcher(before);
  if (after !== before) {
    writeFileSync(filePath, after, "utf-8");
  }
}

function applyElectronEmbedPatches() {
  patchFile(join(targetRoot, "app.py"), (content) => {
    if (content.includes("ADOBE_EMBED_ADMIN_TOKEN")) {
      return content;
    }
    return content.replace(
      "def _is_admin_authenticated(request: Request) -> bool:\n",
      `def _is_admin_authenticated(request: Request) -> bool:\n    embed_token = str(os.getenv("ADOBE_EMBED_ADMIN_TOKEN") or "").strip()\n    if embed_token:\n        provided_token = str(\n            request.query_params.get("electron_admin_token")\n            or request.headers.get("x-electron-admin-token")\n            or ""\n        ).strip()\n        if provided_token and provided_token == embed_token:\n            return True\n\n`,
    );
  });

  patchFile(join(targetRoot, "api", "routes", "admin.py"), (content) => {
    let next = content;
    next = next.replace(
      `    @router.get("/login", include_in_schema=False)
    def page_login(request: Request):
        if is_admin_authenticated(request):
            return RedirectResponse(url="/")
        return FileResponse(static_dir / "login.html")
`,
      `    @router.get("/login", include_in_schema=False)
    def page_login(request: Request):
        if is_admin_authenticated(request):
            embed_token = str(request.query_params.get("electron_admin_token") or "").strip()
            target_url = (
                f"/?electron_admin_token={embed_token}"
                if embed_token
                else "/"
            )
            return RedirectResponse(url=target_url)
        return FileResponse(static_dir / "login.html")
`,
    );
    next = next.replace(
      `    @router.get("/", include_in_schema=False)
    def page_root(request: Request):
        if not is_admin_authenticated(request):
            return RedirectResponse(url="/login")
        return FileResponse(static_dir / "admin.html")
`,
      `    @router.get("/", include_in_schema=False)
    def page_root(request: Request):
        if not is_admin_authenticated(request):
            embed_token = str(request.query_params.get("electron_admin_token") or "").strip()
            target_url = (
                f"/login?electron_admin_token={embed_token}"
                if embed_token
                else "/login"
            )
            return RedirectResponse(url=target_url)
        return FileResponse(static_dir / "admin.html")
`,
    );
    return next;
  });

  patchFile(join(targetRoot, "static", "admin.js"), (content) => {
    if (content.includes("electronAdminToken")) {
      return content;
    }
    return content
      .replace(
        'document.addEventListener("DOMContentLoaded", async () => {\n',
        `document.addEventListener("DOMContentLoaded", async () => {\n  const electronAdminToken = new URLSearchParams(window.location.search).get("electron_admin_token") || "";\n  if (electronAdminToken && window.history.replaceState) {\n    window.history.replaceState(null, "", window.location.pathname);\n  }\n`,
      )
      .replace(
        "  window.fetch = async (...args) => {\n    const res = await rawFetch(...args);\n",
        `  window.fetch = async (...args) => {\n    if (electronAdminToken) {\n      const [resource, init = {}] = args;\n      const headers = new Headers(init.headers || {});\n      headers.set("x-electron-admin-token", electronAdminToken);\n      args = [resource, { ...init, headers }];\n    }\n    const res = await rawFetch(...args);\n`,
      )
      .replace(
        '      const res = await rawFetch("/api/v1/auth/me", { method: "GET" });\n',
        `      const headers = new Headers();\n      if (electronAdminToken) {\n        headers.set("x-electron-admin-token", electronAdminToken);\n      }\n      const res = await rawFetch("/api/v1/auth/me", { method: "GET", headers });\n`,
      );
  });

  patchFile(join(targetRoot, "static", "login.html"), (content) => {
    if (content.includes("electronAdminToken")) {
      return content;
    }
    return content
      .replace(
        "    (function () {\n",
        `    (function () {\n      const electronAdminToken = new URLSearchParams(window.location.search).get("electron_admin_token") || "";\n`,
      )
      .replace(
        '      const loginMsg = document.getElementById("loginMsg");\n',
        `      const loginMsg = document.getElementById("loginMsg");\n\n      function adminUrl() {\n        return electronAdminToken\n          ? "/?electron_admin_token=" + encodeURIComponent(electronAdminToken)\n          : "/";\n      }\n\n      function authHeaders(extraHeaders) {\n        const headers = new Headers(extraHeaders || {});\n        if (electronAdminToken) {\n          headers.set("x-electron-admin-token", electronAdminToken);\n        }\n        return headers;\n      }\n`,
      )
      .replace(
        '          const res = await fetch("/api/v1/auth/me");\n',
        `          const res = await fetch("/api/v1/auth/me", {\n            headers: authHeaders(),\n          });\n`,
      )
      .replaceAll('window.location.href = "/";', "window.location.href = adminUrl();")
      .replace(
        '            headers: { "Content-Type": "application/json" },\n',
        '            headers: authHeaders({ "Content-Type": "application/json" }),\n',
      );
  });
}

function main() {
  if (sourceRoot) {
    assertExists(
      sourceRoot,
      `adobe2api 源码目录不存在: ${sourceRoot}\n可通过 ADOBE2API_SOURCE_DIR 指定 adobe2api-master 目录。`,
    );
    assertExists(join(sourceRoot, "app.py"), `未找到 app.py: ${sourceRoot}`);
    assertExists(
      join(sourceRoot, "requirements.txt"),
      `未找到 requirements.txt: ${sourceRoot}`,
    );

    rmSync(targetRoot, { recursive: true, force: true });
    mkdirSync(targetRoot, { recursive: true });
    copyDirContents(sourceRoot, targetRoot);
    console.log(`[prepare-adobe2api] copied resources to ${targetRoot}`);
  } else {
    assertExists(
      targetRoot,
      `项目内 adobe2api 资源目录不存在: ${targetRoot}\n如需从外部源码同步，请设置 ADOBE2API_SOURCE_DIR。`,
    );
    assertExists(join(targetRoot, "app.py"), `未找到 app.py: ${targetRoot}`);
    assertExists(
      join(targetRoot, "requirements.txt"),
      `未找到 requirements.txt: ${targetRoot}`,
    );
    console.log(`[prepare-adobe2api] using project resources at ${targetRoot}`);
  }

  applyElectronEmbedPatches();

  console.log("[prepare-adobe2api] resources are ready");
}

try {
  main();
} catch (error) {
  console.error(
    "[prepare-adobe2api] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
