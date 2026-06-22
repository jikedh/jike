---
description: '即刻（jike）Tauri 桌面应用 - 目录分层与职责精简指令'
applyTo: '**'
---

# 即刻项目 — 目录分层与职责（精简指令）

> 速查版。完整规范见 [AGENTS.md](../../AGENTS.md)。
> 本文件重点：**每个目录放什么、不放什么**。

## 进程分层

| 进程 | 根目录 | 职责 |
| --- | --- | --- |
| 渲染进程 | `src/renderer/` | React 应用（WebView 中运行） |
| 共享层 | `src/shared/` | 渲染 + Rust 共用，**不引用** `react` / `window` / `@tauri-apps/*` |
| 服务层 | `src/service/` | 仅渲染调用的本地存储、OSS、AI 封装 |
| Rust 主进程 | `src-tauri/src/` | Tauri 后端 |

## 一级目录职责速查

| 目录 | 放什么 | 不放什么 |
| --- | --- | --- |
| `src/renderer/api/` | 外部 HTTP 接口封装（按后端命名） | UI 状态、IPC 命令 |
| `src/renderer/services/` | IPC 桥接、Tauri 事件、长连接 | React 状态 |
| `src/renderer/stores/` | Zustand 全局状态（`*Store.ts`） | 业务实现 |
| `src/renderer/hooks/` | `use*` 自定义 Hook | 组件 JSX |
| `src/renderer/components/` | 跨页复用业务组件（PascalCase） | 页面私有组件（应下沉到 `pages/<Page>/components/`） |
| `src/renderer/components/ui/` | **仅** shadcn 基础组件（kebab-case，无业务） | 业务逻辑 |
| `src/renderer/pages/<Page>/` | 一个目录一个路由 | 跨页组件 |
| `src/renderer/assets/` | 被 `import` 的图片/字体/SVG | 仅 URL 直访的资源（→ `public/`） |
| `src/service/` | IndexedDB / OSS / AI 请求封装 | `import` 自 `src/renderer/components/**` |
| `src/shared/constants/` | 跨进程枚举、预设、接口域名 | `window` / `document` / Tauri API / React |
| `src/shared/types/` | 跨进程类型 / DTO | 函数、类、含副作用代码 |
| `src/shared/utils/` | 纯函数工具 | `localStorage`、Tauri API |
| `src-tauri/src/commands/` | `#[tauri::command]` 入口，薄壳转发到 `domain/` | 业务实现细节 |
| `src-tauri/src/domain/` | 业务实现层（可单测） | 直接调用 Tauri API |
| `src-tauri/src/models/` | 仅 `struct` / `enum` + `serde` | 业务逻辑 |
| `src-tauri/capabilities/` | Tauri 2 ACL 权限声明 | 业务代码 |
| `src-tauri/gen/` | Tauri CLI 自动生成 | 手动编辑 |
| `public/` | URL 直访的静态资源 | 业务数据 JSON（→ `shared/constants/`） |
| `docs/` | 结构规范、踩坑记录 | 代码与配置 |

## `src/service/` 子职责

> 定位：与「画布 / 组件 / 路由」解耦的基础设施封装。**禁止** 反向依赖 `src/renderer/components/**`；调用 Tauri 命令时必须经 `src/renderer/services/ipcService.ts`，本层只做数据建模。
>
> 涵盖：AI 请求通用封装（超时 / 重试 / 取消）、资产 / 聊天历史 / 项目 / 分镜的本地持久化（IndexedDB / Tauri Store）、通用 LocalStorage 封装、阿里云 OSS 上传封装。

## `src/shared/constants/` 子职责

> 跨进程枚举、预设、配置常量。必须保持与运行环境无关（无 `window` / `document` / Tauri API / React）。
>
> 涵盖：Agent 预设（按文本 / 图像 / 视频拆分）、AI 模型清单、后端接口域名、画布拖拽阈值、聊天人设、全局枚举（`enum.ts` 用 `as const` + 类型别名）、媒体 MIME 映射、模型积分档位（聚合导出 + 按模型代号懒加载）、积分通用常量、系统提示词。

## `src/shared/types/` 子职责

> 跨进程类型 / DTO。**只能** 导出 `type` / `interface` / `as const`，禁止函数、类、副作用代码。
>
> 涵盖：
>
> - **领域类型**（顶层）：AI 通用、图像生成、Midjourney、笔记生成、上传生成、视频生成、即时主站 DTO、通用消息、存储抽象、全局类型补充。
> - `api/`：按后端域名拆分的 DTO（Bailian、ToApi、Yunwu、Kuaizhi、dashscope、wuhen、score 等）；命名与服务域名一致（小写）。
> - `detail/`：详情域类型（如 score）。
> - `flow/`：画布节点 / 边 / 流的类型定义。
> - `sidebar/`：侧边栏相关类型。
> - `zustand/`：与 store 配套的 state shape / action 类型（canvas-flow / chat-settings / user），只放类型契约，不放 store 实现。

## `src/shared/utils/` 子职责

> 环境无关的纯函数工具。**禁止** 副作用依赖 `window` / `localStorage`（持久化需求交给 `service/`）。
>
> 涵盖：
>
> - **媒体处理**：Base64 转图片、图片压缩、视频封面、视频时长探测、媒体持久化辅助、媒体序列处理。
> - **画布工具**：复制粘贴、分组、节点复制、节点工厂、React Flow 工具。
> - **业务工具**：全景相关、通用请求错误处理、视频响应归一化。
> - `utils.ts`：杂项（保持最小集，新功能优先单独建文件）。

## 路径别名（强制使用）

| 别名 | 实际路径 |
| --- | --- |
| `@/*` | `src/renderer/*` |
| `shared/*` | `src/shared/*` |
| `service/*` | `src/service/*` |

## 新文件落位判定（按顺序）

1. **仅 Rust 使用？** → `src-tauri/src/{models|domain|commands}/`
2. **Rust + 渲染共用？** → `src/shared/{types|constants|utils}/`
3. **渲染内部共用（React/DOM/Tauri）？** → `src/renderer/{hooks|services|stores|utils}/`
4. **跨页面复用组件？** → `src/renderer/components/`
5. **页面私有？** → `src/renderer/pages/<Page>/components/`
6. **静态资源？** → `src/renderer/assets/`（import）或 `public/`（URL 直访）
7. **本地存储/网络封装？** → `src/service/`

> **先下沉，再上浮**。模糊地带先放 `shared/`，依赖收紧后再上移。

## 跨进程同步约束

- 跨进程类型/枚举/常量 **必须** 放 `src/shared/`，禁止在 Rust 与 TS 两侧重复定义。
- 新增 `#[tauri::command]` 后必须 4 处同步：
  1. `src-tauri/capabilities/default.json`（ACL）
  2. `src/renderer/services/ipcService.ts`（调用入口）
  3. `src-tauri/src/commands/mod.rs`（导出）
  4. 业务实现放 `src-tauri/src/domain/`，`commands/` 仅做薄壳转发

## 修改前自检

- [ ] 文件落点符合上方"落位判定"流程
- [ ] 未在仓库根目录新增业务源码 / Markdown
- [ ] import 使用 `@/` / `shared/` / `service/` 别名
- [ ] 业务组件未放进 `components/ui/`
- [ ] `src/shared/**` 未引用 `react` / `window` / `document` / `@tauri-apps/*`
