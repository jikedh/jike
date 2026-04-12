import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { XxxGenerationNode } from "shared/types/flow";
import { XxxContent } from "./XxxContent";
import { XxxPromptPanel } from "./XxxPromptPanel";
import { XxxToolbar } from "./XxxToolbar";
import { cn } from "shared/utils/utils";

export interface XxxNodeProps extends NodeProps {
  data: XxxGenerationNode;
}

const XxxNode = memo(function XxxNode({ id, data }: XxxNodeProps) {
  const isGenerating = data.status === "generating";
  const hasError = !!data.error;
  const hasResult = data.result?.data?.length > 0;

  return (
    <div
      className={cn(
        "w-[350px] rounded-xl overflow-hidden",
        "bg-[#1a1a1d] border border-white/10",
        "shadow-lg transition-all duration-200",
        isGenerating && "ring-2 ring-[#B43FEB]/50",
        hasError && "ring-2 ring-red-500/50",
      )}
    >
      {/* 工具栏 */}
      <XxxToolbar id={id} data={data} />

      {/* 内容区 */}
      <XxxContent data={data} />

      {/* 底部操作区 */}
      <XxxPromptPanel id={id} data={data} />
    </div>
  );
});

export { XxxNode };
