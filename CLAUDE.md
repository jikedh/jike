# CLAUDE.md

## 项目概述

即刻（Jike）是一个基于 Electron 的桌面应用，用于 AI 视频工作流编排。用户通过节点式画布（React Flow）组合图片、视频、音频、文本等素材，借助 AI 模型生成和编辑多媒体内容。

入口文件为 [src/main/index.ts](src/main/index.ts)。启动时创建窗口、注册 IPC 通道、启动自动更新。

---

## 运行、构建和检查

| 命令 | 用途 |
|------|------|
| `npm run dev:electron` | 开发模式启动 Electron |
| `npm run build:win` | 构建 Windows 安装程序 |
| `npm run format` | Biome 自动格式化 |
| `npm run lint` | Biome 代码检查 |
| `npm run check-format` | 格式检查（CI 用） |

- **Node.js 版本**: ≥22（推荐 24）
- **包管理器**: npm（不是 pnpm）
- **代码格式化**: Biome 2.1（缩进 2 空格，详见 [biome.json](biome.json)）
- **不自动运行构建/测试**：修改代码后不要自动执行 build、lint 或 test，除非明确要求。

---

## 目录结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts            # 入口：窗口创建 + IPC 注册 + 自动更新
│   ├── ipc/                # IPC 处理器（按领域组织）
│   │   ├── adobe2api/      # Adobe2API 本地服务管理
│   │   ├── database/       # 数据库操作
│   │   ├── debug/          # 调试工具
│   │   ├── download/       # 文件下载
│   │   ├── storage/        # 本地文件系统操作
│   │   ├── tracking/       # AI 视频生成追踪
│   │   └── video-processing/ # 视频裁剪处理
│   └── modules/            # 主进程模块（database、ipcManager）
│
├── preload/                 # Context Bridge（白名单 API）
│   └── index.ts            # 暴露 storage/debug/download/videoProcessing/adobe2api/tracking
│
├── renderer/                # React 渲染进程
│   ├── api/                # HTTP 请求层（ai.ts, jikeGo.ts, jikeing.ts, wuhen.ts）
│   ├── components/         # 通用组件 + ui/ (shadcn 风格)
│   ├── hooks/              # 自定义 Hooks
│   ├── pages/              # 页面（Canvas 为核心页面）
│   │   └── Canvas/         # 节点式画布
│   │       ├── CustomNodes/ # 自定义节点类型
│   │       ├── CustomEdge/  # 自定义连线
│   │       └── components/  # 画布内组件
│   ├── router/             # React Router（HashRouter）
│   ├── services/           # 业务服务（追踪、图片生成、IPC 封装）
│   ├── stores/             # Zustand 状态管理
│   └── utils/              # 工具函数
│
├── service/                 # 跨进程共享业务逻辑
│   ├── aiRequest.ts        # AI 请求服务
│   ├── projectStorage.ts   # 项目存储服务
│   ├── oss.ts              # OSS 上传
│   └── localStorageService.ts
│
└── shared/                  # 主进程和渲染进程共用
    ├── constants/           # 常量（AI 模型、积分、枚举、Agent 预设）
    ├── types/              # TypeScript 类型定义
    └── utils/              # 工具函数
```

---

## 核心架构

### 进程通信（IPC）

IPC 按领域拆分为独立模块，在 [src/main/ipc/index.ts](src/main/ipc/index.ts) 统一导出注册函数：

| 模块 | 通道前缀 | 职责 |
|------|----------|------|
| storage | `storage:*` | 项目文件 CRUD、媒体读写 |
| debug | `debug:*` | DevTools、版本信息、截图 |
| download | `download:*` | 图片下载（Buffer/Base64/文件） |
| video-processing | `video-processing:*` | 视频裁剪 |
| adobe2api | `adobe2api:*` | Adobe2API 本地服务生命周期 |
| tracking | `tracking:*` | AI 生成任务追踪上报 |

Preload 层通过 `contextBridge.exposeInMainWorld` 暴露为 `window.storage`、`window.debug`、`window.download`、`window.videoProcessing`、`window.adobe2api`、`window.tracking`。

### 画布系统（Canvas）

核心页面 `src/renderer/pages/Canvas/`，基于 `@xyflow/react`：

- **自定义节点类型**：AgentNode、ImageNode、VideoAgentNode、AudioNode、NoteNode、PanoramaNode、TextAgentNode、ImageAgentNode、TableNode
- **状态管理**：`canvasFlowStore.ts`（Zustand）管理节点/边/画布数据
- **持久化**：通过 IPC `storage:saveCanvas` / `storage:loadCanvas` 保存到本地文件系统

### 状态管理

使用 Zustand 5，Store 文件位于 `src/renderer/stores/`：
- `canvasFlowStore.ts` — 画布节点、边、生成状态
- `chatSettingsStore.ts` — 聊天/AI 设置
- `useUserStore.ts` — 用户信息

### 路由

使用 `react-router-dom` 7 的 `createHashRouter`，主要页面：
- `/` → Home（项目列表）
- `/canvas/:projectName` → Canvas（画布编辑）
- `/script`、`/assets`、`/voice`、`/video`、`/settings`、`/points`、`/login`

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node ≥22, Electron 39 |
| 构建 | electron-vite 5, Vite 7 |
| 前端 | React 19, TypeScript 5.9 |
| 状态 | Zustand 5 |
| 画布 | @xyflow/react 12 |
| UI | Tailwind CSS 4, Radix UI, shadcn/ui 风格 |
| 富文本 | Tiptap 3 |
| 3D | Three.js |
| 拖拽 | @dnd-kit |
| 格式化 | Biome 2.1 |
| HTTP | axios |
| 云存储 | ali-oss |
| 自动更新 | electron-updater |

---

## 开发规范

### 代码风格

- **箭头函数**：组件和 Hooks 统一使用 `const` 箭头函数
- **类型推断**：依赖 TS 自动推断，仅在提升可读性时添加显式类型
- **异常处理**：`catch (error: any)` 统一接收
- **样式**：Tailwind CSS 优先，CSS 变量管理主题；不写 a11y 代码
- **导出**：模块独立导出，不使用集中式 barrel 文件
- **映射驱动**：控制流优先使用 Map/对象映射，减少 if-else

### 路径别名

在 [electron.vite.config.ts](electron.vite.config.ts) 中定义：
- `@` → `src/renderer`
- `shared` → `src/shared`
- `service` → `src/service`
- `main` → `src/main`
- `preload` → `src/preload`

### IPC 新增通道步骤

1. 在 `src/main/ipc/<domain>/` 添加处理器（`ipcMain.handle`）
2. 在 `src/main/ipc/index.ts` 导出注册函数
3. 在 `src/main/index.ts` 调用注册
4. 在 `src/preload/index.ts` 通过 `contextBridge` 暴露
5. 在 `src/shared/types/` 定义对应类型

### Preload 安全

- 禁止在 preload 中写业务逻辑
- 禁止直接暴露 Electron 原始 API
- 所有方法必须通过 `contextBridge.exposeInMainWorld` 暴露

---

## 开发陷阱

1. **单实例锁**：应用使用 `requestSingleInstanceLock()`，第二个实例会直接退出。
2. **webSecurity: false**：开发和生产环境均关闭了 web 安全策略（允许跨域请求）。
3. **sandbox: false**：preload 脚本运行在非沙箱环境。
4. **Adobe2API 服务**：窗口关闭时会自动调用 `adobe2ApiService.stop()`。
5. **HashRouter**：使用 Hash 路由而非 History 路由（Electron 文件协议兼容）。
6. **Canvas 重型页面**：Canvas 页面独立懒加载，内部禁止嵌套子组件以保证渲染性能。
7. **路径处理**：必须使用 `path.join`，禁止硬编码路径分隔符。

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [docs/adobe2api-integration.md](docs/adobe2api-integration.md) | Adobe2API 集成说明 |
| [docs/api-field-filter.md](docs/api-field-filter.md) | API 字段过滤说明 |
| [docs/Electron.md](docs/Electron.md) | Electron 相关文档 |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | 工作区 AI 指令 |
| [.github/agents/electron-main.agent.md](.github/agents/electron-main.agent.md) | 主进程专项 Agent |
