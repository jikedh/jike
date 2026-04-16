# 项目概览

## 项目类型
Electron 桌面应用（视频工作流处理平台）

## 核心技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node 24, Electron 39 |
| 构建工具 | electron-vite 5, Vite 7 |
| 前端框架 | React 19.2, TypeScript ~5.9 |
| 状态管理 | Zustand 5 |
| UI 框架 | Radix UI, Tailwind CSS 4 |
| 画布/节点 | @xyflow/react 12 |
| 富文本编辑 | Tiptap 3 |
| 3D 全景 | Three.js |
| 拖拽 | @dnd-kit |
| 云存储 | ali-oss |
| HTTP 客户端 | axios |
| 代码格式 | Biome 2.1 |

## 项目主要职责
即刻是一个基于 Electron 的视频工作流处理桌面应用，主进程与渲染进程分离架构，支持节点式工作流编排。

---

# 架构说明

## 整体架构
```
src/
├── main/           # Electron 主进程（Node 端）
│   ├── index.ts    # 入口：窗口创建、IPC 注册、自动更新
│   ├── ipc/        # IPC 处理器（按领域组织）
│   ├── preload.ts  # Preload 脚本
│   └── utils/      # 主进程工具函数
├── preload/        # Context Bridge（仅暴露白名单 API）
├── renderer/       # React 渲染进程
│   ├── api/        # API 请求（AI 等）
│   ├── components/ # React 组件
│   ├── hooks/      # 自定义 Hooks
│   ├── pages/      # 页面组件
│   ├── router/     # 路由配置
│   └── stores/     # Zustand 状态管理
├── service/        # 业务逻辑服务（共享）
└── shared/         # 共享代码（主进程和渲染进程共用）
    ├── constants/   # 常量定义
    ├── types/      # TypeScript 类型定义
    └── utils/      # 工具函数
```

## IPC 通信层
采用领域驱动设计，每个领域有独立的目录：

| 目录 | 职责 |
|------|------|
| `main/ipc/storage/` | 本地文件系统操作 |
| `main/ipc/debug/` | 调试相关 |
| `main/ipc/download/` | 文件下载相关 |

## Preload 安全规范
- **禁止**在 preload 中写业务逻辑
- **禁止**直接暴露 Electron 原始 API
- 所有 API 必须通过 `contextBridge.exposeInMainWorld` 暴露
- 仅允许类型安全的接口

---

# 目录结构

## 主进程 (`src/main/`)

| 路径 | 职责 |
|------|------|
| `main/index.ts` | 主进程入口，只负责：窗口创建、IPC 注册、更新启动 |
| `main/ipc/index.ts` | IPC 通道注册中心 |
| `main/ipc/storage/` | 文件系统操作（读写、目录选择、迁移） |
| `main/ipc/debug/` | DevTools 切换、开发模式判断 |
| `main/ipc/download/` | 文件下载处理 |
| `main/utils/` | 主进程工具函数 |

## 渲染进程 (`src/renderer/`)

| 路径 | 职责 |
|------|------|
| `renderer/components/ui/` | shadcn/ui 风格基础组件 |
| `renderer/components/panorama/` | 全景相关组件 |
| `renderer/hooks/` | 自定义 Hooks（useAgentExecution 等） |
| `renderer/stores/` | Zustand 状态管理 |
| `renderer/router/` | React Router DOM 7 路由配置 |
| `renderer/pages/` | 页面组件 |
| `renderer/api/` | AI 等 API 请求封装 |

## 共享层 (`src/shared/`)

| 路径 | 职责 |
|------|------|
| `shared/types/` | 跨进程 TypeScript 类型定义 |
| `shared/constants/` | 常量定义 |
| `shared/utils/` | 工具函数 |

## 业务服务 (`src/service/`)

| 路径 | 职责 |
|------|------|
| `service/aiRequest.ts` | AI 请求服务 |
| `service/oss.ts` | 阿里云 OSS 上传下载 |
| `service/projectStorage.ts` | 项目存储服务 |
| `service/chatHistoryStorage.ts` | 聊天历史存储 |
| `service/localStorageService.ts` | 本地存储服务 |

---

# 编码规范

## 路径处理
- **必须使用** `path.join` 处理路径，确保跨平台兼容
- **禁止使用** 硬编码路径分隔符（`/` 或 `\`）

## 主进程判断
```typescript
import { app } from 'electron'

if (app.isPackaged) {
  // 生产环境逻辑
} else {
  // 开发环境逻辑
}
```

## IPC 通道定义
IPC 通道必须在三处保持一致：

| 位置 | 文件 | 作用 |
|------|------|------|
| 主进程 | `src/main/ipc/handler/*.ts` | 处理 IPC 请求 |
| 注册 | `src/main/ipc/index.ts` | 注册通道 |
| Preload | `src/preload/index.ts` | 暴露给渲染进程 |

## 组件规范
- 使用 TypeScript 定义 props 类型
- 使用 Tailwind CSS 样式
- 导出函数式组件（React 19）
- 组件文件使用 `*.tsx` 扩展名

## Hooks 规范
- Hooks 存放位置：`src/renderer/hooks/`
- 命名规范：`use` + 功能名称（如 `useCanvasChat`）
- 使用 `const` 箭头函数定义

## 状态管理
- 使用 Zustand 管理状态
- Store 存放在 `src/renderer/stores/`

## API 请求
- 统一放在 `src/renderer/api/` 目录
- 不允许在组件中直接写请求逻辑

---

# 业务逻辑说明

## 核心流程：Agent 执行
```
1. 用户在便签节点输入内容
2. 连接便签节点到 Agent 节点
3. 调用 useAgentExecution Hook
4. 验证父便签存在且内容非空
5. 调用 AI API 生成内容
6. 创建输出节点展示结果
```

## 关键数据结构

### Flow 节点类型
```typescript
type AllNodeType = NoteNode | AgentNode | ImageNode | ...;
type EdgeType = { id: string; source: string; target: string };
```

### Preload 暴露的 API
```typescript
// 存储 API
storage: {
  selectDirectory, ensureProjectDir, writeJson, readJson,
  writeFile, readFile, deleteFile, deleteFolder, fileExists,
  listFiles, downloadFile, renameDirectory, migrateProjects, getDefaultPath
}

// 调试 API
debug: { toggleDevTools, isDev }

// 下载 API
download: { imageAsBuffer, imageAsBase64, imageToFile }
```

---

# AI 编码约束

## 允许修改的文件
- `src/renderer/components/` - UI 组件
- `src/renderer/hooks/` - 自定义 Hooks
- `src/renderer/stores/` - Zustand Store
- `src/renderer/pages/` - 页面组件
- `src/service/` - 业务服务
- `src/shared/` - 共享代码

## 禁止修改的文件
- `src/main/index.ts` - 主进程入口
- `src/preload/index.ts` - Preload 桥接层
- `src/main/ipc/index.ts` - IPC 注册中心
- `electron.vite.config.ts` - 构建配置
- `vite.config.ts` - Vite 配置

## 新代码放置位置
| 代码类型 | 放置位置 |
|----------|----------|
| UI 组件 | `src/renderer/components/` |
| 自定义 Hooks | `src/renderer/hooks/` |
| 状态管理 | `src/renderer/stores/` |
| API 请求 | `src/renderer/api/` |
| 工具函数 | `src/shared/utils/` |
| 类型定义 | `src/shared/types/` |
| IPC 处理器 | `src/main/ipc/<领域>/` |

## 添加新的 IPC 通道
1. 在 `src/main/ipc/handler/<领域>.ts` 添加处理器
2. 在 `src/main/ipc/index.ts` 注册
3. 在 `src/preload/index.ts` 暴露给渲染进程

## 添加新的 UI 组件
- 基础组件模式参考：`src/renderer/components/ui/` 目录
- 组件规范：TypeScript props + Tailwind CSS

---

# 设计模式与约定

## 主进程入口模式
主进程入口文件只负责三件事：
1. **创建窗口** - 使用 `BrowserWindow` 并配置 preload 路径
2. **注册 IPC** - 委托给 `src/main/ipc/` 下的各个领域处理器
3. **启动更新器** - 初始化 electron-updater

## Preload 白名单模式
仅暴露必要的 API 给渲染进程，禁止直接暴露 `window.electron` 原始 API。

## 领域驱动 IPC 设计
每个 IPC 领域有独立的目录，保持关注点分离。

---

# 运行命令

| 命令 | 用途 |
|------|------|
| `npm run dev:electron` | 开发模式启动 Electron |
| `npm run build` | 构建生产环境 |
| `npm run build:win` | 构建 Windows 安装程序 |
| `npm run format` | 自动修复格式（Biome） |
| `npm run lint` | 运行代码检查（Biome） |
| `npm run check-format` | 检查代码格式 |
