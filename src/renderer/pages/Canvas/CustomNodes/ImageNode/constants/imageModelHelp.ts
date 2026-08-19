export const IMAGE_MODEL_HELP_TEXTS: Record<string, string> = {
    "gpt-image-2": "参考图：支持多图输入，建议最多六张",
    "runninghub-gpt-image-2": "参考图：最多 10 张。",
    "runninghub-nano-banana-pro": "参考图：最多 10 张。",
    "runninghub-midjourney-v8.1": `参考图：仅使用第一张图片作为垫图。
Chaos（0-100）：控制结果的随机性和差异，值越高，构图与细节变化越明显。
Stylize（0-1000）：控制模型艺术风格的表现强度，值越高，画面越偏向风格化表达。
IW（0-3）：控制垫图对生成结果的影响强度，仅在提供参考图时生效，值越高越贴近垫图。`,
    "gemini-3-pro-image-preview": "参考图：最多 14 张。",
    "doubao-seedream-5-0": "参考图：最多 10 张。",
};

export const getImageModelHelp = (modelId: string) =>
    IMAGE_MODEL_HELP_TEXTS[modelId] ?? "该模型的参考素材输入要求正在补充中。";
