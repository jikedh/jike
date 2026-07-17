export type AudioTtsModelId = "MiniMax/speech-2.8-hd" | "cosyvoice-v3.5-plus";

export type AudioVoiceProfile = {
  profileId: string;
  name: string;
  description?: string;
  gender?: string;
  ageGroup?: string;
  language?: string;
  tags?: string;
  previewUrl?: string;
  isDefault?: boolean;
  model: AudioTtsModelId;
  voiceType?: "system" | "cloned" | "designed";
  capabilities?: string;
};

export type AudioTtsModelInfo = {
  id: AudioTtsModelId;
  label: string;
  pointsPer100: number;
  available: boolean;
  cloneSupported?: boolean;
  cloneScoreCost?: number;
  voices: AudioVoiceProfile[];
};

export type AudioTtsSegment = {
  type: "audio" | "silence";
  url?: string;
  durationMs?: number;
};

export type AudioSynthesisResponse = {
  segments: AudioTtsSegment[];
  ledgerBizId: string;
  scoreCost: number;
  billableChars: number;
};

export type AudioVoiceCloneResponse = {
  voice: AudioVoiceProfile;
  ledgerBizId: string;
  scoreCost: number;
};
