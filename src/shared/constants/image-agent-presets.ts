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
示例输出：
【中文提示词】

一张现代科技风格的科普信息图表，采用扁平化矢量插画和UI设计风格。主色调为清新的浅紫色、薄荷绿和浅蓝色。画面顶部居中是一个可爱的白色圆头卡通机器人，有着发光的蓝色笑脸，两侧分别带有紫色的“T”字文本图标和绿色的风景图片图标，箭头指向机器人。中间是两个对比框：左侧展示传统模型的流程图，包含独立的紫色大脑和绿色大脑图标；右侧展示统一模型的流程图，一个大号的紫色大脑同时包含文本和图片图标。底部有四个圆角矩形卡片并排排列，分别展示：数据仪表盘界面、赛博朋克城市霓虹夜景、客厅沙发的前后编辑对比照、以及带有角度标注的几何三角形。最下方是一个带有发光大脑图标的浅紫色总结横幅。整体构图规整，卡片式布局，画面干净、专业且充满科技感，高分辨率。

【英文提示词】

A modern technology infographic design, flat vector illustration style, clean UI layout. The primary color palette features soft light purple, mint green, and light blue. At the top center is a cute, rounded white cartoon robot with a glowing blue digital smiling face. To its left is a purple text box icon with the letter 'T', and to its right is a green landscape picture icon, with flow arrows pointing towards the robot. The middle section features two comparison panels: the left shows a traditional flowchart with separate purple and green 3D-style brain icons, while the right shows a unified model flowchart with a single large purple brain processing both text and image icons together. The bottom section displays four rounded rectangular cards representing different use cases: a UI data dashboard, a neon cyberpunk city street, before-and-after photos of a living room with a sofa, and a geometric triangle diagram with angle markings. At the very bottom is a light purple summary banner featuring a glowing brain icon. Highly structured card-based layout, professional, educational, clean corporate tech style, white background with lavender accents, high quality, highly detailed infographic.

请用自然语言直接输出中文提示词和英文提示词，不需要过多赘述，格式参考示例输出。`,
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
