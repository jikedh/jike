export const IMAGE_MODEL_HELP_TEXTS: Record<string, string> = {
    "gpt-image-2": "参考图：支持多图输入，建议最多六张",
    "runninghub-gpt-image-2": "参考图：最多 10 张。",
    "runninghub-nano-banana-pro": "参考图：最多 10 张。",
    "runninghub-midjourney-v8.1": "参考图：仅使用第一张图片作为垫图。",
    "gemini-3-pro-image-preview": "参考图：最多 14 张。",
    "doubao-seedream-5-0": "参考图：最多 10 张。",
};

export const getImageModelHelp = (modelId: string) =>
    IMAGE_MODEL_HELP_TEXTS[modelId] ?? "该模型的参考素材输入要求正在补充中。";
