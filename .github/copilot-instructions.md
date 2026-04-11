---
name: "Yunyun Workspace"
description: "即刻 (Jike) Electron 桌面应用项目工作区指令"
applyTo: "**"
---

# 即刻 (Jike) - 工作区指令

## 项目概述

这是一个基于 Electron 的桌面应用程序，用于视频工作流处理。项目采用 electron-vite 作为构建工具，React 19 作为前端框架，实现了主进程与渲染进程的分离架构。

---

## 环境要求与运行命令

### 环境要求

- **Node.js 版本**: 24
- **包管理器**: npm（不是 pnpm）
- **Electron 版本**: 39
- **平台**: 主要支持 Windows

### 运行命令

| 命令 | 用途 |
|------|------|
| `npm run dev:electron` | 以开发模式启动 Electron |
| `npm run build` | 构建生产环境打包 |
| `npm run build:win` | 构建 Windows 安装程序 |
| `npm run check-format` | 检查代码格式 |
| `npm run format` | 自动修复格式问题 |
| `npm run lint` | 运行代码检查 |

---

## 目录结构详解

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts            # 入口文件（窗口创建、IPC 注册、自动更新）
│   ├── preload.ts           # Preload 脚本入口（兼容旧路径）
│   ├── ipc/                 # IPC 处理器（按领域组织）
│   │   ├── index.ts         # IPC 注册中心
│   │   ├── ai/              # AI 相关处理器
│   │   ├── debug/           # 调试相关
│   │   ├── download/        # 下载相关
│   │   ├── handler/         # 通用处理器
│   │   │   ├── storage.ts   # 文件系统操作
│   │   │   ├── media.ts     # 媒体处理
│   │   │   ├── module.ts    # 模块管理
│   │   │   └── service.ts   # 业务服务
│   │   ├── media/           # 媒体相关
│   │   ├── module/          # 模块相关
│   │   ├── oss/             # 阿里云 OSS 相关
│   │   ├── service/         # 服务相关
│   │   ├── services/        # 业务服务
│   │   ├── storage/          # 存储相关
│   │   └── utils/            # IPC 工具
│   └── utils/                # 主进程工具函数
│       ├── downloadImage.ts # 图片下载工具
│       └── utils.ts          # 通用工具
│
├── preload/                 # Context Bridge（仅暴露白名单 API）
│   └── index.ts             # Preload 主文件
│
├── renderer/                # React 渲染进程
│   ├── App.tsx              # 根组件
│   ├── main.tsx            # React 入口
│   ├── index.css           # 全局样式（Tailwind）
│   ├── api/                # API 调用（AI 等）
│   ├── assets/             # 静态资源
│   ├── components/         # React 组件
│   │   ├── base-handle.tsx  # 基础 Handle 组件（画布节点）
│   │   ├── button-handle.tsx # 按钮 Handle
│   │   ├── node-search.tsx  # 节点搜索
│   │   ├── ProjectDialog.tsx # 项目对话框
│   │   ├── panorama/        # 全景相关组件
│   │   └── ui/              # shadcn/ui 风格基础组件
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useAgentExecution.ts  # Agent 执行
│   │   ├── useCanvasChat.ts     # 画布聊天
│   │   ├── useCanvasCursor.ts   # 画布光标
│   │   ├── useChatHistory.ts    # 聊天历史
│   │   ├── useMessage.ts        # 消息处理
│   │   ├── useNodeScale.ts      # 节点缩放
│   │   ├── useQrcodePolling.ts  # 二维码轮询
│   │   └── useResizableWidth.ts # 可调整宽度
│   ├── pages/              # 页面组件
│   ├── router/             # 路由配置
│   └── store/              # Zustand 状态管理
│
├── shared/                  # 共享代码（主进程和渲染进程共用）
│   ├── constants/           # 常量定义
│   ├── lib/                # 库代码
│   ├── types/              # TypeScript 类型定义
│   └── utils/               # 工具函数
│
└── service/                 # 业务逻辑服务
    ├── aiRequest.ts         # AI 请求服务
    ├── chatHistoryStorage.ts # 聊天历史存储
    ├── localStorageService.ts # 本地存储服务
    ├── oss.ts               # OSS 服务
    └── projectStorage.ts    # 项目存储服务
```

---

## 核心架构模式

### 主进程入口 (`src/main/index.ts`)

主进程入口文件只负责三件事：

1. **创建窗口** - 使用 `BrowserWindow` 并配置 preload 路径
2. **注册 IPC** - 将 IPC 通道注册委托给 `src/main/ipc/` 下的各个领域处理器
3. **启动更新器** - 初始化 electron-updater 并处理相关事件

```typescript
// 伪代码示例
function createWindow() {
  mainWindow = new BrowserWindow({
    preload: join(__dirname, '../preload/index.js')
  })
}

function registerIpcHandlers() {
  // 委托给各个领域
  aiHandler.register()
  downloadHandler.register()
  storageHandler.register()
}

function initUpdater() {
  autoUpdater.checkForUpdatesAndNotify()
}
```

### IPC 通信层 (`src/main/ipc/`)

IPC 层采用领域驱动设计，每个领域有独立的目录：

| 目录 | 职责 |
|------|------|
| `ai/` | AI 模型调用相关 |
| `download/` | 文件下载相关 |
| `handler/` | 通用业务处理器 |
| `media/` | 媒体处理（视频、音频） |
| `oss/` | 阿里云 OSS 上传下载 |
| `storage/` | 本地文件存储 |

### Preload 桥接层 (`src/preload/index.ts`)

Preload 采用白名单模式，只暴露必要的 API 给渲染进程：

- **禁止**直接暴露 `window.electron` 原始 API
- 所有 API 必须通过 `contextBridge.exposeInMainWorld` 暴露
- 每个暴露的方法必须标注清楚用途

### 渲染进程 (`src/renderer/`)

渲染进程采用 React 19 + TypeScript：

- **状态管理**: Zustand（轻量级、无 boilerplate）
- **样式**: Tailwind CSS 4 + shadcn/ui 组件风格
- **画布**: @xyflow/react（节点式工作流编排）
- **路由**: React Router DOM 7

---

## 技术栈详情

| 类别 | 技术 |
|------|------|
| 运行时 | Node 24, Electron 39 |
| 构建工具 | electron-vite 5, Vite |
| 前端框架 | React 19.2, React DOM 19.2 |
| 语言 | TypeScript |
| 状态管理 | Zustand 5 |
| UI 框架 | Radix UI, Tailwind CSS 4 |
| 画布/节点 | @xyflow/react 12 |
| 富文本编辑 | Tiptap 3 |
| 3D 全景 | Three.js |
| 拖拽 | @dnd-kit |
| 图片裁剪 | react-easy-crop |
| 代码格式 | Biome 2.1 |
| 云存储 | ali-oss |
| HTTP 客户端 | axios |

---

## 重要开发规范

### 1. 路径处理

**必须使用** `path.join` 处理路径，确保跨平台兼容：

```typescript
import { join } from 'path'
const filePath = join(__dirname, 'relative/path')
```

**禁止使用** 硬编码路径分隔符（`/` 或 `\`）。

### 2. 主进程判断

生产环境与开发环境的差异化处理：

```typescript
import { app } from 'electron'

if (app.isPackaged) {
  // 生产环境逻辑
} else {
  // 开发环境逻辑
}
```

### 3. IPC 通道定义

IPC 通道必须在三处保持一致：

| 位置 | 文件 | 作用 |
|------|------|------|
| 主进程 | `src/main/ipc/handler/*.ts` | 处理 IPC 请求 |
| 注册 | `src/main/ipc/index.ts` | 注册通道 |
| Preload | `src/preload/index.ts` | 暴露给渲染进程 |

### 4. Preload 安全规范

- **禁止**在 preload 中写业务逻辑
- **禁止**直接暴露 Electron 原始 API
- **禁止**使用 `eval` 或动态代码执行
- 仅允许通过 `contextBridge` 暴露类型安全的接口

---

## 常见开发任务

### 添加新的 IPC 通道

假设要添加一个 `storage` 领域的 `saveProject` 通道：

**步骤 1**: 在 `src/main/ipc/handler/storage.ts` 添加处理器

```typescript
// filepath: src/main/ipc/handler/storage.ts
ipcMain.handle('storage:saveProject', async (event, projectId: string, data: object) => {
  // 处理逻辑
  return { success: true }
})
```

**步骤 2**: 在 `src/main/ipc/index.ts` 注册

```typescript
// filepath: src/main/ipc/index.ts
import { storageHandler } from './handler/storage'
// 在 setupIpcHandlers 函数中
storageHandler.register()
```

**步骤 3**: 在 `src/preload/index.ts` 暴露给渲染进程

```typescript
// filepath: src/preload/index.ts
contextBridge.exposeInMainWorld('api', {
  storage: {
    saveProject: (projectId: string, data: object) => 
      ipcRenderer.invoke('storage:saveProject', projectId, data)
  }
})
```

### 添加新的 UI 组件

组件存放位置：`src/renderer/components/`

基础组件模式参考：
- `base-handle.tsx` - 画布节点基础 Handle
- `button-handle.tsx` - 按钮 Handle
- `ui/` 目录下参考 shadcn/ui 风格

组件规范：
- 使用 TypeScript 定义 props 类型
- 使用 Tailwind CSS 样式
- 导出函数式组件（React 19）

### 添加新的 Hook

Hooks 存放位置：`src/renderer/hooks/`

命名规范：`use` + 功能名称（如 `useCanvasChat`）

---

## 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 项目需求与待办 | [需求.md](./需求.md) | 项目需求列表和 TODO |
| Electron 主进程 Agent | [.github/agents/electron-main.agent.md](./.github/agents/electron-main.agent.md) | 主进程专项 Agent |
| API 字段过滤器 | [docs/api-field-filter.md](./docs/api-field-filter.md) | API 字段过滤说明 |

---

## 调试技巧

### 主进程调试

开发模式下可以使用 VS Code 调试配置：
- 启动 `npm run dev:electron`
- 在 VS Code 中附加到主进程端口

### 渲染进程调试

- 使用 DevTools（Electron 窗口中按 F12）
- React DevTools 扩展

### IPC 调试

在 `src/main/ipc/index.ts` 中启用日志：
```typescript
console.log('[IPC]', channel, payload)
```

