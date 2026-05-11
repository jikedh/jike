import {
  MOCK_MAIN_MODELS,
  getVisibleVideoModels,
} from "./videoModelCapabilities";

export interface ModelOption {
  value: string;
  label: string;
}

export const VIDEO_MODEL_OPTIONS: ModelOption[] = MOCK_MAIN_MODELS.map(
  (model) => ({
    value: model.id,
    label: model.label,
  }),
);

export const getVideoModelOptions = (
  adobeChannelModelsEnabled = false,
  grokChannelModelsEnabled = false,
): ModelOption[] =>
  getVisibleVideoModels(
    adobeChannelModelsEnabled,
    grokChannelModelsEnabled,
  ).map((model) => ({
    value: model.id,
    label: model.label,
  }));

export const VIDU_REFERENCE_MAX_IMAGES = 7;

export interface MentionItem {
  id: string;
  label: string;
  value: string;
  thumbnail: string;
  url?: string;
  mentionId?: string;
  preserveLabel?: boolean;
  type: "image" | "video" | "audio";
}
