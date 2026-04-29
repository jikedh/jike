# Canvas 节点开发流程

## 需要收集的信息

新增节点前，确认以下内容：

1. 节点名称：例如“音乐节点”。
2. 节点类型 ID：与现有 `NodeType` 风格一致。
3. React Flow 节点 type：通常为 `<id>Node`，以当前项目约定为准。
4. 节点分组：基础节点、智能体节点、效率节点，或用户指定新分组。
5. 核心功能：节点主要用途。
6. 输入参数：用户需要输入哪些字段。
7. 输出类型：图片、视频、文本、音频、表格或其他结构。
8. 是否需要同步到项目元信息。
9. 是否存在模型能力差异；如存在，先定义能力矩阵（Capability Matrix）。
10. 是否涉及 OSS 媒体资源；如涉及，必须规划缩略图或轻量预览资源。

## 文件定位策略

旧清单中常见候选路径包括：

- `src/shared/types/flow/index.ts`
- `src/shared/types/zustand/canvas-flow.ts`
- `src/renderer/pages/Canvas/constants/canvasConfig.ts`
- `src/renderer/pages/Canvas/components/FloatingSidebar.tsx`
- `src/renderer/pages/Canvas/components/CanvasSidebar.tsx`
- `src/renderer/pages/Canvas/components/CanvasContextMenu.tsx`
- `src/renderer/stores/canvasFlowStore.ts`
- `src/renderer/pages/Canvas/CustomNodes/XxxNode/`

但当前项目结构可能变化。实施前必须搜索现有节点、`nodeTypes`、`addNode`、菜单项和 `NodeType` 定义，确认真实路径后再修改。

## 方案对比模板

新增节点时先展示 2-3 个方案：

| 维度 | 方案 A | 方案 B | 方案 C |
| --- | --- | --- | --- |
| 实现方式 | 简述 | 简述 | 简述 |
| 复杂度 | 低/中/高 | 低/中/高 | 低/中/高 |
| 扩展性 | 一般/好/最好 | 一般/好/最好 | 一般/好/最好 |
| 适用场景 | 场景 | 场景 | 场景 |

常用方案：

- 图片/视频类：单节点模式、多组件分离、懒加载模式。
- 文字类：简单文本框、富文本编辑器。
- 智能体类：单角色节点、多角色组合、树形流程节点。

必须给出推荐方案和推荐理由，并等待用户选择。

如节点涉及多个模型或多种输出能力，方案对比中必须包含“能力矩阵 + 状态驱动 UI”方案，避免后续靠组件内 `if/else` 管理模型差异。

## 生成计划确认模板

用户选择方案后，展示生成计划并等待确认：

```markdown
## 生成计划确认

### 目标
新增一个 **[节点名称]** 节点。

### 文件变更
| 操作 | 文件路径 | 说明 |
| --- | --- | --- |
| 新增 | `.../XxxNode/index.tsx` | 节点外壳 |
| 新增 | `.../XxxNode/XxxContent.tsx` | 内容展示 |
| 新增 | `.../XxxNode/XxxPromptPanel.tsx` | 输入操作 |
| 新增 | `.../XxxNode/XxxToolbar.tsx` | 顶部工具栏 |
| 修改 | `...` | 类型、注册、菜单、store |

### 节点配置
| 配置项 | 值 |
| --- | --- |
| 节点 ID | xxx |
| 显示名称 | xxx |
| 分组 | primary/assistant/efficiency-tools/自定义 |
| 输出类型 | xxx |
| 能力矩阵 | 是否需要 / 配置位置 |
| OSS 缩略图 | 是否需要 / 字段来源 |

请确认是否开始生成代码。
```

只有用户明确确认后才开始写入代码。

## 实施清单

以当前项目真实路径为准，通常需要保持以下内容一致：

1. 节点数据接口与 React Flow 节点类型。
2. 全量节点联合类型。
3. `NodeType` 联合类型与 ID 计数器。
4. `nodeTypes` 注册表。
5. 侧边栏或创建菜单。
6. 右键菜单。
7. store 中的 `addNode` 分支和必要的 update 方法。
8. 节点组件目录：外壳、内容区、输入/操作区、工具栏，以及必要的局部 hooks/utils。
9. 能力矩阵常量或配置：描述模型支持的输入、输出、尺寸、参数、禁用原因和默认值。
10. OSS 缩略图字段：图片/视频预览优先使用 thumbnail URL，必要时保留原始 URL 仅用于下载或放大查看。

## 性能要求

- 节点组件必须使用 `memo`。
- 节点内传给子组件的回调应使用 `useCallback`，派生对象和数组应使用 `useMemo`。
- 不在节点 render 中创建会传入 `<ReactFlow>` 或高频子组件的临时对象。
- 依赖数组必须稳定；如果依赖项是函数、对象或数组，应先确认其来源已 memo。
- 避免高频状态变化触发整个 Canvas 的 reflow/repaint。
- 媒体节点必须优先使用 OSS 缩略图或轻量预览资源。

## 完成后提示

- 汇总新增和修改的文件。
- 说明用户可如何手动验证。
- 提醒可使用“同步到项目目录”触发节点元信息同步。
