export const IMAGE_MODEL_HELP_TEXTS: Record<string, string> = {
    "gpt-image-2": "参考图：支持多图输入，建议最多六张",
    "runninghub-gpt-image-2": "参考图：最多 10 张。",
    "runninghub-nano-banana-pro": "参考图：最多 10 张。",
    "runninghub-midjourney-v8.1": `Chaos（0-100）：控制结果的随机性和差异，值越高，构图与细节变化越明显。
Stylize（0-1000）：控制模型艺术风格的表现强度，值越高，画面越偏向风格化表达。
IW（0-3）：控制垫图对生成结果的影响强度，仅在提供参考图时生效，值越高越贴近垫图。
图像模式：标准质量对应 Quality=1，高质量模式对应 Quality=4。
Raw：开启后减少模型自动风格修饰，增强提示词对画面的直接控制。`,
    "gemini-3-pro-image-preview": "参考图：最多 14 张。",
    "doubao-seedream-5-0": "参考图：最多 10 张。",
    "flux-2-pro": "APIMart Flux 2.0 Pro：支持文生图、图生图和多参考图融合，参考图最多 8 张。前端开放图片比例与 1MP-4MP 分辨率。",
    "gpt-image-2.5-flare": "APIMart GPT-Image-2.5 Flare：适合日常高质量出图和快速原型，参考图最多 16 张。前端开放图片比例、1K/2K/4K 分辨率与质量档位。",
    "qwen-image-3.0": "APIMart Qwen Image 3.0：擅长中文文字渲染与常规排版，图像编辑支持 1-3 张参考图。前端开放图片比例与 1K/2K 分辨率。",
};

export const getImageModelHelp = (modelId: string) =>
    IMAGE_MODEL_HELP_TEXTS[modelId] ?? "该模型的参考素材输入要求正在补充中。";
