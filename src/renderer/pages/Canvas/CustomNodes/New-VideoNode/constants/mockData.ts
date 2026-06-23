import {
  MOCK_MAIN_MODELS,
  getVisibleVideoModels
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
): ModelOption[] =>
  getVisibleVideoModels(
  ).map((model) => ({
    value: model.id,
    label: model.label,
  }));

export const VIDU_REFERENCE_MAX_IMAGES = 7;

export interface MentionItem {
  id: string;
  /**
   * 原始名称：节点昵称 / 文件名 / 类型默认名。
   * 仅用于 UI 展示（缩略图 tooltip、参考图列表等），
   * 不再作为 Prompt 中显示的文本。
   */
  label: string;
  /**
   * Prompt 中固定显示的中文文本，按参考图添加顺序为"图片一/图片二/图片三…"。
   * 该字段是 mention 节点拼接到 Prompt 字符串的实际值。
   */
  displayLabel: string;
  /**
   * 兼容字段：浮层场景下，list 行主标题展示原始名时使用。
   * 与 label 解耦时 label === displayLabel，originalLabel 是原始名。
   */
  originalLabel?: string;
  value: string;
  thumbnail: string;
  url?: string;
  mentionId?: string;
  preserveLabel?: boolean;
  type: "image" | "video" | "audio";
}
