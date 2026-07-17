import type { AudioTtsModelId } from "shared/types/audio";

export const MINIMAX_SPEECH_28_HD_MODEL = "MiniMax/speech-2.8-hd" as const;
export const COSYVOICE_35_PLUS_MODEL = "cosyvoice-v3.5-plus" as const;

export const AUDIO_TTS_MODEL_OPTIONS: Array<{
  id: AudioTtsModelId;
  label: string;
  pointsPer100: number;
}> = [
  {
    id: MINIMAX_SPEECH_28_HD_MODEL,
    label: "MiniMax Speech 2.8 HD",
    pointsPer100: 4,
  },
  {
    id: COSYVOICE_35_PLUS_MODEL,
    label: "CosyVoice v3.5 Plus",
    pointsPer100: 2,
  },
];

export const AUDIO_TEXT_MARKERS = [
  "[停顿0.3秒]",
  "[停顿0.5秒]",
  "[停顿1秒]",
  "[笑]",
  "[叹气]",
  "[吸气]",
  "[低语]",
  "[强调]",
] as const;
