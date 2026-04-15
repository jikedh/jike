/**
 * ============================================
 * PresetSelector - 图片智能体预设选择器组件
 * ============================================
 *
 * 【组件功能】
 * 首次创建图片智能体节点时，让用户选择具体的智能体类型。
 * 也可用于切换/更改智能体类型。
 *
 * 【使用场景】
 * 1. 首次拖入图片智能体节点到画布时
 * 2. 用户点击切换预设时
 *
 * 【布局结构】
 * ┌────────────────────────────────────┐
 * │  ✨ 图片智能体                      │ ← 标题区
 * │                                    │
 * │           [图片图标]                │ ← 占位图标
 * │                                    │
 * │  选择智能体：                       │ ← 选择提示
 * │  ┌────────────────────────────┐   │
 * │  │ 📷 图片反推                 │   │ ← 预设选项
 * │  └────────────────────────────┘   │
 * └────────────────────────────────────┘
 *
 * 【预设列表】
 * - image-reverse-prompt：图片反推（根据图片生成描述文字）
 */
import {
  IconSparkles,
  IconPhoto,
} from "@tabler/icons-react";
import { IMAGE_AGENT_PRESET_LIST } from "shared/constants/image-agent-presets";
import type { ImageAgentPresetId } from "shared/types/flow";

/**
 * ============================================
 * 预设图标映射
 * ============================================
 *
 * 【说明】
 * 每个预设 ID 对应一个图标，用于在选择器中展示
 */
const PRESET_ICONS: Record<ImageAgentPresetId, React.ReactNode> = {
  "image-reverse-prompt": <IconPhoto size={18} />,
};

/**
 * ============================================
 * PresetSelector Props 接口定义
 * ============================================
 */
interface PresetSelectorProps {
  /**
   * 预设选择回调
   * @param presetId - 用户选择的预设 ID
   * @description
   * 当用户点击某个预设选项时，触发此回调。
   * 父组件负责更新节点数据并关闭选择器。
   */
  onSelect: (presetId: ImageAgentPresetId) => void;
}

/**
 * ============================================
 * PresetSelector 组件
 * ============================================
 *
 * 【功能说明】
 * 展示所有可用的图片智能体预设选项，
 * 用户点击后触发 onSelect 回调。
 *
 * @param onSelect - 选择预设后的回调函数
 */
export const PresetSelector = ({ onSelect }: PresetSelectorProps) => {
  return (
    <div className="w-[280px] bg-[#1a1a1c] border border-white/[0.08] rounded-xl p-5 animate-in fade-in duration-300">
      {/* ============================================
          标题区域
          ============================================ */}
      <div className="flex items-center gap-2 text-sm text-white/50 mb-8">
        <IconSparkles size={16} className="text-[#B43FEB]" />
        <span>图片智能体</span>
      </div>

      {/* ============================================
          中央图标占位区域
          用于视觉引导，提示用户进行选择
          ============================================ */}
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
          {/* 相机/图片图标 SVG 路径 */}
          <path d="M15 8h.01"></path>
          <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12"></path>
          <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"></path>
          <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"></path>
        </svg>
      </div>

      {/* ============================================
          选择提示文本
          ============================================ */}
      <div className="text-xs text-white/50 mb-3">选择智能体：</div>

      {/* ============================================
          预设选项列表
          ============================================ */}
      <div className="flex flex-col gap-1">
        {IMAGE_AGENT_PRESET_LIST.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all hover:bg-white/[0.05]"
          >
            {/* 预设对应图标 */}
            <span className="text-white/40">{PRESET_ICONS[p.id]}</span>
            {/* 预设显示名称 */}
            <span className="text-sm text-white/80">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
