/**
 * 图片智能体 - 节点主体组件
 * 显示圆形节点区域，包含连接手柄和预设信息
 */

import { IconPhoto } from "@tabler/icons-react";
import { Position } from "@xyflow/react";
import type { ImageAgentPresetId } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";

const PRESET_ICONS: Record<ImageAgentPresetId, React.ReactNode> = {
    "image-reverse-prompt": <IconPhoto size={18} />,
};

interface NodeBodyProps {
    presetId: ImageAgentPresetId | undefined;
    presetLabel: string;
    selected: boolean;
    isGenerating: boolean;
}

export const NodeBody = ({
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
            {/* 输入手柄（左侧，接收图片节点） */}
            <ButtonHandle
                type="target"
                position={Position.Left}
                id="input"
                visible
                className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />

            {/* 输出手柄（右侧，输出便签节点） */}
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
                    <>
                        <div className="relative w-5 h-5">
                            <div className="absolute inset-0 border-2 border-[#B43FEB]/30 rounded-full" />
                            <div className="absolute inset-0 border-2 border-transparent border-t-[#B43FEB] rounded-full animate-spin" />
                        </div>
                        <span>反推中...</span>
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
