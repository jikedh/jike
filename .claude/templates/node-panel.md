import { memo } from "react";
import type { XxxGenerationNode } from "shared/types/flow";
import { Button } from "@/components/ui/button";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { promptPanelStyles } from "../shared/promptPanelStyles";

interface XxxPromptPanelProps {
  id: string;
  data: XxxGenerationNode;
}

const XxxPromptPanel = memo(function XxxPromptPanel({ id, data }: XxxPromptPanelProps) {
  const updateNodeData = useCanvasFlowStore((state) => state.updateXxxNodeData);
  const isGenerating = data.status === "generating";

  const handleGenerate = () => {
    // TODO: 实现生成逻辑
    updateNodeData(id, { status: "generating" });
  };

  return (
    <div className={cn(promptPanelStyles.container)}>
      <div className={cn(promptPanelStyles.promptArea)}>
        <textarea
          className={cn(promptPanelStyles.textarea)}
          placeholder="输入提示词..."
          value={data.prompt || ""}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
        />
      </div>
      <div className={cn(promptPanelStyles.actions)}>
        <Button
          variant="blue"
          loading={isGenerating}
          onClick={handleGenerate}
        >
          生成
        </Button>
      </div>
    </div>
  );
});

export { XxxPromptPanel };
