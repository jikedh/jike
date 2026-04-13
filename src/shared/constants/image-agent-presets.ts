import type { ImageAgentPresetId } from "shared/types/flow";

export const IMAGE_AGENT_PRESETS: Record<
  ImageAgentPresetId,
  {
    id: ImageAgentPresetId;
    label: string;
    description: string;
    model: string;
    systemPrompt: string;
  }
> = {
  "image-reverse-prompt": {
    id: "image-reverse-prompt",
    label: "图片反推",
    description: "根据图片内容反推生成提示词",
    model: "gemini-2.0-flash-exp",
    systemPrompt: `请仔细分析这张图片的内容，包括：
1. 画面主题和主体
2. 场景和环境
3. 色彩和光线
4. 构图和视角
5. 风格和氛围

请生成用于 AI 图像生成的详细英文提示词，输出格式为纯文本提示词，不要使用 Markdown 格式。`,
  },
};

export const IMAGE_AGENT_PRESET_LIST = Object.values(IMAGE_AGENT_PRESETS);

export const getImageAgentPresetById = (presetId?: ImageAgentPresetId) => {
  const defaultPreset = IMAGE_AGENT_PRESETS["image-reverse-prompt"];
  if (!presetId) {
    return defaultPreset;
  }
  return IMAGE_AGENT_PRESETS[presetId] ?? defaultPreset;
};

export const isImageAgentPresetId = (
  value?: string,
): value is ImageAgentPresetId => {
  if (!value) {
    return false;
  }
  return value in IMAGE_AGENT_PRESETS;
};

export const getImageAgentPresetLabelById = (presetId?: string) => {
  if (isImageAgentPresetId(presetId)) {
    return IMAGE_AGENT_PRESETS[presetId].label;
  }
  return IMAGE_AGENT_PRESETS["image-reverse-prompt"].label;
};

export const IMAGE_AGENT_MODELS = [
  { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash" },
];
