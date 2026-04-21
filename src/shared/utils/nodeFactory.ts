import { getAgentPresetById } from "shared/constants/agent-presets";
import { GenerationStatus } from "shared/constants/enum";
import type { AllNodeType } from "shared/types/flow";
import type {
  AddNodeOptions,
  NodePosition,
} from "shared/types/zustand/canvas-flow";

// ==================== 节点工厂函数 ====================

/**
 * 创建便签节点
 */
export const createNoteNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => ({
  id,
  type: "noteNode",
  position,
  width: options?.initialWidth ?? 280,
  height: options?.initialHeight ?? 180,
  data: {
    content: options?.initialContent ?? "",
    isEditing: options?.initialContent ? false : true,
    createdAt: Date.now(),
  },
});

/**
 * 创建图片节点
 */
export const createImageNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => ({
  id,
  type: "imageNode",
  position,
  width: 350,
  height: 250,
  data: {
    model: "gemini-3-pro-image-preview",
    prompt: "",
    promptDraft: "",
    promptDraftHtml: "<p></p>",
    image_urls: [],
    midjourneyAdvanced: {
      referenceUrls: [],
      styleUrls: [],
      iw: 1,
      sw: 100,
    },
    nickname: "图片",
    status: GenerationStatus.COMPLETED,
    progress: 0,
    result: { type: "image", data: [] },
    createdAt: Date.now(),
  },
});

/**
 * 创建智能体节点
 */
export const createAgentNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => {
  const agentPreset = getAgentPresetById(options?.agentPresetId);
  return {
    id,
    type: "agentNode",
    position,
    data: {
      model: agentPreset.model,
      messages: [
        { role: "system" as const, content: agentPreset.systemPrompt },
      ],
      agentPresetId: agentPreset.id,
      createdAt: Date.now(),
    },
  };
};

/**
 * 创建全景图节点
 */
export const createPanoramaNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => ({
  id,
  type: "panoramaNode",
  position,
  width: 400,
  height: 300,
  data: {
    status: GenerationStatus.COMPLETED,
    isFullscreen: false,
    screenshots: [],
    createdAt: Date.now(),
  },
});

/**
 * 创建视频节点
 */
export const createVideoNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => ({
  id,
  type: "videoNode",
  position,
  width: 350,
  height: 250,
  data: {
    model: "wan2.7-r2v",
    prompt: "",
    promptDraft: "",
    promptDraftHtml: "<p></p>",
    duration: 5,
    aspect_ratio: "16:9",
    nickname: "视频",
    status: GenerationStatus.COMPLETED,
    progress: 0,
    metadata: {
      resolution: "1080P",
      prompt_extend: false,
    },
    result: { type: "video", data: [] },
    createdAt: Date.now(),
  },
});

/**
 * 创建音频节点
 */
export const createAudioNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => ({
  id,
  type: "audioNode",
  position,
  width: 350,
  height: 250,
  data: {
    model: "audio-upload",
    prompt: "",
    promptDraft: "",
    promptDraftHtml: "<p></p>",
    nickname: "音频",
    status: GenerationStatus.COMPLETED,
    progress: 0,
    isUpload: false,
    result: { type: "audio", data: [] },
    createdAt: Date.now(),
  },
});

/**
 * 创建文本智能体节点
 */
export const createTextAgentNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => ({
  id,
  type: "textAgentNode",
  position,
  data: {
    model: "deepseek-v3.2",
    presetId: undefined,
    useDefaultSystemPrompt: true,
    customSystemPrompt: "",
    status: "idle" as const,
    createdAt: Date.now(),
  },
});

/**
 * 创建图片智能体节点
 */
export const createImageAgentNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => ({
  id,
  type: "imageAgentNode",
  position,
  data: {
    model: "qwen3.5-flash",
    presetId: undefined,
    useDefaultSystemPrompt: true,
    customSystemPrompt: "",
    status: "idle" as const,
    createdAt: Date.now(),
  },
});

/**
 * 创建视频智能体节点
 */
export const createVideoAgentNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => ({
  id,
  type: "videoAgentNode",
  position,
  data: {
    model: "qwen3.5-flash",
    presetId: undefined,
    useDefaultSystemPrompt: true,
    customSystemPrompt: "",
    status: "idle" as const,
    createdAt: Date.now(),
  },
});

/**
 * 创建表格节点
 */
export const createTableNode = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
): AllNodeType => ({
  id,
  type: "tableNode",
  position,
  width: options?.initialWidth ?? 800,
  height: options?.initialHeight ?? 400,
  data: {
    title: options?.tableTitle ?? "角色设计表",
    columns: options?.tableColumns ?? [
      "姓名",
      "基础设定",
      "性格特征",
      "核心动机",
      "核心关系",
      "习惯和兴趣",
    ],
    rows: options?.tableRows ?? [],
    createdAt: Date.now(),
  },
});

// ==================== 节点配置表 ====================

import type { NodeType } from "shared/types/zustand/canvas-flow";

type NodeFactory = (
  id: string,
  position: NodePosition,
  options?: AddNodeOptions,
) => AllNodeType;

export const nodeFactoryMap: Record<NodeType, NodeFactory> = {
  note: createNoteNode,
  image: createImageNode,
  agent: createAgentNode,
  panorama: createPanoramaNode,
  video: createVideoNode,
  audio: createAudioNode,
  textAgent: createTextAgentNode,
  imageAgent: createImageAgentNode,
  videoAgent: createVideoAgentNode,
  table: createTableNode,
  default: createNoteNode,
};
