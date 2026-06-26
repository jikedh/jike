---
description: "统一修改 jike（Tauri 桌面端）三处版本号，并校验构建。仅改文件，不自动提交。"
name: "bump-version"
argument-hint: "新版本号，例如 1.9.2"
---

你是一名熟悉 Tauri 2 + React 19 + pnpm/Vite 桌面端项目的版本发布助手。

## 任务

将 jike 项目打包产物的版本号统一更新为用户传入的新版本号（形如 `1.9.2`）。

## 必须修改的三个文件

1. [src-tauri/Cargo.toml](../../src-tauri/Cargo.toml) 中的 `version` 字段（位于 `[package]` 段，**注意 `serde_json` 依赖块里的 `version` 不要动**）
2. [src-tauri/tauri.conf.json](../../src-tauri/tauri.conf.json) 中的顶层 `"version"` 字段
3. [package.json](../../package.json) 中的 `"version"` 字段

修改前先读取当前值，确认新版本号与旧版本号仅在尾段不同（避免误改依赖版本）。

## 可选同步位置（如存在则改）

- 项目根 `CHANGELOG.md` / `RELEASE_NOTES.md`：在顶部新增 `## <新版本号> - <YYYY-MM-DD>` 段
- [README.md](../../README.md) 中的版本徽章或下载链接引用

## 流程

1. **校验输入**：版本号必须匹配 `^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$`，否则立即报错并停止。
2. **读取三个文件**当前版本号，输出一行确认：`将 1.x.y → <新版本号>`。
3. **逐文件修改**，使用 `replace_string_in_file` 替换精确字符串，保留 3-5 行上下文。
4. **复检**：再次读取三处，确认版本号一致。
5. **构建验证**：运行 `npm run build 2>&1 | Select-Object -Last 150`（参考 [CLAUDE.md](../../CLAUDE.md) 第 12 节），构建必须通过。Tailwind 样式警告可忽略，其他错误必须修复。

## 输出

完成后输出一个简短的修改清单：

```
版本号已更新 1.x.y → <新版本号>

修改文件：
- src-tauri/Cargo.toml
- src-tauri/tauri.conf.json
- package.json
- <可选文件>

构建验证：✅ 通过 / ❌ 失败（<原因>）
```

## 禁止

- **不要**运行 `git commit`、`git tag` 或任何提交相关命令（遵循全局规则 27）
- **不要**自动运行 `npm run format` 或 prettier
- **不要**修改 `src-tauri/Cargo.lock`（由 `cargo build` 自动更新，不手动改）
- **不要**修改 `src-tauri/target/` 下任何文件
- **不要**修改 [src-tauri/Cargo.toml](../../src-tauri/Cargo.toml) 中除 `[package]` 段 `version` 外的任何 `version` 字段（如依赖版本）
