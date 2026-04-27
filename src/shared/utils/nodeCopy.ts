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

  return {
    ...rest,
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
