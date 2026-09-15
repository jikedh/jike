---
name: version-bump
description: "统一调整即刻（jike）项目的版本号；同步更新 package.json、src-tauri/Cargo.toml、src-tauri/tauri.conf.json，并创建发布提交、Git 标签后推送到 origin。Use when: bump version, release, create tag, push release."
applyTo: '**/package.json, **/Cargo.toml, **/tauri.conf.json'
---

# 版本号调整

即刻项目（Tauri 2 + React）的版本号分散在三个文件中，调整时必须同步修改，缺一不可。

## 需要修改的文件

| 文件 | 字段 | 示例 |
| --- | --- | --- |
| `package.json` | `"version"` | `"version": "1.9.5"` |
| `src-tauri/Cargo.toml` | `[package]` → `version` | `version = "1.9.5"` |
| `src-tauri/tauri.conf.json` | `"version"` | `"version": "1.9.5"` |

## 执行步骤

1. 确认目标版本号。
2. 依次修改上述三个文件的版本字段。
3. 复检三处版本号一致；无需额外构建或测试——版本号仅影响打包产物元数据。
4. 发布前检查当前分支不是分离 `HEAD`、已配置 `origin`，且 `v<新版本号>` 标签在本地和远程均不存在；任一检查失败则停止。
5. 仅暂存本次版本调整涉及的三个文件，以 `chore(release): v<新版本号>` 创建提交，避免提交用户已有的无关改动。
6. 创建带注释标签：`git tag -a v<新版本号> -m "Release v<新版本号>"`。
7. 依次推送当前分支和该标签：`git push origin HEAD`、`git push origin v<新版本号>`；禁止使用 `--force`、`--tags` 或覆盖已有标签。

## 检查清单

- [ ] `package.json` 的 `version` 已更新
- [ ] `src-tauri/Cargo.toml` 的 `version` 已更新
- [ ] `src-tauri/tauri.conf.json` 的 `version` 已更新
- [ ] 三处版本号一致
- [ ] 已创建 `chore(release): v<新版本号>` 提交，且不含无关文件
- [ ] 已创建带注释标签 `v<新版本号>`
- [ ] 当前分支与 `v<新版本号>` 已推送至 `origin`
