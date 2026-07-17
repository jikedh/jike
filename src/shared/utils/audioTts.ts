import {
  AUDIO_TEXT_MARKERS,
  AUDIO_TTS_MODEL_OPTIONS,
  MINIMAX_SPEECH_28_HD_MODEL,
} from "shared/constants/audio-models";
import type { AudioTtsModelId } from "shared/types/audio";

const CONTROL_TAG_PATTERN = new RegExp(
  AUDIO_TEXT_MARKERS.map((marker) =>
    marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|"),
  "g",
);

export const normalizeAudioTtsModel = (
  model: string | undefined,
): AudioTtsModelId =>
  AUDIO_TTS_MODEL_OPTIONS.some((option) => option.id === model)
    ? (model as AudioTtsModelId)
    : MINIMAX_SPEECH_28_HD_MODEL;

export const getAudioBillableChars = (text: string): number =>
  Array.from(text.replace(CONTROL_TAG_PATTERN, "").replace(/\s/g, "")).length;

export const getAudioGenerationPoints = (
  model: string | undefined,
  text: string,
): number => {
  const normalizedModel = normalizeAudioTtsModel(model);
  const pointsPer100 =
    AUDIO_TTS_MODEL_OPTIONS.find((option) => option.id === normalizedModel)
      ?.pointsPer100 ?? 4;
  const chars = getAudioBillableChars(text);
  return Math.max(1, Math.ceil(chars / 100)) * pointsPer100;
};
