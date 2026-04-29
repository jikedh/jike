/**
 * 瑙嗛妯″瀷鍙傛暟閰嶇疆琛? * 瀹氫箟姣忎釜妯″瀷鐨勫弬鏁伴」銆侀€夐」銆侀粯璁ゅ€煎拰瀛楁鏄犲皠
 */

/** 鍙傛暟鎺т欢绫诲瀷 */
export type ParamControlType = "buttons" | "select" | "switch" | "slider";

/** 鍙傛暟椤瑰畾涔?*/
export interface ParamItem {
  /** 鍙傛暟閿悕 */
  key: string;
  /** UI 鏄剧ず鏍囩 */
  label: string;
  /** 鎺т欢绫诲瀷 */
  controlType: ParamControlType;
  /** 閫夐」鍒楄〃锛坆uttons/select 鐢級 */
  options?: Array<{ label: string; value: string | number }>;
  /** 榛樿鍊?*/
  defaultValue: string | number | boolean;
  /** 鍙栧€艰寖鍥存弿杩帮紙鐢ㄤ簬 label 鍔ㄦ€佹樉绀猴級 */
  range?: { min: number; max: number };
}

/** 鍗曚釜妯″瀷鐨勫弬鏁伴厤缃?*/
export interface ModelParamConfig {
  /** 妯″瀷鏍囪瘑 */
  model: string;
  /** 鍙傛暟椤瑰垪琛?*/
  params: ParamItem[];
  /** 榛樿鍊兼槧灏勶紙鐢ㄤ簬蹇€熼噸缃級 */
  defaults: Record<string, string | number | boolean>;
}

/**
 * 妯″瀷鍙傛暟閰嶇疆琛? * key: 妯″瀷瀹屾暣鍚嶇О
 * value: ModelParamConfig
 */
const MODEL_PARAM_CONFIGS: Record<string, ModelParamConfig> = {
  // ===================== Doubao Seedance 2.0 =====================
  "doubao-seedance-2.0": {
    model: "doubao-seedance-2.0",
    params: [
      {
        key: "mode",
        label: "鐢熸垚妯″紡",
        controlType: "buttons",
        options: [
          { label: "Fast", value: "fast" },
          { label: "Pro", value: "pro" },
        ],
        defaultValue: "fast",
      },
      {
        key: "aspect_ratio",
        label: "鐢婚潰姣斾緥",
        controlType: "buttons",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "4:3", value: "4:3" },
          { label: "1:1", value: "1:1" },
          { label: "3:4", value: "3:4" },
          { label: "9:16", value: "9:16" },
          { label: "21:9", value: "21:9" },
          { label: "鑷€傚簲", value: "adaptive" },
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
        key: "duration",
        label: "瑙嗛鏃堕暱",
        controlType: "slider",
        range: { min: 4, max: 15 },
        defaultValue: 8,
      },
      {
        key: "generate_audio",
        label: "鐢熸垚闊抽",
        controlType: "switch",
        defaultValue: true,
      },
    ],
    defaults: {
      mode: "fast",
      duration: 8,
      aspect_ratio: "16:9",
      resolution: "720p",
      generate_audio: true,
    },
  },
};

/**
 * 鑾峰彇妯″瀷鐨勫弬鏁伴厤缃? * @param model 妯″瀷鍚嶇О
 * @returns 妯″瀷鍙傛暟閰嶇疆锛屾湭鎵惧埌杩斿洖 undefined
 */
export const getModelParamConfig = (
  model: string,
): ModelParamConfig | undefined => {
  return MODEL_PARAM_CONFIGS[model];
};

/**
 * 鑾峰彇妯″瀷鐨勯粯璁ゅ弬鏁板€? * @param model 妯″瀷鍚嶇О
 * @returns 榛樿鍊兼槧灏? */
export const getModelDefaultParams = (
  model: string,
): Record<string, string | number | boolean> | undefined => {
  const config = MODEL_PARAM_CONFIGS[model];
  return config?.defaults;
};

// ===================== Doubao Seedance 2.0 Fast =====================
/** 璞嗗寘 Seedance 2.0 Fast 鍙傛暟閰嶇疆锛坢ode 鍥哄畾涓?fast锛屼笉鏆撮湶缁欑敤鎴凤級 */
MODEL_PARAM_CONFIGS["doubao-seedance-2.0-fast"] = {
  model: "doubao-seedance-2.0-fast",
  params: [
    {
      key: "aspect_ratio",
      label: "鐢婚潰姣斾緥",
      controlType: "buttons",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "4:3", value: "4:3" },
        { label: "1:1", value: "1:1" },
        { label: "3:4", value: "3:4" },
        { label: "9:16", value: "9:16" },
        { label: "21:9", value: "21:9" },
        { label: "鑷€傚簲", value: "adaptive" },
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
      key: "duration",
      label: "瑙嗛鏃堕暱",
      controlType: "slider",
      range: { min: 4, max: 15 },
      defaultValue: 10,
    },
    {
      key: "generate_audio",
      label: "鐢熸垚闊抽",
      controlType: "switch",
      defaultValue: true,
    },
  ],
  defaults: {
    duration: 10,
    aspect_ratio: "16:9",
    resolution: "720p",
    generate_audio: true,
  },
};

// ===================== Doubao Seedance 2.0 Pro =====================
/** 璞嗗寘 Seedance 2.0 Pro 鍙傛暟閰嶇疆锛坢ode 鍥哄畾涓?pro锛屼笉鏆撮湶缁欑敤鎴凤級 */
MODEL_PARAM_CONFIGS["doubao-seedance-2.0-pro"] = {
  model: "doubao-seedance-2.0-pro",
  params: [
    {
      key: "aspect_ratio",
      label: "鐢婚潰姣斾緥",
      controlType: "buttons",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "4:3", value: "4:3" },
        { label: "1:1", value: "1:1" },
        { label: "3:4", value: "3:4" },
        { label: "9:16", value: "9:16" },
        { label: "21:9", value: "21:9" },
        { label: "鑷€傚簲", value: "adaptive" },
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
      key: "duration",
      label: "瑙嗛鏃堕暱",
      controlType: "slider",
      range: { min: 4, max: 15 },
      defaultValue: 10,
    },
    {
      key: "generate_audio",
      label: "鐢熸垚闊抽",
      controlType: "switch",
      defaultValue: true,
    },
  ],
  defaults: {
    duration: 10,
    aspect_ratio: "16:9",
    resolution: "720p",
    generate_audio: true,
  },
};
/** 涓囪薄妯″瀷鍙傛暟閰嶇疆 */
const WAN27R2V_PARAMS: ParamItem[] = [
  {
    key: "resolution",
    label: "分辨率",
    controlType: "buttons",
    options: [
      { label: "720p", value: "720P" },
      { label: "1080p", value: "1080P" },
    ],
    defaultValue: "1080P",
  },
  {
    key: "ratio",
    label: "鐢婚潰姣斾緥",
    controlType: "buttons",
    options: [
      { label: "16:9", value: "16:9" },
      { label: "9:16", value: "9:16" },
      { label: "1:1", value: "1:1" },
    ],
    defaultValue: "16:9",
  },
  {
    key: "duration",
    label: "瑙嗛鏃堕暱",
    controlType: "buttons",
    options: [
      { label: "2s", value: 2 },
      { label: "3s", value: 3 },
      { label: "4s", value: 4 },
      { label: "5s", value: 5 },
      { label: "6s", value: 6 },
      { label: "7s", value: 7 },
      { label: "8s", value: 8 },
      { label: "9s", value: 9 },
      { label: "10s", value: 10 },
    ],
    defaultValue: 5,
  },
  {
    key: "prompt_extend",
    label: "鏅鸿兘鏀瑰啓 prompt",
    controlType: "switch",
    defaultValue: false,
  },
];

// 娉ㄥ唽鍒?MODEL_PARAM_CONFIGS
MODEL_PARAM_CONFIGS["wan2.7-r2v"] = {
  model: "wan2.7-r2v",
  params: WAN27R2V_PARAMS,
  defaults: {
    resolution: "1080P",
    ratio: "16:9",
    duration: 5,
    prompt_extend: false,
  },
};

// ===================== PixVerse (涓囪薄绉掑垱) =====================
/** PixVerse 妯″瀷鍙傛暟閰嶇疆 */
const PIXVERSE_PARAMS: ParamItem[] = [
  {
    key: "subModel",
    label: "子模型",
    controlType: "buttons",
    options: [
      { label: "V6", value: "pixverse/pixverse-v6-it2v" },
      { label: "C1", value: "pixverse/pixverse-c1-it2v" },
    ],
    defaultValue: "pixverse/pixverse-v6-it2v",
  },
  {
    key: "resolution",
    label: "分辨率",
    controlType: "buttons",
    options: [
      { label: "360p", value: "360P" },
      { label: "540p", value: "540P" },
      { label: "720p", value: "720P" },
      { label: "1080p", value: "1080P" },
    ],
    defaultValue: "720P",
  },
  {
    key: "duration",
    label: "瑙嗛鏃堕暱",
    controlType: "buttons",
    options: [
      { label: "4s", value: 4 },
      { label: "5s", value: 5 },
      { label: "8s", value: 8 },
    ],
    defaultValue: 5,
  },
  {
    key: "audio",
    label: "鐢熸垚闊抽",
    controlType: "switch",
    defaultValue: false,
  },
];

// 娉ㄥ唽鍒?MODEL_PARAM_CONFIGS
MODEL_PARAM_CONFIGS["pixverse-i2v"] = {
  model: "pixverse-i2v",
  params: PIXVERSE_PARAMS,
  defaults: {
    subModel: "pixverse/pixverse-v6-it2v",
    resolution: "720P",
    duration: 5,
    audio: false,
  },
};
