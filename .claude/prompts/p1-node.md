# P1 - 新增节点提示词

## 触发词
新增节点、新建节点、create node、add node

## 任务
帮助用户创建一个新的 Canvas 节点。

## 工作流程

### 第一步：询问节点信息

```markdown
## 🆕 新增节点

请提供以下信息：

1. **节点名称**：是什么节点？（如：音乐节点）
2. **节点类型 ID**：`xxxNode`（如：`musicNode`）
3. **节点分组**：
   - 基础节点（便签、图片、视频、音频）
   - 智能体节点（文本智能体）
   - 效率节点
   - **需要新建分组**：请描述分组名称
4. **核心功能**：节点的主要用途是什么？
5. **输入参数**：需要哪些用户输入？
6. **输出类型**：生成什么？（图片/视频/文本/音频）
```

### 第二步：生成节点代码

使用 templates/ 文件夹中的模板生成代码：

1. **index.tsx** - 节点外壳
2. **XxxContent.tsx** - 内容展示区
3. **XxxPromptPanel.tsx** - 底部输入操作区
4. **XxxToolbar.tsx** - 顶部工具栏
5. **类型定义** - shared/types/flow/index.ts

### 第三步：同步修改注册文件

按以下清单修改（跳过已存在的节点组件文件夹）：

| 序号 | 文件路径 | 修改内容 |
|------|---------|---------|
| 1 | `src/shared/types/flow/index.ts` | 添加类型接口 + AllNodeType |
| 2 | `src/shared/types/zustand/canvas-flow.ts` | NodeType + nodeIdCounters |
| 3 | `src/renderer/pages/Canvas/constants/canvasConfig.ts` | nodeTypes 注册 |
| 4 | `src/renderer/pages/Canvas/components/FloatingSidebar.tsx` | 侧边栏菜单 |
| 5 | `src/renderer/pages/Canvas/components/CanvasSidebar.tsx` | switch case |
| 6 | `src/renderer/pages/Canvas/components/CanvasContextMenu.tsx` | 右键菜单 |
| 7 | `src/renderer/stores/canvasFlowStore.ts` | addNode 分支 |

### 第四步：询问分组

如果用户需要新建分组：
```markdown
## 📁 新增分组

需要新建分组吗？
- 分组名称：
- 分组位置：primary（顶部）/ default（中部）
- 菜单项：
```

## 注意事项
- 询问用户确认后再生成代码
- 节点类型 ID 必须是唯一的
- 遵循现有的代码风格和命名规范
