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
