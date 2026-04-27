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

export const cloneNodeDataForCopy = (
  nodeType: AllNodeType["type"],
  data: unknown,
) => {
  const clonedData = JSON.parse(JSON.stringify(data ?? {}));

  if (!isRunningGenerationStatus(clonedData.status)) {
    return clonedData;
  }

  const {
    error: _error,
    isLoading: _isLoading,
    progress: _progress,
    task_id: _taskIdSnake,
    taskId: _taskIdCamel,
    ...rest
  } = clonedData;

  return {
    ...rest,
    status: getIdleStatusForCopiedNode(nodeType),
    progress: 0,
    isLoading: false,
  };
};
