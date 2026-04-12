# 注册文件修改模板

## 1. canvasConfig.ts

```typescript
import { XxxNode } from "../CustomNodes/XxxNode";

// nodeTypes 中添加
export const nodeTypes = {
  // ... 现有节点
  xxxNode: XxxNode,
};
```

## 2. FloatingSidebar.tsx

```typescript
// DEFAULT_ITEMS 中添加
{
  id: "create",
  label: "新增节点",
  icon: <IconPlus stroke={2.5} size={22} />,
  role: "primary",
  children: [
    { id: "create-note", label: "便签" },
    { id: "create-image", label: "图片" },
    { id: "create-video", label: "视频" },
    { id: "create-audio", label: "音频" },
    // 新增
    { id: "create-xxx", label: "Xxx" },
  ],
},
```

## 3. CanvasSidebar.tsx

```typescript
// switch case 中添加
case "create-xxx":
  addNode("xxx", centerFlowPosition);
  break;
```

## 4. CanvasContextMenu.tsx

```typescript
// CanvasNodeType 添加
export type CanvasNodeType =
  | "note"
  | "image"
  | "video"
  | "panorama"
  | "audio"
  | "textAgent"
  // 新增
  | "xxx";

// 菜单项添加（导入图标）
import { IconXxx } from "@tabler/icons-react";

<ContextMenuItem onSelect={() => onCreateNode("xxx")}>
  <IconXxx size={16} />
  新建 Xxx 节点
</ContextMenuItem>
```

## 5. canvas-flow.ts (NodeType)

```typescript
export type NodeType =
  | "note"
  | "image"
  | "video"
  | "agent"
  | "panorama"
  | "audio"
  | "textAgent"
  | "table"
  // 新增
  | "xxx";

// nodeIdCounters 添加
nodeIdCounters: {
  note: number;
  image: number;
  video: number;
  agent: number;
  panorama: number;
  audio: number;
  table: number;
  // 新增
  xxx: number;
},
```

## 6. canvasFlowStore.ts (addNode)

```typescript
} else if (nodeType === "xxx") {
  newNode = {
    id: nextId,
    type: "xxxNode",
    position: nextPosition,
    width: 350,
    height: 250,
    data: {
      model: "default-model",
      prompt: "",
      promptDraft: "",
      promptDraftHtml: "<p></p>",
      status: GenerationStatus.COMPLETED,
      progress: 0,
      result: {
        type: "xxx",
        data: [],
      },
      createdAt: Date.now(),
    },
  };
}
```

## 7. AllNodeType (shared/types/flow/index.ts)

```typescript
export type AllNodeType =
  | TextNodeType
  | ImageNodeType
  | VideoNodeType
  | NoteNodeType
  | AgentNodeType
  | TextAgentNodeType
  | PanoramaNodeType
  | AudioNodeType
  | TableNodeType
  | DefaultNodeType
  // 新增
  | XxxNodeType;
```
