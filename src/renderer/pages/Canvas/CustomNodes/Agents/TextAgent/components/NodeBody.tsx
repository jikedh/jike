/**
 * 节点主体组件
 * 显示圆形节点区域，包含连接手柄和预设信息
 */
import { Position } from "@xyflow/react";
import {
  IconRefresh,
  IconBook,
  IconVideo,
  IconPhoto,
  IconUser,
  IconBrandStorybook,
} from "@tabler/icons-react";
import { memo } from "react";
import { ButtonHandle } from "@/components/button-handle";
import type { TextAgentPresetId } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { GenerationErrorTooltip } from "../../../shared/GenerationErrorTooltip";

const PRESET_ICONS: Record<TextAgentPresetId, React.ReactNode> = {
  "novel-to-script-agent": <IconBook size={18} />,
  "short-video-storyboard": <IconVideo size={18} />,
  "jimeng-prompt": <IconPhoto size={18} />,
  "novel-character-design": <IconUser size={18} />,
  "script-to-storyboard": <IconBrandStorybook size={18} />,
};

interface NodeBodyProps {
  presetId: TextAgentPresetId | undefined;
  presetLabel: string;
  selected: boolean;
  isGenerating: boolean;
  errorMessage?: string;
}

const NodeBodyInner = ({
  presetId,
  presetLabel,
  selected,
  isGenerating,
  errorMessage,
}: NodeBodyProps) => {
  // 手柄可见性控制
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
      {/* 输入手柄 */}
      <ButtonHandle
        type="target"
        position={Position.Left}
        id="input"
        visible
        className={`transition-opacity duration-150 ${handleVisibilityClass}`}
      />

      {/* 输出手柄 */}
      <ButtonHandle
        type="source"
        position={Position.Right}
        id="output"
        visible
        className={`transition-opacity duration-150 ${handleVisibilityClass}`}
      />

      {/* 节点内容 */}
      <div className="flex items-center gap-2 text-sm text-white/50">
        {isGenerating ? (
          // 生成中状态
          <>
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 border-2 border-[#B43FEB]/30 rounded-full"></div>
              <div className="absolute inset-0 border-2 border-transparent border-t-[#B43FEB] rounded-full animate-spin"></div>
            </div>
            <span>生成中...</span>
          </>
        ) : errorMessage ? (
          <GenerationErrorTooltip message={errorMessage} label="生成失败" />
        ) : (
          // 正常状态
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
