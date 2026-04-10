export type AgentPresetId =
  | "novel-to-script-agent"
  | "short-video-script-agent";

export const DEFAULT_AGENT_PRESET_ID: AgentPresetId = "novel-to-script-agent";

export const AGENT_PRESETS: Record<
  AgentPresetId,
  { id: AgentPresetId; label: string; model: string; systemPrompt: string }
> = {
  "novel-to-script-agent": {
    id: "novel-to-script-agent",
    label: "小说转剧本智能助手",
    model: "deepseek-v3.2",
    systemPrompt: `你是一名专业的“小说改编剧本”智能助手。
你的任务是将用户提供的小说片段改写为可直接用于拍摄的分场景剧本。

请遵循以下要求：
1. 保留原文核心剧情，不擅自改变人物关系与关键事件。
2. 输出结构包含：场次编号、场景、时间、人物、动作描述、对白。
3. 对白要口语化、符合人物身份，避免旁白式长段叙述。
4. 对每场给出简短“导演提示”（镜头/情绪/节奏）。
5. 若输入信息不足，先列出“待补充信息”，再给出可执行草案。`,
  },
  "short-video-script-agent": {
    id: "short-video-script-agent",
    label: "爆款短视频脚本智能助手",
    model: "deepseek-v3.2",
    systemPrompt: `你是一名短视频编导与脚本专家。
你的任务是把用户给出的主题或素材，改写成“可直接拍摄”的短视频脚本。

请遵循以下要求：
1. 先给出定位：目标受众、核心卖点、情绪基调。
2. 输出结构包含：标题候选、开场3秒钩子、分镜脚本、台词、字幕建议、结尾行动引导。
3. 分镜按时间轴组织（例如 0-3s、3-8s、8-15s）。
4. 文案尽量口语化，节奏紧凑，避免空话。
5. 若信息不足，先列出“待补充素材”，再给出可执行初稿。`,
  },
};

export const getAgentPresetById = (presetId?: AgentPresetId) => {
  const fallbackPreset = AGENT_PRESETS[DEFAULT_AGENT_PRESET_ID];
  if (!presetId) {
    return fallbackPreset;
  }

  return AGENT_PRESETS[presetId] ?? fallbackPreset;
};

export const isAgentPresetId = (value?: string): value is AgentPresetId => {
  if (!value) {
    return false;
  }

  return value in AGENT_PRESETS;
};

export const getAgentPresetLabelById = (presetId?: string) => {
  if (isAgentPresetId(presetId)) {
    return AGENT_PRESETS[presetId].label;
  }

  return AGENT_PRESETS[DEFAULT_AGENT_PRESET_ID].label;
};
