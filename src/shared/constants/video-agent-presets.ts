import type { VideoAgentPresetId } from "shared/types/flow";

export const VIDEO_AGENT_PRESETS: Record<
  VideoAgentPresetId,
  {
    id: VideoAgentPresetId;
    label: string;
    description: string;
    model: string;
    systemPrompt: string;
  }
> = {
  "video-pull-film": {
    id: "video-pull-film",
    label: "视频拉片",
    description: "分析视频内容，提取关键帧和剧情结构",
    model: "qwen3.5-flash",
    systemPrompt: `告别流水账，要靠这种拉片级的分镜。分镜的长短、数量、景别、角度，都可以影响叙事效果。在蓝河兼一创作的《分镜:视频剪辑的基础》一书中，有上百个日常场景分镜说明。几乎包括了我们在日常生活中所有的情景。非常值得我们作为参考。接下来，我们就按照导演拉片的精细度，根据我们的内容，来创作分镜。

1. 我们要创作的分镜表，包含了场景、时长、镜号、景别、画面、角度、运动、主体动作、信息点、声画关系、技参、转场。
2. 要利用导演思维和编剧思维，构建我们内容中的每个剧情环节。
3. 剧情与剧情之间的连贯，要在场景改变后，照顾到物理空间的联想，不能不切实际地影响剧情。
4. 每一个切分都要严格识别到位。

输出要求：
- 必须输出一整个完整表格。
- 表格列固定为：场景 | 时长 | 镜号 | 景别 | 画面 | 角度 | 运动 | 主体动作 | 信息点 | 声画关系 | 技参 | 转场。
- 不要写成散文，不要写成普通分点总结。
- 要按导演拉片级别来拆分镜头，尽量细，保证叙事连贯。
- 如果某一列信息不明确，也要结合上下文给出合理推断，不要留空。`,
  },
};

export const VIDEO_AGENT_PRESET_LIST = Object.values(VIDEO_AGENT_PRESETS);

export const getVideoAgentPresetById = (presetId?: VideoAgentPresetId) => {
  const defaultPreset = VIDEO_AGENT_PRESETS["video-pull-film"];
  if (!presetId) {
    return defaultPreset;
  }
  return VIDEO_AGENT_PRESETS[presetId] ?? defaultPreset;
};

export const isVideoAgentPresetId = (
  value?: string,
): value is VideoAgentPresetId => {
  if (!value) {
    return false;
  }
  return value in VIDEO_AGENT_PRESETS;
};

export const getVideoAgentPresetLabelById = (presetId?: string) => {
  if (isVideoAgentPresetId(presetId)) {
    return VIDEO_AGENT_PRESETS[presetId].label;
  }
  return VIDEO_AGENT_PRESETS["video-pull-film"].label;
};

/** 视频智能体可用模型（当前仅支持 qwen3.5-flash） */
export const VIDEO_AGENT_MODELS = [
  { value: "qwen3.5-flash", label: "Qwen 3.5 Flash (阿里云百炼)" },
];
