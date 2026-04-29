# 节点代码模板参考

模板只作为结构参考。生成代码时必须先读取现有节点实现，并适配当前项目的 import、类型、store API、样式和目录结构。

## 目录结构

```text
XxxNode/
├── index.tsx
├── XxxContent.tsx
├── XxxPromptPanel.tsx
├── XxxToolbar.tsx
├── components/
├── hooks/
└── utils/
```

## 节点外壳

```tsx
import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { cn } from "shared/utils/utils";
import type { XxxGenerationNode } from "shared/types/flow";
import { XxxContent } from "./XxxContent";
import { XxxPromptPanel } from "./XxxPromptPanel";
import { XxxToolbar } from "./XxxToolbar";

export interface XxxNodeProps extends NodeProps {
  data: XxxGenerationNode;
}

const XxxNode = memo(function XxxNode({ id, data }: XxxNodeProps) {
  const isGenerating = data.status === "generating";
  const hasError = Boolean(data.error);

  return (
    <div
      className={cn(
        "w-[350px] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1d] shadow-lg transition-all duration-200",
        isGenerating && "ring-2 ring-[#B43FEB]/50",
        hasError && "ring-2 ring-red-500/50",
      )}
    >
      <XxxToolbar id={id} data={data} />
      <XxxContent data={data} />
      <XxxPromptPanel id={id} data={data} />
    </div>
  );
});

export { XxxNode };
```

## 内容区

```tsx
import { memo } from "react";
import type { XxxGenerationNode } from "shared/types/flow";

interface XxxContentProps {
  data: XxxGenerationNode;
}

const XxxContent = memo(function XxxContent({ data }: XxxContentProps) {
  const hasResult = Boolean(data.result?.data?.length);

  if (!hasResult) {
    return <div className="px-3 py-8 text-center text-sm text-white/50">暂无内容</div>;
  }

  return <div className="px-3 py-2">{/* 渲染结果 */}</div>;
});

export { XxxContent };
```

## 输入操作区

```tsx
import { memo, useCallback } from "react";
import type { XxxGenerationNode } from "shared/types/flow";
import { Button } from "@/components/ui/button";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

interface XxxPromptPanelProps {
  id: string;
  data: XxxGenerationNode;
}

const XxxPromptPanel = memo(function XxxPromptPanel({ id, data }: XxxPromptPanelProps) {
  const updateNodeData = useCanvasFlowStore((state) => state.updateXxxNodeData);
  const isGenerating = data.status === "generating";

  const handleGenerate = useCallback(() => {
    updateNodeData(id, { status: "generating" });
  }, [id, updateNodeData]);

  return (
    <div className="border-t border-white/10 bg-[#121214] p-3">
      <textarea
        className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#B43FEB]/60"
        placeholder="输入提示词..."
        value={data.prompt || ""}
        onChange={(event) => updateNodeData(id, { prompt: event.target.value })}
      />
      <div className="mt-2 flex justify-end">
        <Button variant="blue" loading={isGenerating} onClick={handleGenerate}>
          生成
        </Button>
      </div>
    </div>
  );
});

export { XxxPromptPanel };
```

## 工具栏

```tsx
import { memo } from "react";
import { IconCopy, IconTrash } from "@tabler/icons-react";
import type { XxxGenerationNode } from "shared/types/flow";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

interface XxxToolbarProps {
  id: string;
  data: XxxGenerationNode;
}

const XxxToolbar = memo(function XxxToolbar({ id }: XxxToolbarProps) {
  const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
  const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);

  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-[#121214] px-3 py-2">
      <span className="text-sm font-medium text-white/70">Xxx 节点</span>
      <div className="flex items-center gap-1">
        <button className="rounded p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white" onClick={() => duplicateNode(id)}>
          <IconCopy size={14} />
        </button>
        <button className="rounded p-1.5 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-400" onClick={() => deleteNode(id)}>
          <IconTrash size={14} />
        </button>
      </div>
    </div>
  );
});

export { XxxToolbar };
```

## 类型参考

```ts
export interface XxxGenerationNode {
  model: string;
  prompt: string;
  promptDraft?: string;
  promptDraftHtml?: string;
  status?: GenerationStatus;
  progress?: number;
  result?: {
    type: string;
    data: Array<{
      url: string;
      format?: string;
      relativePath?: string;
      localFileName?: string;
    }>;
  };
  error?: {
    code?: string;
    message?: string;
    detail?: string;
    serverMessage?: string;
    status?: number;
  };
}

export type XxxNodeType = Node<XxxGenerationNode, "xxxNode">;
```
