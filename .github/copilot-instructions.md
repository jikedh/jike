# 即刻 (Jike) - 工作区 AI 助手指导

> **项目**：视频工作流 Electron 应用
> **版本**：1.1.4
> **主要技术**：React 19 + TypeScript + Electron + Vite + Tailwind CSS

---

## 开发环境要求

### 核心依赖
- **Node.js**：v24.x（必需）
- **包管理器**：npm（非 pnpm）
- **操作系统**：跨平台支持（Electron desktop app）

### 关键开发脚本

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动 Web 开发服务器（Vite，端口 3004） |
| `npm run dev:electron` | 启动 Electron 开发环境 |
| `npm run build` | TypeScript 编译 + Vite 构建（输出到 `out/` 目录） |
| `npm run build:win` | 构建 Windows 可执行文件（.exe） |
| `npm run build:unpack` | 构建解包版本用于测试 |

### Docker 部署
```bash
docker build -t jike .
docker run -d -p 3004:3004 --name jike jike:latest
```

---

## 架构概览

### 项目结构
```
src/
├── main/              # Electron 主进程
├── preload/           # Electron 预加载脚本
├── pages/             # 页面组件（路由）
│   ├── Home/          # 首页
│   ├── Canvas/        # 核心节点编辑画布
│   ├── Settings/      # 设置页面
│   ├── Assets/        # 资源管理
│   └── Video/, Voice/ # 媒体生成
├── components/        # 可复用 React 组件
│   ├── base-handle.tsx       # 节点连接句柄
│   ├── button-handle.tsx      # 按钮句柄
│   ├── node-search.tsx        # 节点搜索工具
│   ├── panorama/              # 全景图相关
│   └── ui/                    # shadcn UI 组件
├── hooks/             # 自定义 React Hooks
│   ├── useCanvasChat.ts       # 画布聊天逻辑
│   ├── useChatHistory.ts      # 聊天历史管理
│   ├── useAgentExecution.ts   # 智能体执行
│   └── useQrcodePolling.ts    # 二维码轮询
├── store/             # Zustand 全局状态
│   ├── canvasFlowStore.ts     # 节点流状态
│   ├── chatSettingsStore.ts   # 聊天设置
│   └── useUserStore.ts        # 用户信息
├── services/          # 业务服务层
├── utils/             # 工具函数
│   ├── aiRequest.ts           # AI API 请求
│   ├── chatHistoryStorage.ts  # 聊天历史持久化
│   ├── oss.ts                 # 阿里 OSS 集成
│   └── projectStorage.ts      # 项目数据持久化
├── types/             # TypeScript 类型定义
│   ├── flow/          # 流程图相关类型
│   ├── ai.ts          # AI 模型和参数类型
│   └── ImageGeneration.ts, VideoGeneration.ts 等
├── constants/         # 常量配置
│   ├── ai-models.ts           # AI 模型列表
│   ├── agent-presets.ts       # 智能体预设
│   ├── system-prompts.ts      # 系统提示词
│   └── apiEndpoints.ts        # API 端点
├── router/            # React Router 配置
└── lib/               # 第三方库封装
    ├── panorama.ts            # 全景库集成
    └── utils.ts               # 通用库函数
```

### 核心技术栈
- **UI 框架**：React 19 + React Router v7 + React DOM
- **样式**：Tailwind CSS v4 + shadcn/ui + Framer Motion
- **状态管理**：Zustand（轻量级，分布式 store）
- **节点图编辑**：@xyflow/react（可视化流程编辑）
- **拖拽**：@dnd-kit（drag-and-drop）
- **文本编辑**：TipTap（富文本编辑器）
- **3D 渲染**：Three.js
- **桌面应用**：Electron v39 + electron-vite
- **构建**：Vite v7 + electron-builder
- **代码混淆**：vite-plugin-obfuscator（生产环境）

---

## 开发约定与模式

### 1. 状态管理（Zustand）
采用 Zustand 做全局状态，store 分布在 `src/store/` 目录，遵循：

```typescript
// 示例模式（来自 canvasFlowStore.ts）
const useCanvasFlowStore = create((set) => ({
  nodes: [],
  edges: [],
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  // ...
}));
```

**约定**：每个 store 是独立的，使用 `useXxxStore` 命名，组件通过 hooks 获取状态。

### 2. 自定义 Hooks（src/hooks/）
提供业务逻辑的可复用 hooks，如：
- `useCanvasChat`：管理画布聊天交互
- `useAgentExecution`：执行智能体任务（生成图片、视频等）
- `useQrcodePolling`：轮询二维码结果

**约定**：Hook 处理副作用、网络请求、状态同步，保持组件简洁。

### 3. API 请求与代理
开发环境配置代理（vite.config.ts）：

```
/v1/        → https://toapis.com (AI 服务)
/mj/        → https://zeakai-api.api4midjourney.com (Midjourney)
/lz/        → https://aiopenapi.kuaizi.cn/ai-open-platform-api/v1 (快手 AI)
/api/       → https://api.jikeing.com (后端 API)
```

**约定**：使用 `utils/aiRequest.ts` 封装 axios 请求，统一错误处理。

### 4. 类型定义（src/types/）
- 将所有 TypeScript 类型集中在 `src/types/` 目录
- AI 相关：`ai.ts`, `ImageGeneration.ts`, `VideoGeneration.ts`, `MJGeneration.ts`
- 流程图：`flow/` 子目录
- component 相关：`components/` 子目录

**约定**：优先导入 `@/types` 下的类型，减少循环依赖。

### 5. 组件约定（src/components/）
- 使用 **shadcn/ui** 组件库（已安装）
- 自定义组件遵循单一职责原则
- handle 相关组件（`base-handle.tsx`, `button-handle.tsx`）用于节点编辑器

### 6. 路由使用（src/router/）
React Router v7，页面组件在 `src/pages/` 目录，主页是 `Home`。

### 7. 数据持久化（src/utils/）
- `chatHistoryStorage.ts`：聊天历史（本地存储或 IndexedDB）
- `projectStorage.ts`：项目数据保存
- `oss.ts`：阿里 OSS 文件上传

**约定**：使用 `idb-keyval` 做 IndexedDB 操作，`localStorageService` 做简单本地存储。

---

## 日常开发流程

### 启动开发环境
```bash
# 安装依赖（首次或有新增时）
npm install

# Web 版本开发（推荐）
npm run dev           # 访问 http://localhost:3004

# Electron 桌面版本开发
npm run dev:electron  # 打开 Electron 窗口
```

### 常见开发任务

#### 添加新页面
1. 在 `src/pages/NewPage/` 创建新页面组件
2. 在 `src/router/index.tsx` 添加路由
3. 更新导航菜单（通常在 `Sidebar` 或 `Home`）

#### 新增 AI 功能
1. 在 `src/types/` 定义相关类型（如 `NewGeneration.ts`）
2. 在 `src/constants/` 配置模型和提示词
3. 在 `src/hooks/` 创建自定义 hook（如 `useNewExecution.ts`）
4. 参考 `useAgentExecution.ts` 的模式，使用 `aiRequest.ts` 进行 API 调用

#### 状态管理问题
1. 使用 Zustand store（`src/store/`）管理复杂全局状态
2. 局部状态使用 React `useState`
3. 复杂副作用使用自定义 hook

#### 样式修改
- 使用 Tailwind CSS（v4）实用类
- 组件样式优先使用 Tailwind，避免 CSS 文件
- 复杂样式可在 `src/index.css` 添加全局样式

---

## 常见问题与解决

### 节点编辑器相关
- **节点焦点问题**（需求清单中）：检查 `@xyflow/react` 事件处理，可能需要调整 blur/focus 事件触发时机
- **拖拽动画**：利用 `@dnd-kit` 和 `framer-motion` 实现，参考 `base-handle.tsx`
- **节点加载状态**：在节点数据中添加 `loading` 字段，渲染时根据状态显示加载动画

### 长轮询中断（需求清单中）
- 在 React 组件卸载时清理轮询：`useEffect` 返回清理函数
- 参考 `useQrcodePolling.ts` 的实现模式

### 图片展开效果（需求清单中）
- 参考 TapNow 的展开样式，使用 `@floating-ui/react` 做浮层
- 或使用 Framer Motion 动画实现展开效果

---

## 构建与部署

### 开发构建
```bash
npm run build
# 输出到 out/ 目录
# 生成 sourcemap（便于调试）
```

### 生产构建
```bash
npm run build:win     # 构建 Windows exe（使用 electron-builder）
npm run build:unpack  # 解包测试
```

### Docker 部署
```bash
docker build -t jike .
docker run -d -p 3004:3004 --name jike jike:latest
```

### 在线地址
- 生产环境：https://jike-165954-5-1362504576.sh.run.tcloudbase.com/#/home

---

## 关键文件速查表

| 文件 | 用途 |
|------|------|
| `vite.config.ts` | Vite 配置（代理、端口、构建选项） |
| `electron.vite.config.ts` | Electron Vite 配置 |
| `src/main/index.ts` | Electron 主进程入口 |
| `src/preload/index.ts` | Electron 预加载脚本 |
| `src/router/index.tsx` | 路由定义 |
| `src/store/` | 全局状态（Zustand） |
| `src/constants/` | 常量配置 |
| `src/types/` | 类型定义 |
| `src/hooks/` | 自定义 hooks |
| `src/utils/aiRequest.ts` | AI API 请求封装 |
| `tailwind.config.ts` | Tailwind 配置 |

---

## 反馈与扩展

本指导将随着项目演进而更新。如有遗漏或不清晰处，欢迎补充。

**可能的后续自定义**：
- 为特定功能模块（如视频生成、图片生成）创建专项指导
- 为 Electron 主进程开发添加详细约定
- 为测试策略添加指导（目前项目未见测试框架）
