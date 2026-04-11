/**
 * React Flow 画布工具函数
 * 提供与业务无关的通用工具方法，支持节点数据更新、轮询管理、参考资源高亮等功能
 */
import type {
  AllNodeType,
  AudioGenerationNode,
  EdgeType,
  ImageGenerationNode,
  VideoGenerationNode,
} from "shared/types/flow";

// ==================== 常量配置 ====================

/** 图片轮询间隔（毫秒） */
export const IMAGE_POLL_INTERVAL = 10000;
/** 图片生成超时（毫秒）= 5 分钟 */
export const IMAGE_TIMEOUT = 5 * 60 * 1000;
/** 视频轮询间隔（毫秒） */
export const VIDEO_POLL_INTERVAL = 10000;
/** 视频生成超时（毫秒）= 30 分钟 */
export const VIDEO_TIMEOUT = 30 * 60 * 1000;
/** 视频结果等待超时（毫秒）= 10 秒 */
export const VIDEO_RESULT_WAIT_TIMEOUT = 10 * 1000;

// ==================== 轮询控制器 ====================

/** 图片轮询控制器映射（taskId -> AbortController） */
export const imagePollingControllers = new Map<string, AbortController>();
/** 待完成图片任务计数映射（nodeId -> 任务数量） */
export const pendingTaskCounts = new Map<string, number>();
/** 视频轮询控制器映射（nodeId -> AbortController） */
export const videoPollingControllers = new Map<string, AbortController>();

// ==================== 节点位置工具 ====================

/**
 * 基于最后一个节点的位置，计算新节点的默认位置
 * @param nodes 当前节点数组
 * @returns 新节点位置（x, y）
 */
export const getNextNodePosition = (nodes: AllNodeType[]) => {
  const lastNode = nodes[nodes.length - 1];
  const fallbackPosition = { x: 220, y: 180 };

  return lastNode
    ? {
      x: lastNode.position.x + 40,
      y: lastNode.position.y + 40,
    }
    : fallbackPosition;
};

// ==================== 可中断等待 ====================

/**
 * 可中断的等待函数
 * @param ms 等待毫秒数
 * @param signal 可选的 AbortSignal，用于提前终止等待
 * @returns Promise<void>
 */
export const wait = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    const handleAbort = () => {
      window.clearTimeout(timer);
      resolve();
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
};

// ==================== 节点数据更新工具 ====================

/**
 * 更新图片节点数据的通用辅助函数
 * @param nodes 节点数组
 * @param nodeId 要更新的节点 ID
 * @param updater 数据更新函数
 * @returns 更新后的节点数组
 */
export const updateImageNodeInList = (
  nodes: AllNodeType[],
  nodeId: string,
  updater: (data: ImageGenerationNode) => ImageGenerationNode,
): AllNodeType[] => {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "imageNode") {
      return node;
    }

    return {
      ...node,
      data: updater(node.data as ImageGenerationNode),
    };
  });
};

/**
 * 更新视频节点数据的通用辅助函数
 * @param nodes 节点数组
 * @param nodeId 要更新的节点 ID
 * @param updater 数据更新函数
 * @returns 更新后的节点数组
 */
export const updateVideoNodeInList = (
  nodes: AllNodeType[],
  nodeId: string,
  updater: (data: VideoGenerationNode) => VideoGenerationNode,
): AllNodeType[] => {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "videoNode") {
      return node;
    }

    return {
      ...node,
      data: updater(node.data as VideoGenerationNode),
    };
  });
};

/**
 * 更新音频节点数据的通用辅助函数
 * @param nodes 节点数组
 * @param nodeId 要更新的节点 ID
 * @param updater 数据更新函数
 * @returns 更新后的节点数组
 */
export const updateAudioNodeInList = (
  nodes: AllNodeType[],
  nodeId: string,
  updater: (data: AudioGenerationNode) => AudioGenerationNode,
): AllNodeType[] => {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "audioNode") {
      return node;
    }

    return {
      ...node,
      data: updater(node.data as AudioGenerationNode),
    };
  });
};

/**
 * 更新文本智能体节点数据的通用辅助函数
 * @param nodes 节点数组
 * @param nodeId 要更新的节点 ID
 * @param updater 数据更新函数
 * @returns 更新后的节点数组
 */
export const updateTextAgentNodeInList = (
  nodes: AllNodeType[],
  nodeId: string,
  updater: (data: any) => any,
): AllNodeType[] => {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "textAgentNode") {
      return node;
    }

    return {
      ...node,
      data: updater(node.data),
    };
  });
};

/**
 * 更新表格节点数据的通用辅助函数
 * @param nodes 节点数组
 * @param nodeId 要更新的节点 ID
 * @param updater 数据更新函数
 * @returns 更新后的节点数组
 */
export const updateTableNodeInList = (
  nodes: AllNodeType[],
  nodeId: string,
  updater: (data: any) => any,
): AllNodeType[] => {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "tableNode") {
      return node;
    }

    return {
      ...node,
      data: updater(node.data),
    };
  });
};

// ==================== 轮询控制工具 ====================

/**
 * 停止指定任务的图片轮询
 * @param taskId 任务 ID
 */
export const stopImagePollingInternal = (taskId: string): void => {
  const controller = imagePollingControllers.get(taskId);
  if (controller) {
    controller.abort();
  }
  imagePollingControllers.delete(taskId);
};

/**
 * 停止指定节点下所有图片任务的轮询
 * @param nodeId 节点 ID
 */
export const stopAllImagePollingForNode = (nodeId: string): void => {
  imagePollingControllers.forEach((controller) => {
    controller.abort();
  });
  imagePollingControllers.clear();
};

/**
 * 停止指定节点的视频轮询
 * @param nodeId 节点 ID
 */
export const stopVideoPollingInternal = (nodeId: string): void => {
  const controller = videoPollingControllers.get(nodeId);
  if (controller) {
    controller.abort();
  }
  videoPollingControllers.delete(nodeId);
};

/**
 * 停止所有轮询（用于清空画布或切换项目前）
 */
export const stopAllPolling = (): void => {
  imagePollingControllers.forEach((controller) => controller.abort());
  imagePollingControllers.clear();
  videoPollingControllers.forEach((controller) => controller.abort());
  videoPollingControllers.clear();
  pendingTaskCounts.clear();
};

// ==================== 参考资源悬浮高亮工具 ====================

/**
 * 构建参考资源悬浮 key
 * @param sourceNodeId 源节点 ID
 * @param targetNodeId 目标节点 ID
 * @returns 格式化的 key 字符串 "sourceNodeId__targetNodeId"
 */
export const buildReferenceHoverKey = (
  sourceNodeId: string,
  targetNodeId: string,
): string => {
  return `${sourceNodeId}__${targetNodeId}`;
};

/**
 * 解析参考资源悬浮 key
 * @param key 格式化的 key 字符串
 * @returns 解析后的 sourceNodeId 和 targetNodeId
 */
export const parseReferenceHoverKey = (
  key: string,
): { sourceNodeId: string; targetNodeId: string } => {
  const [sourceNodeId, targetNodeId] = key.split("__");
  return { sourceNodeId, targetNodeId };
};

/**
 * 根据引用计数和边列表，构建高亮状态
 * 自动清理已失效的引用关系
 * @param referenceHoverRefCounts 引用计数映射
 * @param edges 当前边数组
 * @returns 更新后的引用计数、高亮边 ID 列表、高亮源节点 ID 列表
 */
export const buildReferenceHighlightState = (
  referenceHoverRefCounts: Record<string, number>,
  edges: EdgeType[],
): {
  referenceHoverRefCounts: Record<string, number>;
  highlightedEdgeIds: string[];
  highlightedSourceNodeIds: string[];
} => {
  const nextRefCounts: Record<string, number> = {};
  const highlightedEdgeIdSet = new Set<string>();
  const highlightedSourceNodeIdSet = new Set<string>();

  Object.entries(referenceHoverRefCounts).forEach(([key, count]) => {
    if (!count || count <= 0) {
      return;
    }

    const { sourceNodeId, targetNodeId } = parseReferenceHoverKey(key);
    if (!sourceNodeId || !targetNodeId) {
      return;
    }

    const matchedEdges = edges.filter(
      (edge) => edge.source === sourceNodeId && edge.target === targetNodeId,
    );
    if (matchedEdges.length === 0) {
      return;
    }

    nextRefCounts[key] = count;
    highlightedSourceNodeIdSet.add(sourceNodeId);
    matchedEdges.forEach((edge) => highlightedEdgeIdSet.add(edge.id));
  });

  return {
    referenceHoverRefCounts: nextRefCounts,
    highlightedEdgeIds: Array.from(highlightedEdgeIdSet),
    highlightedSourceNodeIds: Array.from(highlightedSourceNodeIdSet),
  };
};

// ==================== 类型导出 ====================

export type {
  AllNodeType,
  AudioGenerationNode,
  EdgeType,
  ImageGenerationNode,
  VideoGenerationNode,
} from "shared/types/flow";
