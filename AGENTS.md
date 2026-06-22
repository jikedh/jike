# AGENTS.md

> 即刻（jike）Tauri 桌面应用的 AI 代理协作指南。
> 本文件目标：让 AI 大模型 **快速、准确** 地理解每个目录存放的代码功能以及分层约束。

## 1. 项目速览

- **项目**：即刻（jike）—— 基于 **Tauri 2 + React 19 + TypeScript 5.9** 的桌面端视频工作流工具
- **进程模型**：
  - 渲染进程（Renderer）：`src/renderer/`，运行在 WebView
  - 主进程（Rust）：`src-tauri/src/`
  - 共享层（Shared）：`src/shared/`，渲染 + Rust 共用
  - 服务层（Service）：`src/service/`，仅由渲染进程调用的本地存储 / 网络封装
- **核心命令**：

  | 目标 | 命令 |
  | --- | --- |
  | 安装依赖 | `npm install` |
  | 前端开发 | `npm run dev` |
  | 桌面端开发（Tauri） | `npm run dev:tauri` |
  | 前端打包 | `npm run build` |
  | 桌面端打包 | `npm run build:tauri` |
  | 类型检查 | `npm run type-check` |
  | 格式化 | `npm run format` / `npm run lint` |

  详见 [package.json](./package.json)。

- **环境要求**：Node ≥ 22（见 `package.json#engines`）。

## 2. 目录分层与职责（一级目录速查表）

> 精简指令见 [.github/copilot-instructions.md](./.github/copilot-instructions.md)。下表是 AI 代理最常用的"放哪里"速查。

| 目录 | 进程 | 放什么 | 不允许放 |
| --- | --- | --- | --- |
| `src/renderer/` | 渲染 | React 应用本体（页面、组件、Hook、Store、API、Service） | 跨进程共享类型（→ `src/shared/`） |
| `src/renderer/api/` | 渲染 | 外部 HTTP 接口封装（按后端域名命名） | UI 状态、IPC 命令 |
| `src/renderer/services/` | 渲染 | 渲染 ↔ Rust 的桥接、IPC 封装、长连接 | React 状态 |
| `src/renderer/stores/` | 渲染 | Zustand 等全局状态（`*Store.ts`） | 业务逻辑实现 |
| `src/renderer/hooks/` | 渲染 | `use*` 自定义 React Hook | 组件 JSX |
| `src/renderer/components/ui/` | 渲染 | shadcn/ui 基础组件（kebab-case，无业务） | 业务逻辑 |
| `src/renderer/pages/<Page>/` | 渲染 | 路由级页面（一个目录一个路由） | 跨页复用的组件（应上浮到 `components/`） |
| `src/service/` | 渲染 | 本地存储、OSS、AI 请求等基础设施封装 | 反向依赖 `src/renderer/components/**` |
| `src/shared/constants/` | 共享 | 跨进程枚举、预设、接口域名 | `window`/`document`/Tauri API/React |
| `src/shared/types/` | 共享 | 跨进程类型 / DTO | 函数、类、含副作用的代码 |
| `src/shared/utils/` | 共享 | 纯函数工具（媒体、画布、归一化等） | `localStorage`、Tauri API |
| `src-tauri/src/commands/` | Rust | `#[tauri::command]` 入口，薄壳转发到 `domain/` | 业务实现细节 |
| `src-tauri/src/domain/` | Rust | 业务实现层，可单测 | 直接调用 Tauri API |
| `src-tauri/src/models/` | Rust | 仅 `struct`/`enum` + `serde` | 业务逻辑 |
| `src-tauri/capabilities/` | Rust | Tauri 2 ACL 权限声明 | 业务代码 |
| `src-tauri/gen/` | Rust | Tauri CLI 自动生成 | 手动编辑 |
| `public/` | 静态 | 不经 import 的 URL 直访资源（favicon、社交图） | 业务数据 JSON（→ `shared/constants/`） |
| `src/renderer/assets/` | 静态 | 被 `import` 的图片 / 字体 / SVG | 仅 URL 访问的资源（→ `public/`） |
| `docs/` | 文档 | 结构规范、踩坑记录、模块说明 | 代码与配置文件 |
| `resources/certs/` `resources/icons/` | 资源 | 开发期证书、共享图标 | 私钥 |

## 3. 路径别名（强制使用）

在 `tsconfig.app.json` 与 `vite.config.ts` 中已声明：

| 别名 | 实际路径 | 适用场景 |
| --- | --- | --- |
| `@/*` | `src/renderer/*` | 渲染进程内部互引 |
| `shared/*` | `src/shared/*` | 跨进程共享类型 / 常量 / 工具 |
| `service/*` | `src/service/*` | 渲染进程内的本地存储与网络封装 |

> 特例允许相对路径：同目录 `index.ts` 桶内部、组件与同级 `*.module.css`、`import` 静态资源。

## 4. 命名规范

| 类型 | 风格 | 示例 |
| --- | --- | --- |
| 业务模块目录 | PascalCase | `Canvas/`、`CustomNodes/` |
| React 组件文件 | PascalCase `.tsx` | `CanvasFlow.tsx` |
| Hook 文件 | camelCase `use*.ts(x)` | `useUndoRedo.ts` |
| Store 文件 | camelCase `*Store.ts` | `canvasFlowStore.ts` |
| API / Service 文件 | camelCase `.ts` | `jikeGo.ts` |
| 工具文件 | camelCase `.ts` | `imageCompress.ts` |
| 类型文件 | PascalCase `.ts` | `VideoGeneration.ts` |
| Rust 文件 | snake_case `.rs` | `download_service.rs` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| shadcn 组件 | kebab-case | `command.tsx` |
| 文档目录 / 文件 | PascalCase 目录 + kebab-case 文件 | `FPS Drop/fps-tracing.md` |

> `src/renderer/components/ui/` 内的 shadcn 组件保持 kebab-case；其它业务组件一律 PascalCase。

## 5. 新文件落位判定（AI 代理必须遵循）

按以下顺序判断：

1. **仅 Rust 使用？** → `src-tauri/src/{models|domain|commands}/`
2. **Rust + 渲染共用？** → `src/shared/{types|constants|utils}/`
3. **依赖 React/DOM/Tauri，渲染进程内部共用？** → `src/renderer/{hooks|services|stores|utils}/`
4. **跨页面复用组件？** → `src/renderer/components/`
5. **页面私有？** → `src/renderer/pages/<Page>/components/`
6. **样式 / 静态资源？** → `src/renderer/assets/`（被 import）或 `public/`（URL 直访）
7. **本地存储 / 网络封装？** → `src/service/`

> 原则："**先下沉，再上浮**"。模糊地带先放进 `shared/`，依赖收紧后再上移到 `renderer/` 或 `service/`。

## 6. 跨进程类型同步

- 跨进程类型/枚举/常量 **必须** 放在 `src/shared/`，禁止在 Rust 与 TS 两侧重复定义。
- 新增 `#[tauri::command]` 后必须：
  1. 在 `src-tauri/capabilities/default.json` 中声明 ACL
  2. 在 `src/renderer/services/ipcService.ts` 封装调用入口
  3. 在 `src-tauri/src/commands/mod.rs` 中导出
  4. 业务实现放进 `src-tauri/src/domain/`，`commands/` 仅做薄壳转发

## 7. 已知坑位（构建 / 调试）

- **Tauri 打包白屏**：`vite.config.ts` 的 `manualChunks` 把 `react`/`react-dom`/`scheduler`/`sonner` 强制合并到同一 chunk。**不要**随意拆开，否则生产构建会因模块顶层 `React.createElement` 触发 TDZ 失败。
- **dev 端口**：渲染进程固定 `3004`，与 `src-tauri/tauri.conf.json#build.devUrl` 一致，勿改。
- **后端代理**：`/api` → `https://api.jikeing.com`（`vite.config.ts`）。本地调试 HTTP 接口时走代理。
- **DevTools 与测试页**：`pages/<Page>/DevTools/`、`pages/Test/`、`pages/TestGo/`、`pages/CanvasPlaceholder/` 仅在 `import.meta.env.DEV` 或 `?dev=1` 开关下出现，**禁止**注册到正式路由表。
- **`.env`**：含敏感信息，已加入 `.gitignore`；CI / 协作时通过 `.env.example` 共享变量名。

## 8. 修改代码前 AI 代理自检清单

提交任何修改前，确认以下事项（可与 [.github/copilot-instructions.md](./.github/copilot-instructions.md) 的"修改前自检"对照）：

- [ ] 新文件落点符合本文第 5 节判定流程
- [ ] 未在仓库根目录新增业务源码 / 脚本 / Markdown
- [ ] 跨模块 import 使用 `@/`、`shared/`、`service/` 别名
- [ ] 没有把业务组件放进 `components/ui/`
- [ ] 共享层文件未引用 `window` / `document` / `@tauri-apps/*` / `react`
- [ ] 新增 IPC 命令已在 `capabilities/default.json` 与 `ipcService.ts` 同步
- [ ] `npm run type-check` 与 `npm run lint` 通过

## 9. 相关文档

- 精简指令： [.github/copilot-instructions.md](./.github/copilot-instructions.md)
- 性能排查：[docs/FPS Drop/](./docs/FPS%20Drop/)
- 图像瓦片化方案：[docs/ImageTile/](./docs/ImageTile/)
- 面板/分屏布局：[docs/Pane/](./docs/Pane/)

## 10. 维护说明

- 生效版本：v1.8.5 起
- 维护人：即刻前端架构组
- 本文件与 [.github/copilot-instructions.md](./.github/copilot-instructions.md) 保持一致；目录结构出现变更时，**两者必须同步更新**。
- 旧的 `docs/DIRECTORY_STRUCTURE.md` 已并入精简指令，删除以避免双写漂移。
