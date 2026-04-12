# 命名规范检查清单

## 节点命名

| 元素 | 命名规则 | 示例 |
|------|---------|------|
| 节点类型 ID | 小写下划线 | `imageNode`、`videoNode` |
| NodeType 类型 | PascalCase + Type | `ImageNodeType`、`VideoNodeType` |
| 节点数据接口 | PascalCase + Node/Data | `ImageGenerationNode`、`NoteNodeData` |
| 节点组件 | PascalCase + Node | `ImageNode`、`VideoNode` |
| Store | use + PascalCase + Store | `useCanvasFlowStore` |
| 动作 ID | 动词-名词 | `create-image`、`create-video` |

## 文件命名

- [ ] 组件文件：PascalCase，如 `ImageNode.tsx`
- [ ] 工具文件：kebab-case，如 `use-video-url.ts`
- [ ] 常量文件：PascalCase，如 `canvasConfig.ts`
- [ ] 类型文件：PascalCase，如 `flow.ts`

## 变量命名

- [ ] 组件内变量：camelCase
- [ ] 常量：camelCase 或 UPPER_SNAKE_CASE
- [ ] 接口/类型：PascalCase
- [ ] enum 成员：PascalCase

## 路径命名

- [ ] 组件目录：PascalCase，如 `ImageNode/`
- [ ] 子目录：kebab-case，如 `components/`、`hooks/`
- [ ] 样式文件：kebab-case，如 `floating-sidebar.css`

## 禁止

- ❌ 中文命名（文件名、变量名）
- ❌ 缩写命名（如 `Btn`、`Ctx`）
- ❌ 模糊命名（如 `data`、`info`）
- ❌ 匈牙利命名（如 `strName`、`iCount`）
