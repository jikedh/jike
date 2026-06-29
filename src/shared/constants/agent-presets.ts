export type AgentPresetId = string;

export const DEFAULT_AGENT_PRESET_ID: AgentPresetId = "default-agent";

export const AGENT_PRESETS: Record<
  string,
  { id: AgentPresetId; label: string; model: string; systemPrompt: string }
> = {
  [DEFAULT_AGENT_PRESET_ID]: {
    id: DEFAULT_AGENT_PRESET_ID,
    label: "智能体",
    model: "deepseek-v4-flash",
    systemPrompt: "",
  },
};

export const getAgentPresetById = (presetId?: string) => {
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
