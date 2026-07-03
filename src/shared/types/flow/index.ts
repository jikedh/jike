import type { Edge, Node, ReactFlowJsonObject } from "@xyflow/react";
import { GenerationStatus } from "shared/constants/enum";
import type { ChatMessage } from "../ai";

// ==================== 核心数据模型 ====================

/**
 * 文本生成节点数据结构
 * 用于 LLM 对话生成任务
 */
export interface TextGenerationNode {
  model: string; // 使用的模型，如 gpt-4, gpt-3.5-turbo
  messages: ChatMessage[]; // 对话历史
  temperature?: number; // 温度参数，控制随机性 (0-2)
  max_tokens?: number; // 最大生成 token 数
  top_p?: number; // 核采样参数
  stream?: boolean; // 是否启用流式输出
  stop?: string | string[]; // 停止词
  frequency_penalty?: number; // 频率惩罚
  presence_penalty?: number; // 存在惩罚
  [key: string]: any; // React Flow 约束兼容
}

/**
 * 图片生成节点数据结构
 * 用于 AI 图片生成任务
 */

export interface ImageGenerationNode {
  // ---- 核心输入参数 ----
  model: string; // 使用的模型，如 dall-e-3, gemini-3-pro-image-preview
  prompt: string; // 生成提示词
  promptDraft?: string; // 输入面板草稿文本
  promptDraftHtml?: string; // 输入面板草稿富文本
  n?: number; // 生成图片数量 (1-4)
  size?: string; // 图片尺寸比例，如 "16:9", "1024x1024"
  resolution?: string; // 分辨率，如 "1K", "2K", "4K"
  requiredPoints?: number; // 本次生成预计消耗积分（用于扣费与 UI 对齐）
  quality?: string; // 图片质量，如 "standard", "hd"
  style?: string; // 图片风格
  image_urls?: string[]; // 参考图片 URL 列表（统一关键字段，包含上传和来自依赖节点的图片）
  ossUrlMap?: Record<string, string>; // 本地文件路径到 OSS URL 的映射缓存（避免重复上传）
  midjourneyAdvanced?: {
    referenceUrls?: string[]; // Midjourney 参考图列表（用于拼接前缀 URL）
    styleUrls?: string[]; // Midjourney 风格图列表（用于 --sref）
    iw?: number; // Midjourney 参考图权重（用于 --iw）
    sw?: number; // Midjourney 风格权重（用于 --sw）
  };
  // ---- 输出结果 ----
  result?: {
    type: string; // 结果类型
    data?: {
      url: string; // 远程 OSS URL（始终存储）
      remoteUrl?: string; // 兼容新字段，明确标识持久化远程地址
      displayUrl?: string; // 运行时展示地址，允许为 blob URL，不参与持久化
      thumbnailUrl?: string;
      posterUrl?: string;
      coverUrl?: string;
      mediaType?: "image" | "video";
      assetName?: string; // 资产库显示名称
      [key: string]: any;
    }[]; // 图片数据列表（支持多张图片累积）
  }; // 生成结果
  // ---- 状态管理 ----
  status?: GenerationStatus; // 当前生成状态
  progress?: number; // 进度百分比（0-100）
  completedCount?: number; // 已完成图片数量（用于多图生成场景判断）
  isUpload?: boolean; // 是否为上传图片（用于区分加载中 / 生成中）
  error?: {
    code?: string; // 错误代码
    message?: string; // 错误信息（兜底显示）
    detail?: string; // 后端返回的详细错误信息（优先展示）
    serverMessage?: string; // 原始后端错误消息
    status?: number; // HTTP 状态码
  }; // 错误对象
  [key: string]: any; // React Flow 约束兼容
}

/**
 * 新版视频生成节点数据结构
 * 用于 AI 视频生成任务（重构版）
 */
export interface NewVideoGenerationNode {
  model: string; // 使用的模型
  prompt: string; // 生成提示词
  promptDraft?: string; // 输入面板草稿文本
  promptDraftHtml?: string; // 输入面板富文本草稿（TipTap HTML）
  duration?: number; // 视频时长（秒）
  aspect_ratio: string; // 宽高比，如 "16:9"
  image_urls?: string[]; // 参考图像 URL 列表
  video_urls?: string[]; // 参考视频 URL 列表
  audio_urls?: string[]; // 参考音频 URL 列表
  status?: GenerationStatus; // 当前生成状态
  progress?: number; // 进度百分比（0-100）
  metadata: Record<string, unknown>; // 扩展元数据
  task_id?: string; // 最近一次生成任务 ID
  error?: {
    code?: string;
    message?: string;
    detail?: string;
    serverMessage?: string;
    status?: number;
  };
  result?: {
    type: string;
    data: Array<{
      url: string;
      remoteUrl?: string;
      displayUrl?: string;
      format?: string;
      thumbnailUrl?: string;
      posterUrl?: string;
      coverUrl?: string;
      mediaType?: "video";
      localPath?: string;
      localName?: string;
      assetName?: string;
      [key: string]: any;
    }>;
  };
  createdAt?: number; // 创建时间戳
  nickname?: string; // 节点昵称
  [key: string]: any; // React Flow 约束兼容
}

/**
 * 文本便签节点数据结构
 * 用于画布中的自由文本记录
 * 注：width/height 已移至 Node 级别，由 React Flow 管理
 */
// 还需要什么字段，就采用 运行时解析的动态数据 的方式添加（可以避免双写一致的问题）
export interface NoteNodeData {
  content: string; // 文本内容（支持 Markdown 语法）
  isEditing?: boolean; // 是否处于编辑状态
  createdAt?: number; // 创建时间戳
  [key: string]: any; // React Flow 约束兼容
}

/**
 * 智能体节点数据结构
 * 仅保留 NoteGenerationRequest 的必填字段
 */
export interface AgentNode {
  model: string; // 模型名称
  agentPresetId?: string; // 智能体模板标识
  messages: {
    role: "system" | "user" | "assistant" | "tool"; // 消息角色
    content: string; // 消息内容
    name?: string; // 可选：消息发送者名称
  }[]; // 消息列表
  [key: string]: any; // React Flow 约束兼容
}

/**
 * 文本智能体预设类型
 */
export type TextAgentPresetId =
  | "novel-to-script-agent"
  | "short-video-storyboard"
  | "jimeng-prompt"
  | "novel-character-design"
  | "script-to-storyboard";

/**
 * 图片智能体预设 ID
 */
export type ImageAgentPresetId = "image-reverse-prompt";

/**
 * 图片智能体节点数据结构
 */
export interface ImageAgentNodeData {
  model: string;
  presetId?: ImageAgentPresetId;
  useDefaultSystemPrompt: boolean;
  customSystemPrompt?: string;
  status?: "idle" | "generating" | "success" | "error";
  error?: string;
  [key: string]: any;
}

/**
 * 视频智能体预设 ID
 */
export type VideoAgentPresetId = "video-pull-film";

/**
 * 视频智能体节点数据结构
 */
export interface VideoAgentNodeData {
  model: string;
  presetId?: VideoAgentPresetId;
  useDefaultSystemPrompt: boolean;
  customSystemPrompt?: string;
  inputText?: string;
  status?: "idle" | "generating" | "success" | "error";
  error?: string;
  [key: string]: any;
}

/**
 * 文本智能体节点数据结构
 */
export interface TextAgentNodeData {
  model: string;
  presetId?: TextAgentPresetId;
  useDefaultSystemPrompt: boolean;
  customSystemPrompt?: string;
  inputText?: string;
  status?: "idle" | "generating" | "success" | "error";
  error?: string;
  [key: string]: any;
}

/**
 * 全景图节点数据结构
 * 用于处理和查看全景图
 */
export interface PanoramaNodeData {
  // ---- 输入参数 ----
  image_url?: string; // 输入图片 URL（来自连接的图片节点）

  // ---- 状态管理 ----
  status?: GenerationStatus; // 当前状态
  isFullscreen?: boolean; // 是否全屏查看

  // ---- 输出结果 ----
  screenshots?: {
    type: "single" | "4grid" | "12grid"; // 截图类型
    urls: string[]; // 截图 URL 列表
    createdAt: number; // 创建时间
  }[]; // 截图历史

  [key: string]: any; // React Flow 约束兼容
}

/**
 * 音频生成节点数据结构
 * 用于 AI 音频生成任务
 */
export interface AudioGenerationNode {
  // ---- 核心输入参数 ----
  model: string; // 使用的模型
  prompt?: string; // 生成提示词
  promptDraft?: string; // 输入面板草稿文本
  promptDraftHtml?: string; // 输入面板草稿富文本
  duration?: number; // 音频时长（秒）

  // ---- 状态管理 ----
  status?: GenerationStatus; // 当前生成状态
  progress?: number; // 进度百分比（0-100）
  isUpload?: boolean; // 是否为上传音频

  // ---- 输出结果 ----
  task_id?: string; // 任务 ID（用于轮询）
  result?: {
    type: "audio"; // 结果类型
    data: {
      url: string; // 远程 OSS URL（始终存储）
      remoteUrl?: string; // 兼容新字段，明确标识持久化远程地址
      displayUrl?: string; // 运行时展示地址，允许为 blob URL，不参与持久化
      format?: string; // 音频格式（如 mp3, wav）
      duration?: number; // 音频时长
      localPath?: string; // 本地相对路径（Tauri asset 协议备用访问）
      localName?: string; // 本地文件名（Tauri asset 协议备用访问）
      assetName?: string; // 资产库显示名称
    }[];
  };

  // ---- 裁剪信息 ----
  trimInfo?: {
    sourceNodeId?: string; // 源节点 ID
    startTime?: number; // 裁剪开始时间
    endTime?: number; // 裁剪结束时间
  };

  // ---- 错误处理 ----
  error?: {
    code?: string;
    message?: string;
    detail?: string;
    serverMessage?: string;
    status?: number;
  };

  [key: string]: any; // React Flow 约束兼容
}

/**
 * 角色表格行数据
 */
export interface CharacterTableRow {
  姓名: string;
  基础设定: string;
  性格特征: string;
  核心动机: string;
  弱点: string;
  核心关系: string;
  习惯和兴趣: string;
  形象: string;
}

/**
 * 视频分析表格行数据
 */
export interface VideoAnalysisTableRow {
  场景: string;
  时长: string;
  镜号: string;
  景别: string;
  画面: string;
  角度: string;
  运动: string;
  主体动作: string;
  信息点: string;
  声画关系: string;
  技参: string;
  转场: string;
}

/**
 * 表格节点数据结构
 * 用于展示角色设计、视频拉片等表格数据
 */
export interface TableNodeData {
  title: string;
  columns: string[];
  rows: any[];
  characterProfiles?: unknown[];
  createdAt?: number;
  [key: string]: any;
}

// ==================== 辅助类型 ====================

/**
 * API 类型定义（通用节点类型）
 * 用于表示任意 API 调用节点
 */
export type APIClassType = Record<string, any>;

/**
 * 边的数据结构
 */
export interface EdgeDataType {
  label?: string; // 边的标签
  animated?: boolean; // 是否动画
  style?: Record<string, any>; // 边的样式
  [key: string]: any; // React Flow 约束兼容
}

/**
 * 构建状态类型
 */
export type BuildStatus = "idle" | "pending" | "success" | "failed";
/**
 * 节点操作数据结构
 * 用于在画布上表示和操作节点的元数据
 */
export interface NodeDataType {
  showNode?: boolean; // 是否显示节点
  type: string; // 节点类型标识
  node: APIClassType; // 节点的 API 配置
  id: string; // 节点唯一标识符
  output_types?: string[]; // 输出类型列表
  selected_output_type?: string; // 当前选择的输出类型
  buildStatus?: BuildStatus; // 构建状态
  selected_output?: string; // 选择的输出
}

// ==================== 流和节点类型 ====================

/**
 * 流样式配置
 */
export interface FlowStyleType {
  emoji: string; // 流的表情图标
  color: string; // 流的颜色
  flow_id: string; // 关联的流 ID
}

// 第一个泛型参数是定义节点 `data` 属性的类型，即节点携带的业务数据
// 第二个泛型参数是 节点的类型标识符
export type TextNodeType = Node<TextGenerationNode, "textNode">;
export type ImageNodeType = Node<ImageGenerationNode, "imageNode">;
// 节点里面的 data 结构是 NoteNodeData
export type NoteNodeType = Node<NoteNodeData, "noteNode">;
export type AgentNodeType = Node<AgentNode, "agentNode">;
// 文本智能体节点
export type TextAgentNodeType = Node<TextAgentNodeData, "textAgentNode">;
// 图片智能体节点
export type ImageAgentNodeType = Node<ImageAgentNodeData, "imageAgentNode">;
// 视频智能体节点
export type VideoAgentNodeType = Node<VideoAgentNodeData, "videoAgentNode">;
// 全景图节点
export type PanoramaNodeType = Node<PanoramaNodeData, "panoramaNode">;
// 音频节点
export type AudioNodeType = Node<AudioGenerationNode, "audioNode">;
// 表格节点
export type TableNodeType = Node<TableNodeData, "tableNode">;
// React Flow 默认的节点类型
export type DefaultNodeType = Node<any, "default">;
// 新版视频节点
export type NewVideoNodeType = Node<NewVideoGenerationNode, "newVideoNode">;

export type AllNodeType =
  | TextNodeType
  | ImageNodeType
  | NoteNodeType
  | AgentNodeType
  | TextAgentNodeType
  | ImageAgentNodeType
  | VideoAgentNodeType
  | PanoramaNodeType
  | AudioNodeType
  | TableNodeType
  | DefaultNodeType
  | NewVideoNodeType;
export type EdgeType = Edge<EdgeDataType, "default">;

// ==================== 流类型 ====================

/**
 * 流配置类型
 * 表示一个完整的工作流或数据处理管道
 */
export type FlowType = {
  id: string; // 流的唯一标识符
  name: string; // 流的名称
  description: string; // 流的描述
  //   data: any; // 流的图数据 (ReactFlowJsonObject<AllNodeType, EdgeType>)
  data: ReactFlowJsonObject<AllNodeType, EdgeType> | null;
  style?: FlowStyleType; // 流的样式配置
  updated_at?: string; // 最后更新时间
  date_created?: string; // 创建时间
};
