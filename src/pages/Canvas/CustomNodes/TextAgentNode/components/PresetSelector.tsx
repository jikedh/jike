/**
 * 预设选择器组件
 * 用于首次选择或切换文本智能体类型
 */
import {
  IconSparkles,
  IconBook,
  IconVideo,
  IconPhoto,
  IconUser,
} from "@tabler/icons-react";
import { TEXT_AGENT_PRESET_LIST } from "@/constants/text-agent-presets";
import type { TextAgentPresetId } from "@/types/flow";

const PRESET_ICONS: Record<TextAgentPresetId, React.ReactNode> = {
  "novel-to-script-agent": <IconBook size={18} />,
  "short-video-storyboard": <IconVideo size={18} />,
  "jimeng-prompt": <IconPhoto size={18} />,
  "novel-character-design": <IconUser size={18} />,
};

interface PresetSelectorProps {
  onSelect: (presetId: TextAgentPresetId) => void;
}

export const PresetSelector = ({ onSelect }: PresetSelectorProps) => {
  return (
    <div className="w-[280px] bg-[#1a1a1c] border border-white/[0.08] rounded-xl p-5 animate-in fade-in duration-300">
      {/* 标题 */}
      <div className="flex items-center gap-2 text-sm text-white/50 mb-8">
        <IconSparkles size={16} className="text-[#B43FEB]" />
        <span>文本智能体</span>
      </div>

      {/* 图标占位 */}
      <div className="flex justify-center mb-8 text-white/30">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M4 6h16M4 12h10M4 18h6" />
        </svg>
      </div>

      {/* 选择标签 */}
      <div className="text-xs text-white/50 mb-3">选择智能体：</div>

      {/* 预设列表 */}
      <div className="flex flex-col gap-1">
        {TEXT_AGENT_PRESET_LIST.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all hover:bg-white/[0.05]"
          >
            <span className="text-white/40">{PRESET_ICONS[p.id]}</span>
            <span className="text-sm text-white/80">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
