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
    model: "gemini-2.0-flash-exp",
    systemPrompt: `请分析这个视频的内容，包括：
1. 视频主题和主要内容
2. 场景和镜头变化
3. 关键动作和情节
4. 人物和对话要点
5. 节奏和时长

请生成详细的视频分析报告，包括关键时间点、场景描述、画面构图分析等。`,
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

export const VIDEO_AGENT_MODELS = [
  { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash" },
];
