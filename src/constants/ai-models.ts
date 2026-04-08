/** 文本模型配置 */
export const TEXT_MODELS = [
  // OpenAI 模型
  // { id: 1, name: 'GPT-3.5 Turbo', model: 'gpt-3.5-turbo', platform: 'openai', platformId: 1 },
  // { id: 2, name: 'GPT-3.5 Turbo 0125', model: 'gpt-3.5-turbo-0125', platform: 'openai', platformId: 1 },
  // { id: 3, name: 'GPT-3.5 Turbo 1106', model: 'gpt-3.5-turbo-1106', platform: 'openai', platformId: 1 },
  // { id: 4, name: 'GPT-3.5 Turbo 16K', model: 'gpt-3.5-turbo-16k', platform: 'openai', platformId: 1 },
  // { id: 5, name: 'GPT-3.5 Turbo 16K 0613', model: 'gpt-3.5-turbo-16k-0613', platform: 'openai', platformId: 1 },
  // { id: 6, name: 'GPT-4', model: 'gpt-4', platform: 'openai', platformId: 1 },
  // { id: 7, name: 'GPT-4 0613', model: 'gpt-4-0613', platform: 'openai', platformId: 1 },
  // { id: 8, name: 'GPT-4 32K', model: 'gpt-4-32k', platform: 'openai', platformId: 1 },
  // { id: 9, name: 'GPT-4 Turbo', model: 'gpt-4-turbo', platform: 'openai', platformId: 1 },
  // { id: 10, name: 'GPT-4 Turbo 2024-04-09', model: 'gpt-4-turbo-2024-04-09', platform: 'openai', platformId: 1 },
  // { id: 11, name: 'GPT-4o', model: 'gpt-4o', platform: 'openai', platformId: 1 },
  // { id: 12, name: 'GPT-4o Mini', model: 'gpt-4o-mini', platform: 'openai', platformId: 1 },
  // { id: 13, name: 'GPT-4o 2024-08-06', model: 'gpt-4o-2024-08-06', platform: 'openai', platformId: 1 },
  // { id: 14, name: 'GPT-4 Vision Preview', model: 'gpt-4-vision-preview', platform: 'openai', platformId: 1 },
  // // 字节豆包
  // { id: 15, name: '豆包 1.5 Pro', model: 'doubao-1.5-pro', platform: 'doubao', platformId: 2 },
  // { id: 16, name: '豆包 1.5 Lite', model: 'doubao-1.5-lite', platform: 'doubao', platformId: 2 },
  // // 阿里通义千问
  // { id: 17, name: '通义千问 Turbo', model: 'qwen-turbo', platform: 'qwen', platformId: 3 },
  // { id: 18, name: '通义千问 Plus', model: 'qwen-plus', platform: 'qwen', platformId: 3 },
  // { id: 19, name: '通义千问 Max', model: 'qwen-max', platform: 'qwen', platformId: 3 },
  // { id: 20, name: '通义千问 7B', model: 'qwen-7b-chat', platform: 'qwen', platformId: 3 },
  // { id: 21, name: '通义千问 14B', model: 'qwen-14b-chat', platform: 'qwen', platformId: 3 },
  // // 百度文心一言
  // { id: 22, name: '文心一言 3.5', model: 'ernie-3.5', platform: 'ernie', platformId: 4 },
  // { id: 23, name: '文心一言 4.0', model: 'ernie-4.0', platform: 'ernie', platformId: 4 },
  // { id: 24, name: '文心一言 Lite', model: 'ernie-lite', platform: 'ernie', platformId: 4 },
  // // 智谱 ChatGLM
  // { id: 25, name: 'ChatGLM3 6B', model: 'chatglm3-6b', platform: 'chatglm', platformId: 5 },
  // { id: 26, name: 'ChatGLM 4', model: 'chatglm-4', platform: 'chatglm', platformId: 5 },
  // { id: 27, name: 'GLM 4', model: 'glm-4', platform: 'chatglm', platformId: 5 },
  // // 腾讯混元
  // { id: 28, name: '混元 Lite', model: 'hunyuan-lite', platform: 'hunyuan', platformId: 6 },
  // { id: 29, name: '混元 Standard', model: 'hunyuan-standard', platform: 'hunyuan', platformId: 6 },
  // { id: 30, name: '混元 Pro', model: 'hunyuan-pro', platform: 'hunyuan', platformId: 6 },
  // // 讯飞星火
  // { id: 31, name: '星火 Lite', model: 'spark-lite', platform: 'spark', platformId: 7 },
  // { id: 32, name: '星火 Standard', model: 'spark-standard', platform: 'spark', platformId: 7 },
  // { id: 33, name: '星火 Pro', model: 'spark-pro', platform: 'spark', platformId: 7 },
  // // 百川
  // { id: 34, name: '百川 2 7B', model: 'baichuan2-7b-chat', platform: 'baichuan', platformId: 8 },
  // { id: 35, name: '百川 2 13B', model: 'baichuan2-13b-chat', platform: 'baichuan', platformId: 8 },
  // // 零一万物
  // { id: 36, name: 'Yi 34B', model: 'yi-34b-chat', platform: 'yi', platformId: 9 },
  // { id: 37, name: 'Yi 6B', model: 'yi-6b-chat', platform: 'yi', platformId: 9 },
  // // Moonshot
  // { id: 38, name: 'Moonshot V1 8K', model: 'moonshot-v1-8k', platform: 'moonshot', platformId: 10 },
  // { id: 39, name: 'Moonshot V1 32K', model: 'moonshot-v1-32k', platform: 'moonshot', platformId: 10 },
  // { id: 40, name: 'Moonshot V1 128K', model: 'moonshot-v1-128k', platform: 'moonshot', platformId: 10 },
  // Anthropic Claude
  { id: 41, name: 'Claude Opus 4.6', model: 'claude-opus-4-6', platform: 'anthropic', platformId: 11 },
  { id: 42, name: 'Claude Haiku 4.5', model: 'claude-haiku-4-5', platform: 'anthropic', platformId: 11 },
  { id: 43, name: 'Claude Sonnet 4.6', model: 'claude-sonnet-4-6', platform: 'anthropic', platformId: 11 },
];

/** 视频模型配置 */
export const VIDEO_MODELS = [
  // OpenAI Sora 系列
  // { id: 1, name: 'Sora 2(模型不存在,文档里面的curl都跑不通)', model: 'sora-2', platform: 'openai', platformId: 1 },
  // { id: 2, name: 'Sora 2 Pro(能用，)', model: 'sora-2-pro', platform: 'openai', platformId: 1 },
  // { id: 3, name: 'Sora 2 VIP(能进入回调，最后所有渠道都失败)', model: 'sora-2-vip', platform: 'openai', platformId: 1 },
  // { id: 4, name: 'Sora 2 Official(能用，进度完成不给我URL)', model: 'sora-2-official', platform: 'openai', platformId: 1 },
  // Google Veo 系列
  { id: 18, name: 'Veo 3.1 Quality', model: 'Veo3.1-quality-official', platform: 'google', platformId: 16 },
  { id: 19, name: 'Veo 3.1 Fast', model: 'Veo3.1-fast-official', platform: 'google', platformId: 16 },
  // 字节豆包 Seedance 系列
  { id: 11, name: 'Doubao Seedance 1.5 Pro', model: 'doubao-seedance-1-5-pro', platform: 'doubao', platformId: 2 },
  // { id: 22, name: 'Doubao Seedance 2.0', model: 'doubao-seedance-2.0', platform: 'doubao', platformId: 2 },
  // xAI Grok 系列
  { id: 17, name: 'Grok Video 3', model: 'grok-video-3', platform: 'xai', platformId: 18 },
  // Kling 系列
  { id: 20, name: 'Kling Video O1', model: 'kling-video-o1', platform: 'kling', platformId: 14 },
  // MiniMax 系列
  { id: 21, name: 'MiniMax Hailuo 2.3', model: 'MiniMax-Hailuo-2.3', platform: 'minimax', platformId: 12 },
  // MiniMax
  // { id: 12, name: 'MiniMax-Hailuo-02', model: 'MiniMax-Hailuo-02', platform: 'minimax', platformId: 12 },
  // Wan 系列
  // { id: 13, name: 'Wan2.6(size不能用16:9,要用1920:1080)', model: 'wan2.6', platform: 'wan', platformId: 13 },
  // { id: 14, name: 'Wan2.6-Flash', model: 'wan2.6-flash', platform: 'wan', platformId: 13 },
  // Kling
  // { id: 15, name: 'Kling-2-6', model: 'kling-2-6', platform: 'kling', platformId: 14 },
  // Vidu
  // { id: 16, name: 'VidUQ3-Pr(模型不纯在)', model: 'viduq3-pro', platform: 'vidu', platformId: 15 },
];

/** 宽高比配置 */
export const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
];

/** 视频节点宽高比配置 */
export const VIDEO_ASPECT_RATIOS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '21:9', value: '21:9' },
];

/** 豆包 Seedance 1.5 Pro 视频分辨率配置 */
export const VIDEO_RESOLUTIONS_15PRO = [
  { label: '1080p (超清)', value: '1080p' },
  { label: '720p (高清)', value: '720p' },
  { label: '480p (标清)', value: '480p' },
] as const;

/** 视频节点时长配置（豆包 Seedance 1.5 Pro：4-12秒） */
export const VIDEO_DURATION_CONFIG = {
  min: 4,
  max: 12,
  step: 1,
  defaultValue: 5,
} as const;

/** 图片生成模型配置 */
export const IMAGE_MODELS = [
  // { id: 1, name: 'doubao-seedream-4-0', model: 'doubao-seedream-4-0', platform: 'Seedream' },
  // { id: 2, name: 'doubao-seedream-4-5', model: 'doubao-seedream-4-5', platform: 'Seedream' },
  { id: 3, name: '谷歌 Gemini 3 Pro', model: 'gemini-3-pro-image-preview', platform: 'google' },
  { id: 4, name: '豆包 Seedream 5.0', model: 'doubao-seedream-5-0', platform: 'Seedream' },
  { id: 5, name: 'Midjourney', model: 'midjourney', platform: 'midjourney' },
  { id: 6, name: 'Midjourney Niji7', model: 'midjourney-niji7', platform: 'midjourney' },
];

/** 图片尺寸配置 */
export const IMAGE_SIZES = [
  { label: '256×256', value: '256x256' },
  { label: '512×512', value: '512x512' },
  { label: '1024×1024', value: '1024x1024' },
  { label: '1024×1792', value: '1024x1792' },
  { label: '1792×1024', value: '1792x1024' },
  { label: '1280×720', value: '1280x720' },
  { label: '720×1280', value: '720x1280' },
];

/** 图片分辨率配置 */
export const IMAGE_RESOLUTIONS = [
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' },
];

/** 图片方向配置 */
export const IMAGE_ORIENTATIONS = [
  { label: '横向', value: 'landscape' },
  { label: '纵向', value: 'portrait' },
];

/** 图片生成数量配置 */
export const IMAGE_COUNTS = [
  { label: '1张', value: 1 },
  { label: '2张', value: 2 },
  { label: '3张', value: 3 },
  { label: '4张', value: 4 },
  { label: '5张', value: 5 },
];

/** 视频生成模式 */
export const VIDEO_GENERATION_MODES = [
  { label: '文生视频', value: 'text-to-video' },
  { label: '图生视频', value: 'image-to-video' },
];

/**
 * 画布聊天模型配置。
 * 说明：当前只开放 deepseek-v3.2，后续新增模型仅需追加配置项。
 */
export const CANVAS_CHAT_MODELS = [
  { id: 1001, name: 'DeepSeek v3.2', model: 'deepseek-v3.2', platform: 'deepseek', platformId: 17 },
  // Anthropic Claude 系列
  { id: 1002, name: 'Claude Haiku 4.5', model: 'claude-haiku-4-5', platform: 'anthropic', platformId: 11 },
  { id: 1003, name: 'Claude Sonnet 4.6', model: 'claude-sonnet-4-6', platform: 'anthropic', platformId: 11 },
  { id: 1004, name: 'Claude Opus 4.6', model: 'claude-opus-4-6', platform: 'anthropic', platformId: 11 },
  // OpenAI GPT-5 系列
  { id: 1005, name: 'GPT-5 Pro Official', model: 'gpt-5-pro-official', platform: 'openai', platformId: 1 },
  { id: 1006, name: 'GPT-5.2 Official', model: 'gpt-5.2-official', platform: 'openai', platformId: 1 },
  { id: 1007, name: 'GPT-5.3 Codex Official', model: 'gpt-5.3-codex-official', platform: 'openai', platformId: 1 },
  { id: 1008, name: 'GPT-5', model: 'gpt-5', platform: 'openai', platformId: 1 },
  { id: 1009, name: 'GPT-5 Codex', model: 'gpt-5-codex', platform: 'openai', platformId: 1 },
  { id: 1010, name: 'GPT-5 Codex Mini', model: 'gpt-5-codex-mini', platform: 'openai', platformId: 1 },
  { id: 1011, name: 'GPT-5.1', model: 'gpt-5.1', platform: 'openai', platformId: 1 },
  { id: 1012, name: 'GPT-5.1 Codex', model: 'gpt-5.1-codex', platform: 'openai', platformId: 1 },
  { id: 1013, name: 'GPT-5.1 Codex Max', model: 'gpt-5.1-codex-max', platform: 'openai', platformId: 1 },
  { id: 1014, name: 'GPT-5.1 Codex Mini', model: 'gpt-5.1-codex-mini', platform: 'openai', platformId: 1 },
  { id: 1015, name: 'GPT-5.2', model: 'gpt-5.2', platform: 'openai', platformId: 1 },
  { id: 1016, name: 'GPT-5.2 Codex', model: 'gpt-5.2-codex', platform: 'openai', platformId: 1 },
  { id: 1017, name: 'GPT-5.3 Codex', model: 'gpt-5.3-codex', platform: 'openai', platformId: 1 },
  { id: 1018, name: 'GPT-5.3 Codex Spark', model: 'gpt-5.3-codex-spark', platform: 'openai', platformId: 1 },
  { id: 1019, name: 'GPT-5.4', model: 'gpt-5.4', platform: 'openai', platformId: 1 },
  // Google Gemini 系列
  { id: 1020, name: 'Gemini 3.1 Pro Preview Official', model: 'gemini-3.1-pro-preview-official', platform: 'google', platformId: 16 },
  { id: 1021, name: 'Gemini 3.1 Flash Lite Preview Official', model: 'gemini-3.1-flash-lite-preview-official', platform: 'google', platformId: 16 },
  { id: 1022, name: 'Gemini 3 Pro Official', model: 'gemini-3-pro-official', platform: 'google', platformId: 16 },
  { id: 1023, name: 'Gemini 3 Pro Preview Official', model: 'gemini-3-pro-preview-official', platform: 'google', platformId: 16 },
  { id: 1024, name: 'Gemini 3 Flash Official', model: 'gemini-3-flash-official', platform: 'google', platformId: 16 },
  { id: 1025, name: 'Gemini 3 Flash Preview Official', model: 'gemini-3-flash-preview-official', platform: 'google', platformId: 16 },
  { id: 1026, name: 'Gemini 3.1 Fast', model: 'gemini-3.1-fast', platform: 'google', platformId: 16 },
  { id: 1027, name: 'Gemini 3.1 Thinking', model: 'gemini-3.1-thinking', platform: 'google', platformId: 16 },
  { id: 1028, name: 'Gemini 2.5 Pro Official', model: 'gemini-2.5-pro-official', platform: 'google', platformId: 16 },
  { id: 1029, name: 'Gemini 2.5 Flash Official', model: 'gemini-2.5-flash-official', platform: 'google', platformId: 16 },
  { id: 1030, name: 'Gemini 2.5 Flash Lite Official', model: 'gemini-2.5-flash-lite-official', platform: 'google', platformId: 16 },
  { id: 1031, name: 'Gemini 2.0 Flash Official', model: 'gemini-2.0-flash-official', platform: 'google', platformId: 16 },
  { id: 1032, name: 'Gemini 2.0 Flash Lite Official', model: 'gemini-2.0-flash-lite-official', platform: 'google', platformId: 16 },
  // 阿里通义千问系列
  { id: 1033, name: 'Qwen3 Max', model: 'qwen3-max', platform: 'qwen', platformId: 3 },
  { id: 1034, name: 'Qwen3.5 Plus', model: 'qwen3.5-plus', platform: 'qwen', platformId: 3 },
  { id: 1035, name: 'Qwen3.5 Flash', model: 'qwen3.5-flash', platform: 'qwen', platformId: 3 },
  // 智谱 GLM 系列
  { id: 1036, name: 'GLM 5', model: 'glm-5', platform: 'chatglm', platformId: 5 },
  // Moonshot Kimi 系列
  { id: 1037, name: 'Kimi K2.5', model: 'kimi-k2.5', platform: 'moonshot', platformId: 10 },
  // MiniMax 系列
  { id: 1038, name: 'MiniMax M2.5', model: 'MiniMax-M2.5', platform: 'minimax', platformId: 12 },
]

/** 画布聊天默认模型 */
export const DEFAULT_CANVAS_CHAT_MODEL = CANVAS_CHAT_MODELS[1].model
