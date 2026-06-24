---
name: version-bump
description: 统一调整即刻（jike）项目的版本号。同时更新 package.json、src-tauri/Cargo.toml、src-tauri/tauri.conf.json 三处版本声明。
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
3. 无需额外构建或测试——版本号仅影响打包产物元数据。

## 检查清单

- [ ] `package.json` 的 `version` 已更新
- [ ] `src-tauri/Cargo.toml` 的 `version` 已更新
- [ ] `src-tauri/tauri.conf.json` 的 `version` 已更新
- [ ] 三处版本号一致
