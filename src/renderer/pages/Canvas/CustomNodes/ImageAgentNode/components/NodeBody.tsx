/**
 * ============================================
 * NodeBody - 图片智能体节点主体组件
 * ============================================
 *
 * 【组件功能】
 * 显示图片智能体节点的核心视觉区域。
 * 包含左右两端的连接手柄、预设图标和状态信息。
 *
 * 【布局结构】
 *       ┌─────────────────────────┐
 *  ◀── │                         │ ──▶
 *  input                  output
 *       │    ┌───────────┐       │
 *       │    │  📷 图标  │       │
 *       │    │ 图片反推  │       │
 *       │    └───────────┘       │
 *       └─────────────────────────┘
 *
 * 【状态显示】
 * - 空闲状态：显示预设图标和预设名称
 * - 生成中：显示旋转加载动画和"生成中..."文字
 *
 * 【交互行为】
 * - 节点选中时：手柄始终可见，边框高亮
 * - 节点未选中时：手柄在悬停时可见
 */
import { Position } from "@xyflow/react";
import { IconPhoto } from "@tabler/icons-react";
import { ButtonHandle } from "@/components/button-handle";
import type { ImageAgentPresetId } from "shared/types/flow";
import { cn } from "shared/utils/utils";

/**
 * ============================================
 * 预设图标映射
 * ============================================
 *
 * 【说明】
 * 不同预设类型对应不同的图标
 * 目前只定义了 image-reverse-prompt（图片反推）类型
 */
const PRESET_ICONS: Record<ImageAgentPresetId, React.ReactNode> = {
  "image-reverse-prompt": <IconPhoto size={18} />,
};

/**
 * ============================================
 * NodeBody Props 接口定义
 * ============================================
 */
interface NodeBodyProps {
  /** 当前预设 ID，用于显示对应图标 */
  presetId: ImageAgentPresetId | undefined;

  /** 预设的显示标签 */
  presetLabel: string;

  /** 节点是否被选中 */
  selected: boolean;

  /** 是否正在生成中 */
  isGenerating: boolean;
}

/**
 * ============================================
 * NodeBody 组件
 * ============================================
 *
 * 【样式变化】
 * - 未选中 + 未悬停：灰色边框，手柄不可见
 * - 未选中 + 悬停：浅色边框，手柄可见
 * - 选中：紫色高亮边框 + 发光效果，手柄始终可见
 */
export const NodeBody = ({
  presetId,
  presetLabel,
  selected,
  isGenerating,
}: NodeBodyProps) => {
  // ============================================
  // 手柄可见性控制
  // ============================================

  /**
   * 手柄可见性样式类
   *
   * 【逻辑】
   * - 选中状态：始终可见（visible + 完全不透明）
   * - 未选中状态：不可见，悬停时变为可见（group-hover）
   */
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
      {/* ============================================
          左侧输入手柄
          用于连接来自图片节点的边
          ============================================ */}
      <ButtonHandle
        type="target"
        position={Position.Left}
        id="input"
        visible
        className={`transition-opacity duration-150 ${handleVisibilityClass}`}
      />

      {/* ============================================
          右侧输出手柄
          用于连接输出到便签节点的边
          ============================================ */}
      <ButtonHandle
        type="source"
        position={Position.Right}
        id="output"
        visible
        className={`transition-opacity duration-150 ${handleVisibilityClass}`}
      />

      {/* ============================================
          节点中心内容区
          ============================================ */}
      <div className="flex items-center gap-2 text-sm text-white/50">
        {isGenerating ? (
          /* 生成中状态：显示旋转加载动画 */
          <>
            <div className="relative w-5 h-5">
              {/* 外圈：灰色静态圆环 */}
              <div className="absolute inset-0 border-2 border-[#B43FEB]/30 rounded-full"></div>
              {/* 内圈：紫色旋转圆环 */}
              <div className="absolute inset-0 border-2 border-transparent border-t-[#B43FEB] rounded-full animate-spin"></div>
            </div>
            <span>生成中...</span>
          </>
        ) : (
          /* 空闲状态：显示预设图标和名称 */
          <>
            {presetId && PRESET_ICONS[presetId]}
            <span>{presetLabel}</span>
          </>
        )}
      </div>
    </div>
  );
};
