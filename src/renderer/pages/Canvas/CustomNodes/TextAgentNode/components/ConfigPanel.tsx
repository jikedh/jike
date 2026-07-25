/**
 * 配置面板组件
 * 包含系统提示词编辑、模型选择和生成按钮
 */

import { IconCheck, IconChevronDown, IconSend } from "@tabler/icons-react";
import { useState } from "react";
import { TEXT_AGENT_MODELS } from "shared/constants/text-agent-presets";
import { cn } from "shared/utils/utils";
import { ModelPointsBadge } from "@/components/ModelPointsBadge";
import { Button } from "@/components/ui/button";
import { useGenerationPoints } from "@/hooks/useGenerationPoints";

interface ConfigPanelProps {
  editableSystemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  currentModel: string;
  onModelChange: (model: string) => void;
  scoreCost?: number;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const ConfigPanel = ({
  editableSystemPrompt,
  onSystemPromptChange,
  currentModel,
  onModelChange,
  scoreCost,
  isGenerating,
  onGenerate,
}: ConfigPanelProps) => {
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const { totalPoints } = useGenerationPoints();

  return (
    <div className="nodrag nopan nowheel absolute left-1/2 -translate-x-1/2 top-[216px] w-[500px] rounded-2xl border border-white/[0.05] bg-[#1e1e20] p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-2 duration-200 z-30">
      {/* 系统提示词编辑框 */}
      <div className="relative mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <textarea
          value={editableSystemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          placeholder="系统提示词..."
          className="nodrag nopan nowheel min-h-[120px] max-h-[300px] w-full overflow-y-auto bg-transparent text-sm leading-6 text-white/90 placeholder:text-white/30 resize-none outline-none"
        />
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-between gap-3">
        {/* 模型选择下拉 */}
        <div className="relative flex-1">
          <button
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/70 transition-colors hover:border-[#B43FEB]/30 hover:text-white/90 hover:bg-white/[0.04]"
          >
            <span>
              {TEXT_AGENT_MODELS.find((m) => m.value === currentModel)?.label ||
                currentModel}
            </span>
            <IconChevronDown
              size={14}
              className={cn(
                "transition-transform",
                showModelDropdown && "rotate-180",
              )}
            />
          </button>

          {/* 下拉选项 */}
          {showModelDropdown && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-white/[0.06] bg-[#09090b] py-1 shadow-xl">
              {TEXT_AGENT_MODELS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => {
                    onModelChange(m.value);
                    setShowModelDropdown(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-xs transition-colors",
                    currentModel === m.value
                      ? "bg-[#B43FEB]/20 text-[#B43FEB]"
                      : "text-white/60 hover:bg-white/5",
                  )}
                >
                  <span>{m.label}</span>
                  {currentModel === m.value && <IconCheck size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {scoreCost ? (
            <ModelPointsBadge
              totalPoints={totalPoints}
              requiredPoints={scoreCost}
              title={`生成需要 ${scoreCost} 积分，当前余额 ${totalPoints}`}
              className="h-8 rounded-lg px-2.5 py-0"
            />
          ) : null}

          <Button
            disabled={isGenerating}
            onClick={onGenerate}
            className={cn(
              "gap-1.5 h-8 px-4 text-xs font-medium rounded-lg transition-colors active:scale-[0.97]",
              isGenerating
                ? "bg-white/10 text-white/40 cursor-not-allowed"
                : "bg-[#B43FEB] text-white hover:bg-[#B43FEB]/80",
            )}
          >
            <IconSend size={14} />
            {isGenerating ? "生成中..." : "生成"}
          </Button>
        </div>
      </div>
    </div>
  );
};
