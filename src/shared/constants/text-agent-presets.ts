import type { TextAgentPresetId } from "shared/types/flow";
import { SYSTEM_PROMPTS } from "./system-prompts";

export const TEXT_AGENT_PRESETS: Record<
  TextAgentPresetId,
  {
    id: TextAgentPresetId;
    label: string;
    description: string;
    model: string;
    systemPrompt: string;
  }
> = {
  "novel-to-script-agent": {
    id: "novel-to-script-agent",
    label: "小说转剧本",
    description: "将小说片段改写为可直接用于拍摄的分场景剧本",
    model: "deepseek-v4-flash",
    systemPrompt: SYSTEM_PROMPTS["novel-to-script-agent"],
  },
  "short-video-storyboard": {
    id: "short-video-storyboard",
    label: "真人短剧分镜（15秒）",
    description: "生成15秒短视频分镜脚本，包含镜头、动作、台词",
    model: "deepseek-v4-flash",
    systemPrompt: SYSTEM_PROMPTS["short-video-storyboard"],
  },
  "jimeng-prompt": {
    id: "jimeng-prompt",
    label: "通用即梦分镜",
    description: "将文字描述转换为即梦AI视频生成提示词",
    model: "deepseek-v4-flash",
    systemPrompt: SYSTEM_PROMPTS["jimeng-prompt"],
  },
  "novel-character-design": {
    id: "novel-character-design",
    label: "角色设计",
    description: "从小说或剧本中提取并设计角色原画设定表",
    model: "deepseek-v4-flash",
    systemPrompt: SYSTEM_PROMPTS["novel-character-design"],
  },
  "script-to-storyboard": {
    id: "script-to-storyboard",
    label: "剧本转分镜",
    description: "将剧本或小说片段转化为AI视频分镜脚本，支持真人短剧和动漫风格",
    model: "deepseek-v4-flash",
    systemPrompt: SYSTEM_PROMPTS["script-to-storyboard"],
  },
};

export const TEXT_AGENT_PRESET_LIST = Object.values(TEXT_AGENT_PRESETS);

export const KIMI_K3_MODEL = "kimi/kimi-k3";

export const KIMI_K3_TEXT_AGENT_SCORE_COSTS: Record<TextAgentPresetId, number> =
  {
    "novel-to-script-agent": 80,
    "short-video-storyboard": 40,
    "jimeng-prompt": 20,
    "novel-character-design": 50,
    "script-to-storyboard": 70,
  };

export const TEXT_AGENT_SCORE_COSTS: Record<
  string,
  Record<TextAgentPresetId, number>
> = {
  "claude-sonnet-4.6": {
    "novel-to-script-agent": 60,
    "short-video-storyboard": 30,
    "jimeng-prompt": 20,
    "novel-character-design": 35,
    "script-to-storyboard": 45,
  },
  "deepseek-v4-flash": {
    "novel-to-script-agent": 5,
    "short-video-storyboard": 3,
    "jimeng-prompt": 2,
    "novel-character-design": 3,
    "script-to-storyboard": 4,
  },
  "gemini-3.1-flash-lite": {
    "novel-to-script-agent": 5,
    "short-video-storyboard": 3,
    "jimeng-prompt": 2,
    "novel-character-design": 3,
    "script-to-storyboard": 4,
  },
  "gemini-3.0-flash": {
    "novel-to-script-agent": 8,
    "short-video-storyboard": 4,
    "jimeng-prompt": 3,
    "novel-character-design": 5,
    "script-to-storyboard": 6,
  },
  [KIMI_K3_MODEL]: KIMI_K3_TEXT_AGENT_SCORE_COSTS,
};

export const getTextAgentPresetById = (presetId?: TextAgentPresetId) => {
  const defaultPreset = TEXT_AGENT_PRESETS["novel-to-script-agent"];
  if (!presetId) {
    return defaultPreset;
  }
  return TEXT_AGENT_PRESETS[presetId] ?? defaultPreset;
};

export const isTextAgentPresetId = (
  value?: string,
): value is TextAgentPresetId => {
  if (!value) {
    return false;
  }
  return value in TEXT_AGENT_PRESETS;
};

export const getTextAgentPresetLabelById = (presetId?: string) => {
  if (isTextAgentPresetId(presetId)) {
    return TEXT_AGENT_PRESETS[presetId].label;
  }
  return TEXT_AGENT_PRESETS["novel-to-script-agent"].label;
};

export const TEXT_AGENT_MODELS = [
  {
    value: "claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    platform: "toapi",
  },
  {
    value: "deepseek-v4-flash",
    label: "deepseek-v4-flash",
    platform: "toapi",
  },
  {
    value: "gemini-3.1-flash-lite",
    label: "gemini-3.1-flash-lite",
    platform: "toapi",
  },
  {
    value: "gemini-3.0-flash",
    label: "gemini-3.0-flash",
    platform: "toapi",
  },
  { value: KIMI_K3_MODEL, label: "Kimi K3", platform: "dashscope" },
] as const;

export const getTextAgentModelConfig = (model: string) =>
  TEXT_AGENT_MODELS.find((item) => item.value === model) ??
  TEXT_AGENT_MODELS.find((item) => item.value === "deepseek-v4-flash")!;

export const getTextAgentScoreCost = (
  model: string,
  presetId?: TextAgentPresetId,
) => {
  if (!presetId) {
    return undefined;
  }
  return TEXT_AGENT_SCORE_COSTS[model]?.[presetId];
};
