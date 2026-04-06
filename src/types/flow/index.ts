import type { Edge, Node, ReactFlowJsonObject } from "@xyflow/react";
import type { ChatMessage } from "../ai";
import { GenerationStatus } from "@/constants/enum";

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
  quality?: string; // 图片质量，如 "standard", "hd"
  style?: string; // 图片风格
  image_urls?: string[]; // 参考图片 URL 列表（统一关键字段，包含上传和来自依赖节点的图片）
  midjourneyAdvanced?: {
    referenceUrls?: string[] // Midjourney 参考图列表（用于拼接前缀 URL）
    styleUrls?: string[] // Midjourney 风格图列表（用于 --sref）
    iw?: number // Midjourney 参考图权重（用于 --iw）
    sw?: number // Midjourney 风格权重（用于 --sw）
  }
  // ---- 输出结果 ----
  result?: {
    type: string; // 结果类型
    data?: {
      url?: string; // 图片 URL
    }[]; // 图片数据列表（支持多张图片累积）
  }; // 生成结果
  // ---- 状态管理 ----
  status?: GenerationStatus; // 当前生成状态
  progress?: number; // 进度百分比（0-100）
  completedCount?: number; // 已完成图片数量（用于多图生成场景判断）
  isUpload?: boolean; // 是否为上传图片（用于区分加载中/生成中）
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
 * 视频生成节点数据结构
 * 用于 AI 视频生成任务
 */
export interface VideoGenerationNode {

  model: string; // 使用的模型
  prompt: string; // 生成提示词
  promptDraft?: string; // 输入面板草稿文本
  promptDraftHtml?: string; // 输入面板草稿富文本
  duration?: number; // 视频时长（秒）
  aspect_ratio: string; // 宽高比，如 "16:9"
  image_urls?: string[]; // 参考图像 URL 列表
  status?: GenerationStatus; // 当前生成状态
  progress?: number; // 进度百分比（0-100）
  metadata: {
    size?: string; // 视频尺寸，例如 "1920x1080", "720x720"
    resolution?: string; // 视频分辨率，如 "720p", "480p"
    seed?: number; // 随机种子，用于控制生成内容的随机性
    // Veo3 专属扩展参数
    generateAudio?: boolean; // 是否生成音频
    negativePrompt?: string; // 负面提示词
    personGeneration?: string; // 人物生成安全设置
    referenceImages?: string[]; // 素材/风格参考图 URL 数组
    compressionQuality?: string; // 视频压缩质量
    resizeMode?: string; // 图片调整模式
    // Kling Video O1 专属扩展参数
    mode?: string; // 生成模式：std(标准) | pro(专业)
    watermark?: boolean; // 是否添加水印
    video_list?: {
      // 参考视频列表
      video_url?: string; // 视频 URL
      refer_type?: string; // 参考类型：base | feature
      keep_original_sound?: string; // 是否保留原声：yes | no
    }[];
    // MiniMax Hailuo 2.3 专属扩展参数（严格遵循 API 字段命名）
    first_frame_image?: string; // 首帧图片 URL
    prompt_optimizer?: boolean; // 是否自动优化 prompt
    fast_pretreatment?: boolean; // 是否快速预处理
    // Seedance 2.0 专属扩展参数
    input_type?: 'reference' | 'first_last_frame'; // 输入类型
    generate_audio?: boolean; // 是否生成同步音频
    web_search?: boolean; // 是否启用联网搜索增强（仅 pro）
  };
  audio?: boolean; // 是否生成音频（豆包 1.5 Pro 独有功能）
  camerafixed?: boolean; // 是否固定摄像头

  // ---- 输出结果 ----
  task_id?: string; // 任务 ID（用于轮询）对应响应结果里面的id字段
  error?: {
    code?: string; // 错误代码
    message?: string; // 错误信息（兜底显示）
    detail?: string; // 后端返回的详细错误信息（优先展示）
    serverMessage?: string; // 原始后端错误消息
    status?: number; // HTTP 状态码
  }; // 错误对象
    result?: {
    // 任务结果（仅成功时返回）
    type: string; // 结果类型，固定为 video
    data: {
      // 视频数据数组
      url: string; // 生成的视频 URL
      format: string; // 视频格式（如 mp4）
    }[];
  };
  isUpload?: boolean; // 是否为上传视频（用于区分加载中/生成中）
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
    type: 'single' | '4grid' | '12grid'; // 截图类型
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
    type: 'audio'; // 结果类型
    data: {
      url: string; // 生成的音频 URL
      format?: string; // 音频格式（如 mp3, wav）
      duration?: number; // 音频时长
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
export type VideoNodeType = Node<VideoGenerationNode, "videoNode">;
// 节点里面的 data 结构是 NoteNodeData
export type NoteNodeType = Node<NoteNodeData, "noteNode">;
export type AgentNodeType = Node<AgentNode, "agentNode">;
// 全景图节点
export type PanoramaNodeType = Node<PanoramaNodeData, "panoramaNode">;
// 音频节点
export type AudioNodeType = Node<AudioGenerationNode, "audioNode">;
// React Flow 默认的节点类型
export type DefaultNodeType = Node<any, "default">;

export type AllNodeType = TextNodeType | ImageNodeType | VideoNodeType | NoteNodeType | AgentNodeType | PanoramaNodeType | AudioNodeType | DefaultNodeType;
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
}
