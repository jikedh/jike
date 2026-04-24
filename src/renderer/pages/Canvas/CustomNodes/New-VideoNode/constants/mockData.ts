import { MOCK_MAIN_MODELS } from "./videoModelCapabilities";

export interface ModelOption {
  value: string;
  label: string;
}

export const MOCK_MODELS: ModelOption[] = MOCK_MAIN_MODELS.map((model) => ({
  value: model.id,
  label: model.label,
}));

export const VIDU_REFERENCE_MAX_IMAGES = 7;

export interface MentionItem {
  id: string;
  label: string;
  value: string;
  thumbnail: string;
  type: "image" | "video" | "audio";
}

export const MOCK_REFERENCE_ITEMS: MentionItem[] = [
  {
    id: "mock-img-1",
    label: "素材1",
    value: "素材1",
    thumbnail: "https://picsum.photos/seed/ref1/200/200",
    type: "image",
  },
  {
    id: "mock-img-2",
    label: "素材2",
    value: "素材2",
    thumbnail: "https://picsum.photos/seed/ref2/200/200",
    type: "image",
  },
  {
    id: "mock-vid-1",
    label: "素材3",
    value: "素材3",
    thumbnail:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    type: "video",
  },
  {
    id: "mock-aud-1",
    label: "素材4",
    value: "素材4",
    thumbnail:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
    type: "audio",
  },
];

export const MOCK_MENTION_ITEMS = MOCK_REFERENCE_ITEMS;

export const MOCK_COUNT_OPTIONS = [1, 2, 3, 4];
