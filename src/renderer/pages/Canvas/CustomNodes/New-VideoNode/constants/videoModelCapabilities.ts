/**
 * 新版视频节点 — 模型能力配置
 *
 * 定义主模型 → 子模型 → 支持模式的映射关系。
 * 这是领域配置，Mock 和真实阶段共用。
 */

// ==================== 模式定义 ====================

export type VideoModeKey =
  | "text-to-video" // 文生视频：纯文本生成，无参考图
  | "all-reference" // 全能参考：同时支持图片/视频/音频参考
  | "image-to-video" // 图生视频：以单张或多张图片为参考
  | "video-edit" // 视频编辑：以视频素材为主体，可附加参考图
  | "first-last-frame"; // 首尾帧：仅支持 1-2 张图作为首帧/尾帧

// ==================== 子模型定义 ====================

/**
 * 子模型变体
 * 每个主模型可能包含一个或多个子模型，针对不同任务微调/定制。
 * 用户无感知，仅由系统后台自动调度匹配。
 */
export interface SubVariant {
  /** 子模型标识（系统内部使用，不展示给用户） */
  id: string;
  /** 此子模型支持的模式列表 */
  supportedModes: VideoModeKey[];
  /** 此子模式的默认参数覆盖（可选） */
  defaultParams?: Record<string, unknown>;
}

// ==================== 主模型定义 ====================

/**
 * 主模型（用户可见）
 */
export interface MainModelConfig {
  /** 主模型标识 */
  id: string;
  /** UI 显示名称 */
  label: string;
  /** 此主模型包含的所有子模型变体 */
  variants: SubVariant[];
}

// ==================== 模式标签 ====================

export const MODE_LABELS: Record<VideoModeKey, string> = {
  "text-to-video": "文生视频",
  "all-reference": "全能参考",
  "image-to-video": "图生视频",
  "video-edit": "视频编辑",
  "first-last-frame": "首尾帧",
};

// ==================== 参考图数量约束 ====================

export interface ModeReferenceConstraint {
  /** 最小参考图数量（含），undefined 表示无下限 */
  minRefCount?: number;
  /** 最大参考图数量（含），undefined 表示无上限 */
  maxRefCount?: number;
  /** 依赖其他类型的参考（视频/音频），仅全能参考需要 */
  requiresAnyReference?: boolean;
  /** 是否要求全部为图片类型 */
  requiresAllImages?: boolean;
}

/** 各模式对参考图数量的约束规则 */
export const MODE_REFERENCE_CONSTRAINTS: Record<
  VideoModeKey,
  ModeReferenceConstraint
> = {
  "text-to-video": { maxRefCount: 0 }, // 文生视频不允许参考图
  "all-reference": {}, // 全能参考保持默认可选；生成时再校验是否已有参考素材
  "image-to-video": { minRefCount: 1, requiresAllImages: true }, // 至少一张图，且全部为图片
  "video-edit": { requiresAnyReference: true }, // 具体视频/图片数量由模型适配层判断
  "first-last-frame": {}, // 首尾帧在 useModeAvailability 中特殊判断：恰好2项且全为图片
};

// ==================== 所有模式按键顺序 ====================

export const ALL_MODE_KEYS: VideoModeKey[] = [
  "text-to-video",
  "all-reference",
  "image-to-video",
  "video-edit",
  "first-last-frame",
];

// ==================== Mock 模型配置数据 ====================

/**
 * 主模型配置列表（Mock 数据，后续替换为真实 API 返回）
 *
 * 设计原则：
 * - 用户只看到主模型（如 "Wan2.7"、"Seedance 2.0 VIP"）
 * - 每个主模型包含一个或多个子模型变体，针对不同任务微调
 * - 子模型完全对用户隐藏，由系统自动根据当前模式调度
 */
export const MOCK_MAIN_MODELS: MainModelConfig[] = [
  {
    id: "seedance-2.0-fast",
    label: "Seedance 2.0 Fast",
    variants: [
      {
        id: "seedance-2.0-fast",
        supportedModes: [
          "text-to-video",
          "all-reference",
          "image-to-video",
          "first-last-frame",
        ],
        // 与旧版视频节点一致：Fast/Pro 作为独立模型展示，生成档位由模型项固定。
        defaultParams: { generationMode: "fast" },
      },
    ],
  },
  {
    id: "seedance-2.0-pro",
    label: "Seedance 2.0 Pro",
    variants: [
      {
        id: "seedance-2.0-pro",
        supportedModes: [
          "text-to-video",
          "all-reference",
          "image-to-video",
          "first-last-frame",
        ],
        // 与旧版视频节点一致：Fast/Pro 作为独立模型展示，生成档位由模型项固定。
        defaultParams: { generationMode: "pro" },
      },
    ],
  },
  {
    id: "dreamina-seedance-2-0-260128",
    label: "海外 Seedance 2.0 Pro",
    variants: [
      {
        id: "dreamina-seedance-2-0-260128",
        supportedModes: [
          "text-to-video",
          "all-reference",
          "image-to-video",
          "first-last-frame",
        ],
        defaultParams: { generationMode: "pro" },
      },
    ],
  },
  {
    id: "wanxiang",
    label: "Wan2.7",
    variants: [
      {
        id: "wan2.7-t2v",
        supportedModes: ["text-to-video"],
      },
      {
        id: "wan2.7-i2v",
        supportedModes: ["image-to-video", "first-last-frame"],
      },
      {
        id: "wan2.7-r2v",
        supportedModes: ["all-reference", "image-to-video"],
      },
    ],
  },
  {
    id: "vidu-q3-pro",
    label: "Vidu Q3 Pro",
    variants: [
      {
        id: "vidu/viduq3-pro_text2video",
        supportedModes: ["text-to-video"],
      },
      {
        id: "vidu/viduq3-pro_img2video",
        supportedModes: ["image-to-video"],
      },
      {
        id: "vidu/viduq3-pro_start-end2video",
        supportedModes: ["first-last-frame"],
      },
    ],
  },
  {
    id: "vidu",
    label: "Vidu Q3 Turbo",
    variants: [
      {
        id: "vidu/viduq3_turbo_text2video",
        supportedModes: ["text-to-video"],
      },
      {
        id: "vidu/viduq3_turbo_img2video",
        supportedModes: ["image-to-video"],
      },
      {
        id: "vidu/viduq3_turbo_start-end2video",
        supportedModes: ["first-last-frame"],
      },
    ],
  },
  {
    id: "pixverse",
    label: "PixVerse C1",
    variants: [
      {
        id: "pixverse/pixverse-v6-t2v",
        supportedModes: ["text-to-video"],
      },
      {
        id: "pixverse/pixverse-v6-it2v",
        supportedModes: ["image-to-video"],
      },
      {
        id: "pixverse/pixverse-v6-kf2v",
        supportedModes: ["first-last-frame"],
      },
      {
        id: "pixverse/pixverse-c1-r2v",
        supportedModes: ["all-reference"],
      },
    ],
  },
  {
    id: "happyhorse",
    label: "HappyHorse",
    variants: [
      {
        id: "happyhorse-1.0-t2v",
        supportedModes: ["text-to-video"],
      },
      {
        id: "happyhorse-1.0-r2v",
        supportedModes: ["all-reference"],
      },
      {
        id: "happyhorse-1.0-i2v",
        supportedModes: ["image-to-video"],
      },
      {
        id: "happyhorse-1.0-video-edit",
        supportedModes: ["video-edit"],
      },
    ],
  },
  {
    id: "keling",
    label: "Keling V3",
    variants: [
      {
        id: "kling/kling-v3-video-generation",
        supportedModes: ["text-to-video", "image-to-video", "first-last-frame"],
      },
      {
        id: "kling/kling-v3-omni-video-generation",
        supportedModes: ["all-reference"],
      },
    ],
  },
  {
    // Agnes-Video-V2.0 通过桌面代理接入 apihub.agnes-ai.com
    id: "agnes-video-v2.0",
    label: "Agnes Video V2.0",
    variants: [
      {
        id: "agnes-video-v2.0",
        supportedModes: ["text-to-video", "image-to-video"],
      },
    ],
  },
];

export const getVisibleVideoModels = () => MOCK_MAIN_MODELS;

export const getSupportedModesForModel = (modelId: string): VideoModeKey[] => {
  const modelConfig = MOCK_MAIN_MODELS.find((model) => model.id === modelId);
  const modes = new Set<VideoModeKey>();

  for (const variant of modelConfig?.variants ?? []) {
    for (const mode of variant.supportedModes) {
      modes.add(mode);
    }
  }

  return Array.from(modes);
};

export const getFirstSupportedModeForModel = (
  modelId: string,
  fallback: VideoModeKey = "text-to-video",
) => getSupportedModesForModel(modelId)[0] ?? fallback;

/**
 * 模式可用性状态
 */
export interface ModeState {
  key: VideoModeKey;
  label: string;
  enabled: boolean;
  disabledReason?: string;
  tooltip?: string;
}
