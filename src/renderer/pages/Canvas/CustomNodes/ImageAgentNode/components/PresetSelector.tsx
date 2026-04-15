/**
 * 图片智能体 - 预设选择器组件
 * 用于首次选择智能体类型（当前只有图片反推）
 */
import { IconPhoto, IconSparkles } from "@tabler/icons-react";
import { IMAGE_AGENT_PRESET_LIST } from "shared/constants/image-agent-presets";
import type { ImageAgentPresetId } from "shared/types/flow";

const PRESET_ICONS: Record<ImageAgentPresetId, React.ReactNode> = {
  "image-reverse-prompt": <IconPhoto size={18} />,
};

interface PresetSelectorProps {
  onSelect: (presetId: ImageAgentPresetId) => void;
}

export const PresetSelector = ({ onSelect }: PresetSelectorProps) => {
  return (
    <div className="w-[280px] bg-[#1a1a1c] border border-white/[0.08] rounded-xl p-5 animate-in fade-in duration-300">
      {/* 标题 */}
      <div className="flex items-center gap-2 text-sm text-white/50 mb-8">
        <IconSparkles size={16} className="text-[#B43FEB]" />
        <span>图片智能体</span>
      </div>

      {/* 图标占位 */}
      <div className="flex justify-center mb-8 text-white/30">
        <IconPhoto size={40} />
      </div>

      {/* 选择标签 */}
      <div className="text-xs text-white/50 mb-3">选择智能体：</div>

      {/* 预设列表 */}
      <div className="flex flex-col gap-1">
        {IMAGE_AGENT_PRESET_LIST.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all hover:bg-white/[0.05]"
          >
            <span className="text-white/40">{PRESET_ICONS[p.id]}</span>
            <div className="flex flex-col">
              <span className="text-sm text-white/80">{p.label}</span>
              <span className="text-xs text-white/30 mt-0.5">
                {p.description}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
