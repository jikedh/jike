# Jike 检查清单

## 代码规范

- 使用 `interface` 定义对象结构，使用 `type` 定义联合类型或别名。
- 避免 `any`，优先使用具体类型或 `unknown`；只有受第三方约束时才保留兼容写法。
- 组件使用 PascalCase，函数和变量使用 camelCase。
- 使用 2 空格缩进、双引号。
- 不保留未使用 import。
- 避免 `console.log`；调试和错误输出优先使用 `console.warn` 或 `console.error`。
- 只给新增或修改的公共接口补充必要说明，不批量补注释。

## React 组件规范

- 复用现有项目模式；不要机械套模板。
- 对高频渲染或节点组件优先考虑 `React.memo`。
- 传给子组件或 hook 的回调优先用 `useCallback`，派生数据优先用 `useMemo`。
- 传给 `<ReactFlow>` 的对象、数组和配置项应使用 `useMemo`，或定义在组件外部。
- 传给 `<ReactFlow>`、节点组件和子组件的函数应使用 `useCallback`。
- `useMemo` / `useCallback` 的依赖数组必须稳定；如果依赖项本身是频繁变化的引用，应先稳定该依赖。
- 节点组件必须使用 `memo`，并保持 props 引用尽量稳定。
- Zustand selector 保持精确，避免订阅整个 store 导致不必要重渲染。

## ReactFlow / Canvas 性能规范

- `nodeTypes`、`edgeTypes`、`defaultEdgeOptions`、`fitViewOptions`、`proOptions` 等配置不要在 render 中直接创建。
- 高频事件回调（如节点拖拽、连线、视口变化）必须使用稳定回调，避免引发整棵 Canvas 重新渲染。
- 避免因尺寸、位置、布局相关属性频繁变化触发 reflow（回流）和 repaint（重绘）。
- 动画和 hover 效果应控制在局部范围内，不把高频状态提升到会影响整个 Canvas 的父组件。
- 图片、视频和 OSS 资源展示必须优先使用缩略图或可控尺寸预览资源，避免在节点中直接加载原始大资源。

## 能力建模与状态驱动 UI

- 模型差异、参数差异、输出能力差异应先整理为能力矩阵（Capability Matrix）。
- UI 应由能力矩阵和节点状态驱动，包括可见字段、禁用态、提示文案、默认值和校验规则。
- 避免在组件 JSX 中堆叠大量 `if/else` 处理模型差异。
- 能力矩阵应放在常量、配置或共享类型附近，方便复用和测试。

## UI 规范

- 主色：`#B43FEB`。
- 背景：`#121214`、深色面板或透明，保持现有视觉体系。
- 边框：优先 `border-white/10`。
- 文本：主要文字 `text-white`，次要文字 `text-white/70` 或现有同类样式。
- 优先 Tailwind 类名；禁止无必要内联 `style`。
- 使用 `cn()` 合并条件类名。
- 复杂样式可集中到局部 `xxxStyles` 常量或沿用现有共享样式。
- 常见交互：`rounded-xl` / `rounded-lg`、`shadow-lg`、`transition-all duration-200`、`hover:bg-white/10`。

## 命名规范

| 元素 | 规则 | 示例 |
| --- | --- | --- |
| 节点类型 ID | 遵循现有项目节点 ID 风格 | `image`、`textAgent`、`xxx` |
| React Flow 节点 type | 现有约定 + `Node` | `imageNode`、`xxxNode` |
| 节点类型别名 | PascalCase + `NodeType` | `ImageNodeType`、`XxxNodeType` |
| 节点数据接口 | PascalCase + `Node` / `NodeData` | `ImageGenerationNode`、`NoteNodeData` |
| 节点组件 | PascalCase + `Node` | `ImageNode`、`XxxNode` |
| Store | `use` + PascalCase + `Store` | `useCanvasFlowStore` |
| 动作 ID | 动词-名词 | `create-image`、`create-xxx` |

## 禁止项

- 中文文件名或中文变量名。
- 模糊命名，如无上下文的 `data`、`info`、`temp`。
- 无必要缩写，如 `Btn`、`Ctx`。
- 未确认的批量重构。
- 在 render 中创建传给 `<ReactFlow>` 的非稳定对象或函数。
- 节点直接加载 OSS 原图作为预览。
