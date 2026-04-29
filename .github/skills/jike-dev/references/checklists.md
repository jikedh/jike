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
- Zustand selector 保持精确，避免订阅整个 store 导致不必要重渲染。

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
