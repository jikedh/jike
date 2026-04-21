/**
 * 视频模型参数配置表
 * 定义每个模型的参数项、选项、默认值和字段映射
 */

/** 参数控件类型 */
export type ParamControlType = "buttons" | "select" | "switch";

/** 参数项定义 */
export interface ParamItem {
  /** 参数键名 */
  key: string;
  /** UI 显示标签 */
  label: string;
  /** 控件类型 */
  controlType: ParamControlType;
  /** 选项列表（buttons/select 用） */
  options?: Array<{ label: string; value: string | number }>;
  /** 默认值 */
  defaultValue: string | number | boolean;
  /** 取值范围描述（用于 label 动态显示） */
  range?: { min: number; max: number };
}

/** 单个模型的参数配置 */
export interface ModelParamConfig {
  /** 模型标识 */
  model: string;
  /** 参数项列表 */
  params: ParamItem[];
  /** 默认值映射（用于快速重置） */
  defaults: Record<string, string | number | boolean>;
}

/**
 * 模型参数配置表
 * key: 模型完整名称
 * value: ModelParamConfig
 */
const MODEL_PARAM_CONFIGS: Record<string, ModelParamConfig> = {
  // ===================== Doubao Seedance 2.0 =====================
  "doubao-seedance-2.0": {
    model: "doubao-seedance-2.0",
    params: [
      {
        key: "mode",
        label: "生成模式",
        controlType: "buttons",
        options: [
          { label: "Fast", value: "fast" },
          { label: "Pro", value: "pro" },
        ],
        defaultValue: "fast",
      },
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
          { label: "8秒", value: 8 },
          { label: "10秒", value: 10 },
        ],
        defaultValue: 8,
      },
      {
        key: "aspect_ratio",
        label: "画面比例",
        controlType: "buttons",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "4:3", value: "4:3" },
          { label: "1:1", value: "1:1" },
          { label: "3:4", value: "3:4" },
          { label: "9:16", value: "9:16" },
          { label: "21:9", value: "21:9" },
          { label: "自适应", value: "adaptive" },
        ],
        defaultValue: "16:9",
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "720p", value: "720p" },
          { label: "480p", value: "480p" },
        ],
        defaultValue: "720p",
      },
      {
        key: "generate_audio",
        label: "生成音频",
        controlType: "switch",
        defaultValue: false,
      },
    ],
    defaults: {
      mode: "fast",
      duration: 8,
      aspect_ratio: "16:9",
      resolution: "720p",
      generate_audio: false,
    },
  },

  // ===================== Wanxiang (wan2.7-t2v / i2v / r2v) =====================
  "wan2.7-t2v": {
    model: "wan2.7-t2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
          { label: "10秒", value: 10 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "720P", value: "720P" },
          { label: "1080P", value: "1080P" },
        ],
        defaultValue: "1080P",
      },
      {
        key: "aspect_ratio",
        label: "画面比例",
        controlType: "buttons",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1080P",
      aspect_ratio: "16:9",
    },
  },
  "wan2.7-i2v": {
    model: "wan2.7-i2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
          { label: "10秒", value: 10 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "720P", value: "720P" },
          { label: "1080P", value: "1080P" },
        ],
        defaultValue: "1080P",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1080P",
    },
  },
  "wan2.7-r2v": {
    model: "wan2.7-r2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
          { label: "10秒", value: 10 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "720P", value: "720P" },
          { label: "1080P", value: "1080P" },
        ],
        defaultValue: "1080P",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1080P",
    },
  },

  // ===================== Kling (kling-v3-video-generation / kling-v3-omni-video-generation) =====================
  "kling/kling-v3-video-generation": {
    model: "kling/kling-v3-video-generation",
    params: [
      {
        key: "mode",
        label: "生成模式",
        controlType: "buttons",
        options: [
          { label: "Std", value: "std" },
          { label: "Pro", value: "pro" },
        ],
        defaultValue: "pro",
      },
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "5秒", value: 5 },
          { label: "10秒", value: 10 },
        ],
        defaultValue: 5,
      },
      {
        key: "aspect_ratio",
        label: "画面比例",
        controlType: "buttons",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "720P", value: "720P" },
          { label: "1080P", value: "1080P" },
        ],
        defaultValue: "1080P",
      },
    ],
    defaults: {
      mode: "pro",
      duration: 5,
      aspect_ratio: "16:9",
      resolution: "1080P",
    },
  },
  "kling/kling-v3-omni-video-generation": {
    model: "kling/kling-v3-omni-video-generation",
    params: [
      {
        key: "mode",
        label: "生成模式",
        controlType: "buttons",
        options: [
          { label: "Std", value: "std" },
          { label: "Pro", value: "pro" },
        ],
        defaultValue: "pro",
      },
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "5秒", value: 5 },
          { label: "10秒", value: 10 },
        ],
        defaultValue: 5,
      },
      {
        key: "aspect_ratio",
        label: "画面比例",
        controlType: "buttons",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "720P", value: "720P" },
          { label: "1080P", value: "1080P" },
        ],
        defaultValue: "1080P",
      },
    ],
    defaults: {
      mode: "pro",
      duration: 5,
      aspect_ratio: "16:9",
      resolution: "1080P",
    },
  },

  // ===================== PixVerse (t2v / it2v / kf2v / r2v) =====================
  "pixverse/pixverse-v6-t2v": {
    model: "pixverse/pixverse-v6-t2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-v6-it2v": {
    model: "pixverse/pixverse-v6-it2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-v6-kf2v": {
    model: "pixverse/pixverse-v6-kf2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-c1-t2v": {
    model: "pixverse/pixverse-c1-t2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-c1-it2v": {
    model: "pixverse/pixverse-c1-it2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-c1-kf2v": {
    model: "pixverse/pixverse-c1-kf2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-c1-r2v": {
    model: "pixverse/pixverse-c1-r2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-v5.6-t2v": {
    model: "pixverse/pixverse-v5.6-t2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-v5.6-it2v": {
    model: "pixverse/pixverse-v5.6-it2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-v5.6-kf2v": {
    model: "pixverse/pixverse-v5.6-kf2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },
  "pixverse/pixverse-v5.6-r2v": {
    model: "pixverse/pixverse-v5.6-r2v",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "高清", value: "1280*720" },
          { label: "标清", value: "768*512" },
        ],
        defaultValue: "1280*720",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "1280*720",
    },
  },

  // ===================== Vidu (viduq3-turbo_text2video) =====================
  "vidu/viduq3-turbo_text2video": {
    model: "vidu/viduq3-turbo_text2video",
    params: [
      {
        key: "duration",
        label: "视频时长",
        controlType: "buttons",
        options: [
          { label: "4秒", value: 4 },
          { label: "5秒", value: 5 },
          { label: "8秒", value: 8 },
        ],
        defaultValue: 5,
      },
      {
        key: "resolution",
        label: "分辨率",
        controlType: "buttons",
        options: [
          { label: "540P", value: "540P" },
          { label: "720P", value: "720P" },
          { label: "1080P", value: "1080P" },
        ],
        defaultValue: "720P",
      },
    ],
    defaults: {
      duration: 5,
      resolution: "720P",
    },
  },
};

/**
 * 获取模型的参数配置
 * @param model 模型名称
 * @returns 模型参数配置，未找到返回 undefined
 */
export const getModelParamConfig = (
  model: string,
): ModelParamConfig | undefined => {
  return MODEL_PARAM_CONFIGS[model];
};

/**
 * 获取模型的默认参数值
 * @param model 模型名称
 * @returns 默认值映射
 */
export const getModelDefaultParams = (
  model: string,
): Record<string, string | number | boolean> | undefined => {
  const config = MODEL_PARAM_CONFIGS[model];
  return config?.defaults;
};
