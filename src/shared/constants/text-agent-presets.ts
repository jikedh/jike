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
    model: "gemini-3.1-pro",
    systemPrompt: SYSTEM_PROMPTS["novel-to-script-agent"],
  },
  "short-video-storyboard": {
    id: "short-video-storyboard",
    label: "真人短剧分镜（15秒）",
    description: "生成15秒短视频分镜脚本，包含镜头、动作、台词",
    model: "gemini-3.1-pro",
    systemPrompt: SYSTEM_PROMPTS["short-video-storyboard"],
  },
  "jimeng-prompt": {
    id: "jimeng-prompt",
    label: "通用即梦分镜",
    description: "将文字描述转换为即梦AI视频生成提示词",
    model: "gemini-3.1-pro",
    systemPrompt: SYSTEM_PROMPTS["jimeng-prompt"],
  },
  "novel-character-design": {
    id: "novel-character-design",
    label: "角色设计",
    description: "从小说或剧本中提取并设计角色原画设定表",
    model: "gemini-3.1-pro",
    systemPrompt: SYSTEM_PROMPTS["novel-character-design"],
  },
  "script-to-storyboard": {
    id: "script-to-storyboard",
    label: "剧本转分镜",
    description: "将剧本或小说片段转化为AI视频分镜脚本，支持真人短剧和动漫风格",
    model: "gemini-3.1-pro",
    systemPrompt: SYSTEM_PROMPTS["script-to-storyboard"],
  },
};

export const TEXT_AGENT_PRESET_LIST = Object.values(TEXT_AGENT_PRESETS);

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
  { value: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
  { value: "deepseek-v3.2", label: "DeepSeek v3.2" },
];
