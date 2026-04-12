# Jike Dev - 即刻开发助手

## 简介

Jike Dev 是专为「即刻」视频工作流项目设计的开发辅助 skill。

## 技术栈

- React 19 + TypeScript + Electron
- @xyflow/react（画布流程图）
- Tailwind CSS v4 + Biome（格式化/lint）
- Zustand（状态管理）
- Tabler Icons + Lucide React（图标）

## 触发关键词

| 分级 | 触发关键词 | 说明 |
|------|-----------|------|
| **P0 快速检查** | 检查、review、审查、review code、review this | 代码审查 |
| **P1 标准开发** | 新增节点、新建节点、create node、add node | 新增节点 |
| **P2 深度重构** | 重构、refactor、整理代码、优化架构 | 重构优化 |
| **P3 Bug 修复** | bug、报错、error、不生效、fix this | Bug 修复 |
| **P4 同步存储** | 同步到项目目录、存储到项目、保存节点、save to project | 数据同步 |

## 工作目录

```
e:\code\jiketool\jike\
```

## 项目结构

```
src/
├── renderer/
│   ├── pages/Canvas/
│   │   ├── CustomNodes/      # 节点组件
│   │   ├── components/       # 画布组件
│   │   ├── constants/        # 配置常量
│   │   └── stores/           # 画布 store
│   ├── stores/               # 全局 store
│   └── components/ui/        # UI 组件库
├── shared/
│   ├── types/flow/           # 类型定义
│   ├── constants/            # 常量定义
│   └── utils/                # 工具函数
└── main/                     # Electron 主进程
```

## 节点开发文件清单

新增节点需同步修改以下文件：

| 序号 | 文件路径 | 修改内容 |
|------|---------|---------|
| 1 | `src/shared/types/flow/index.ts` | 添加类型接口 + AllNodeType |
| 2 | `src/shared/types/zustand/canvas-flow.ts` | NodeType + nodeIdCounters |
| 3 | `src/renderer/pages/Canvas/constants/canvasConfig.ts` | nodeTypes 注册 |
| 4 | `src/renderer/pages/Canvas/components/FloatingSidebar.tsx` | 侧边栏菜单 |
| 5 | `src/renderer/pages/Canvas/components/CanvasSidebar.tsx` | switch case |
| 6 | `src/renderer/pages/Canvas/components/CanvasContextMenu.tsx` | 右键菜单 |
| 7 | `src/renderer/stores/canvasFlowStore.ts` | addNode 分支 |
| 8 | `src/renderer/pages/Canvas/CustomNodes/XxxNode/` | 节点组件 |

## 节点分组

侧边栏菜单分组：
- **primary**：基础节点（便签、图片、视频、音频）
- **default > assistant**：智能体节点
- **default > efficiency-tools**：效率节点（开发中）

新增节点时需询问用户是否需要新建分组。

## 常用命令

```bash
npm run format        # 格式化
npm run check-format  # 检查格式
npm run lint          # Lint
npm run type-check    # 类型检查
npm run dev:electron  # 开发模式
npm run build:win     # 构建 Windows
```

## 节点组件结构

```
XxxNode/
├── index.tsx           # React Flow Node 外壳
├── XxxContent.tsx      # 内容展示区
├── XxxPromptPanel.tsx  # 底部输入操作区
├── XxxToolbar.tsx      # 顶部工具栏
├── components/         # 子组件
├── hooks/             # 自定义 hooks
└── utils/             # 工具函数
```

## 分级任务执行

### P0 - 快速检查
触发词：检查、review、审查、review code、review this

执行检查清单（见 checklists/ 文件夹）：
1. 代码规范检查
2. UI 规范检查
3. 命名检查

### P1 - 标准开发（新增节点）⭐️
触发词：新增节点、新建节点、create node、add node

**⚠️ 重要：方案对比 + 生成前确认**

执行流程：
1. **分析需求** — 理解用户想要的节点功能
2. **展示方案对比** — 对比 2-3 个方案让用户选（见下方）
3. **用户选择后** — 展示详细生成计划
4. **用户确认** — 点击"是"后才执行
5. **生成代码** — 按计划生成所有文件
6. **同步提示** — 完成后提示用户可以同步到项目目录

### P2 - 深度重构
触发词：重构、refactor、整理代码、优化架构

检查清单：
1. 组件拆分（>200行建议拆分）
2. 类型整理
3. Store 整理
4. 代码重复检查

### P3 - Bug 修复
触发词：bug、报错、error、不生效、fix this

工作流程：
1. 询问错误信息和复现步骤
2. 检查常见问题
3. 给出修复建议

### P4 - 同步到项目目录
触发词：同步到项目目录、存储到项目、保存节点、save to project

#### 为什么需要同步？

每次开发新节点时，我们会在代码中创建节点组件。但这些组件的配置信息（如节点名称、分类、状态）分散在多个文件中。时间久了会导致：
- 不知道哪些节点是"草稿"、哪些是"已完成"
- 每次开发新功能时，不知道之前的进度
- 项目路径中缺少统一的节点清单

#### 同步机制

同步文件位置：`{projectPath}/.jike/nodes-meta.json`

```json
{
  "version": "1.0",
  "lastSync": "2026-04-12T19:07:00.000Z",
  "nodes": {
    "image": {
      "nodeId": "image",
      "nodeType": "image",
      "category": "primary",
      "displayName": "图片",
      "createdAt": "2026-04-12T19:07:00.000Z",
      "updatedAt": "2026-04-12T19:07:00.000Z",
      "status": "completed",
      "files": {
        "component": "src/renderer/pages/Canvas/CustomNodes/ImageNode/index.tsx"
      },
      "description": "图片节点，支持上传和处理图片"
    }
  }
}
```

#### 同步内容

| 字段 | 说明 |
|------|------|
| nodeId | 节点 ID（如 image, video, audio） |
| nodeType | 节点类型 |
| category | 分组（primary/assistant/efficiency-tools） |
| displayName | 显示名称 |
| status | 状态（draft=草稿, completed=已完成） |
| files | 组件文件路径 |
| description | 节点描述 |
| createdAt/updatedAt | 创建/更新时间 |

#### 同步时机

- **用户主动触发**：用户说"把新节点存储到项目目录"
- **同步所有已注册的节点**：读取 `canvasConfig.ts` 中的 `nodeTypes`，生成完整的 nodes-meta.json

## 方案对比机制 ⭐️

### 为什么需要方案对比？

开发新节点时，有多种实现方式。通过对比不同方案：
1. **让用户理解权衡** — 知道每个方案的优缺点
2. **选择最合适的** — 根据实际需求选方案
3. **避免返工** — 在开始前确定方向

### 方案对比模板

当用户触发 P1（新增节点）时，必须展示以下内容：

---

## 🎯 需求分析

**用户想要**：[描述用户需求]

---

## 🔍 方案对比

| 维度 | 方案 A | 方案 B | 方案 C |
|------|--------|--------|--------|
| **实现方式** | [描述] | [描述] | [描述] |
| **复杂度** | 低/中/高 | 低/中/高 | 低/中/高 |
| **扩展性** | 一般/好/最好 | 一般/好/最好 | 一般/好/最好 |
| **开发时间** | 短/中/长 | 短/中/长 | 短/中/长 |
| **适用场景** | [场景] | [场景] | [场景] |

### 方案 A：[方案名称]
- **优点**：[列出优点]
- **缺点**：[列出缺点]
- **适合**：[使用场景]

### 方案 B：[方案名称] ⭐️（推荐）
- **优点**：[列出优点]
- **缺点**：[列出缺点]
- **适合**：[使用场景]

### 方案 C：[方案名称]
- **优点**：[列出优点]
- **缺点**：[列出缺点]
- **适合**：[使用场景]

---

## ❓ 请选择一个方案

请回复 **A** / **B** / **C**，或描述你的想法

---

### 常用方案类型

根据节点类型，推荐的方案组合：

#### 图片/视频类节点
| 方案 A | 方案 B | 方案 C |
|--------|--------|--------|
| 单节点模式 | 多组件分离 | 懒加载模式 |
| 一个组件完成所有功能 | Content + PromptPanel + Toolbar 分离 | 按需加载资源 |

#### 文字类节点
| 方案 A | 方案 B |
|--------|--------|
| 简单文本框 | 富文本编辑器 |
| 基础文本输入 | 支持 Markdown/格式化 |

#### 智能体类节点
| 方案 A | 方案 B | 方案 C |
|--------|--------|--------|
| 单角色节点 | 多角色组合 | 树形流程节点 |
| 一个 Agent 完成所有 | 多个 Agent 协同 | 支持条件分支 |

## 生成前确认机制 ⭐️

### 为什么需要确认？

在生成代码前展示计划，让用户：
1. **知道你要做什么** — 避免生成错误的内容
2. **理解为什么做** — 明白每个步骤的目的
3. **有机会修改** — 在执行前调整参数

### 确认模板（用户选择方案后展示）

---

## 📋 生成计划确认

### 🎯 目标
新增一个 **[节点名称]** 节点

### 📁 文件变更
| 操作 | 文件路径 |
|------|---------|
| ➕ 新增 | `src/renderer/pages/Canvas/CustomNodes/XxxNode/index.tsx` |
| ➕ 新增 | `src/renderer/pages/Canvas/CustomNodes/XxxNode/XxxContent.tsx` |
| ➕ 新增 | `src/renderer/pages/Canvas/CustomNodes/XxxNode/XxxPromptPanel.tsx` |
| ➕ 新增 | `src/renderer/pages/Canvas/CustomNodes/XxxNode/XxxToolbar.tsx` |
| ✏️ 修改 | `src/shared/types/flow/index.ts` |
| ✏️ 修改 | `src/shared/types/zustand/canvas-flow.ts` |
| ✏️ 修改 | `src/renderer/pages/Canvas/constants/canvasConfig.ts` |
| ✏️ 修改 | `src/renderer/pages/Canvas/components/FloatingSidebar.tsx` |
| ✏️ 修改 | `src/renderer/pages/Canvas/components/CanvasSidebar.tsx` |
| ✏️ 修改 | `src/renderer/pages/Canvas/components/CanvasContextMenu.tsx` |
| ✏️ 修改 | `src/renderer/stores/canvasFlowStore.ts` |

### 📝 节点配置
| 配置项 | 值 |
|--------|-----|
| 节点 ID | xxx |
| 显示名称 | xxx |
| 分组 | primary/assistant/efficiency-tools |
| 分类 | xxx |

### ❓ 确认操作

**请确认是否开始生成代码？**
- 点击「是」：开始生成代码
- 点击「否」：取消操作
- 点击「修改」：调整参数

---

### 执行确认流程

1. **分析需求** — 理解用户想要的节点功能
2. **展示方案对比** — 对比 2-3 个方案让用户选
3. **展示生成计划** — 按模板展示详细的生成计划
4. **等待用户确认** — 用户点击"是"才执行
5. **生成代码** — 按计划生成所有文件
6. **同步提示** — 生成完成后提示用户可以同步到项目目录

## 代码规范要点

- 文件命名：组件 PascalCase，工具 kebab-case
- 使用 `React.memo` + `useCallback` + `useMemo`
- Tailwind 类名，禁止内联 style
- 主题色：`#B43FEB`，背景：`#121214`
- 使用 `cn()` 合并类名
- 接口 JSDoc 注释
- Biome：2空格缩进，双引号
