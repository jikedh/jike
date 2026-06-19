/**
 * 节点主体组件
 * 显示圆形节点区域，包含连接手柄和预设信息
 */
import { Position } from "@xyflow/react";
import { IconVideo } from "@tabler/icons-react";
import { memo } from "react";
import { ButtonHandle } from "@/components/button-handle";
import type { VideoAgentPresetId } from "shared/types/flow";
import { cn } from "shared/utils/utils";

const PRESET_ICONS: Record<VideoAgentPresetId, React.ReactNode> = {
  "video-pull-film": <IconVideo size={18} />,
};

interface NodeBodyProps {
  presetId: VideoAgentPresetId | undefined;
  presetLabel: string;
  selected: boolean;
  isGenerating: boolean;
}

const NodeBodyInner = ({
  presetId,
  presetLabel,
  selected,
  isGenerating,
}: NodeBodyProps) => {
  const handleVisibilityClass = selected
    ? "visible opacity-100"
    : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100";

  return (
    <div
      className={cn(
        "group/nodeBox relative w-[200px] h-[200px] bg-[#1a1a1c] rounded-xl flex items-center justify-center",
        selected
          ? "border-2 border-[#B43FEB] shadow-[0_0_20px_rgba(180,63,235,0.4),inset_0_0_10px_rgba(180,63,235,0.1)]"
          : "border border-white/[0.08] hover:border-white/[0.15]",
      )}
    >
      <ButtonHandle
        type="target"
        position={Position.Left}
        id="input"
        visible
        className={`transition-opacity duration-150 ${handleVisibilityClass}`}
      />

      <ButtonHandle
        type="source"
        position={Position.Right}
        id="output"
        visible
        className={`transition-opacity duration-150 ${handleVisibilityClass}`}
      />

      <div className="flex items-center gap-2 text-sm text-white/50">
        {isGenerating ? (
          <>
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 border-2 border-[#B43FEB]/30 rounded-full"></div>
              <div className="absolute inset-0 border-2 border-transparent border-t-[#B43FEB] rounded-full animate-spin"></div>
            </div>
            <span>生成中...</span>
          </>
        ) : (
          <>
            {presetId && PRESET_ICONS[presetId]}
            <span>{presetLabel}</span>
          </>
        )}
      </div>
    </div>
  );
};

export const NodeBody = memo(NodeBodyInner);
