import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const jikeRoot = resolve(__dirname, "..");
const flowProjectRoot = resolve(jikeRoot, "..", "flow2api-main", "flow2api-main");
const defaultDistDir = resolve(flowProjectRoot, "dist", "flow2api");
const sourceDistDir = process.env.FLOW2API_DIST_DIR
  ? resolve(process.env.FLOW2API_DIST_DIR)
  : defaultDistDir;

const targetRoot = resolve(jikeRoot, "resources", "flow2api-main");
const sourceStaticDir = resolve(flowProjectRoot, "static");
const sourceConfigDir = resolve(flowProjectRoot, "config");

function assertExists(path, message) {
  if (!existsSync(path)) {
    throw new Error(message);
  }
}

function copyDirContents(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    const from = join(sourceDir, entry);
    const to = join(targetDir, entry);
    cpSync(from, to, { recursive: true });
  }
}

function main() {
  assertExists(
    sourceDistDir,
    `Flow2API dist 目录不存在: ${sourceDistDir}\n请先运行 flow2api-main 的 Windows 打包脚本。`,
  );

  const exePath = join(sourceDistDir, "flow2api.exe");
  assertExists(exePath, `未找到 flow2api.exe: ${exePath}`);

  rmSync(targetRoot, { recursive: true, force: true });
  mkdirSync(targetRoot, { recursive: true });

  copyDirContents(sourceDistDir, targetRoot);

  if (existsSync(sourceStaticDir) && statSync(sourceStaticDir).isDirectory()) {
    cpSync(sourceStaticDir, join(targetRoot, "static"), { recursive: true });
  }

  if (existsSync(sourceConfigDir) && statSync(sourceConfigDir).isDirectory()) {
    mkdirSync(join(targetRoot, "config"), { recursive: true });
    const exampleConfig = join(sourceConfigDir, "setting_example.toml");
    if (existsSync(exampleConfig)) {
      cpSync(exampleConfig, join(targetRoot, "config", "setting_example.toml"));
    }
  }

  console.log(`[prepare-flow2api] copied resources to ${targetRoot}`);
}

try {
  main();
} catch (error) {
  console.error("[prepare-flow2api] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
