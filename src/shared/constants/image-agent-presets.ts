import type { ImageAgentPresetId } from "shared/types/flow";

/**
 * 图片智能体预设配置
 * 图片反推：根据图片内容生成详细的提示词描述
 */
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
        description: "分析图片内容，反推出可复现该图片风格的详细提示词",
        model: "qwen3.5-flash",
        systemPrompt: `请仔细分析这张图片，并生成一段详细的提示词（Prompt），要求：
1. 描述图片的主体内容、构图布局
2. 分析画面风格、艺术手法（写实/卡通/油画等）
3. 提炼色调、光影、氛围特征
4. 列出关键视觉元素（背景、前景、细节）
5. 最终输出一段可直接用于 AI 图像生成的英文提示词

请先用中文进行分析，再在最后输出英文提示词。`,
    },
};

export const IMAGE_AGENT_PRESET_LIST = Object.values(IMAGE_AGENT_PRESETS);

export const getImageAgentPresetById = (presetId?: ImageAgentPresetId) => {
    const defaultPreset = IMAGE_AGENT_PRESETS["image-reverse-prompt"];
    if (!presetId) return defaultPreset;
    return IMAGE_AGENT_PRESETS[presetId] ?? defaultPreset;
};

export const isImageAgentPresetId = (
    value?: string,
): value is ImageAgentPresetId => {
    if (!value) return false;
    return value in IMAGE_AGENT_PRESETS;
};

export const getImageAgentPresetLabelById = (presetId?: string) => {
    if (isImageAgentPresetId(presetId)) {
        return IMAGE_AGENT_PRESETS[presetId].label;
    }
    return IMAGE_AGENT_PRESETS["image-reverse-prompt"].label;
};

/** 图片智能体可用模型列表（暂时只有 qwen3.5-flash） */
export const IMAGE_AGENT_MODELS = [
    { value: "qwen3.5-flash", label: "Qwen 3.5 Flash (阿里云百炼)" },
];
