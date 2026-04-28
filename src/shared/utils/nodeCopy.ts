import { GenerationStatus } from "shared/constants/enum";
import type { AllNodeType } from "shared/types/flow";

const isRunningGenerationStatus = (status: unknown) =>
  status === GenerationStatus.IN_PROGRESS ||
  status === GenerationStatus.QUEUED ||
  status === "generating";

const getIdleStatusForCopiedNode = (nodeType: AllNodeType["type"]) => {
  if (
    nodeType === "textAgentNode" ||
    nodeType === "imageAgentNode" ||
    nodeType === "videoAgentNode"
  ) {
    return "idle";
  }

  return GenerationStatus.COMPLETED;
};

export const resetNodeDataRuntimeState = <T>(
  nodeType: AllNodeType["type"],
  data: T,
): T => {
  if (!data || typeof data !== "object") {
    return data;
  }

  const nodeData = data as Record<string, unknown>;

  if (!isRunningGenerationStatus(nodeData.status)) {
    return data;
  }

  const {
    error: _error,
    isLoading: _isLoading,
    progress: _progress,
    task_id: _taskIdSnake,
    taskId: _taskIdCamel,
    ...rest
  } = nodeData;
  const nextRest = { ...rest };

  if (
    nodeType === "newVideoNode" &&
    nextRest.metadata &&
    typeof nextRest.metadata === "object"
  ) {
    const {
      tasks: _tasks,
      failedTasks: _failedTasks,
      count: _count,
      ...metadataRest
    } = nextRest.metadata as Record<string, unknown>;
    // 复制生成中的新版视频节点时，只保留用户参数，清掉运行时任务队列，行为对齐老版视频节点。
    nextRest.metadata = metadataRest;
  }

  return {
    ...nextRest,
    status: getIdleStatusForCopiedNode(nodeType),
    progress: 0,
    isLoading: false,
  } as T;
};

export const cloneNodeDataForCopy = (
  nodeType: AllNodeType["type"],
  data: unknown,
): Record<string, unknown> => {
  const clonedData = JSON.parse(JSON.stringify(data ?? {})) as Record<
    string,
    unknown
  >;

  return resetNodeDataRuntimeState(nodeType, clonedData);
};
