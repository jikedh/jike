import { GenerationStatus } from '@/constants/enum'

const standardInProgressStatusMap: Record<string, GenerationStatus> = {
  queued: GenerationStatus.QUEUED,
  pending: GenerationStatus.QUEUED,
  in_progress: GenerationStatus.IN_PROGRESS,
  processing: GenerationStatus.IN_PROGRESS,
  running: GenerationStatus.IN_PROGRESS,
}

const seedance20InProgressStatusMap: Record<string, GenerationStatus> = {
  queued: GenerationStatus.QUEUED,
  processing: GenerationStatus.IN_PROGRESS,
  running: GenerationStatus.IN_PROGRESS,
}

const standardFailedStatusSet = new Set([
  'failed',
  'canceled',
  'cancelled',
  'error',
])

const standardCompletedStatusSet = new Set([
  'completed',
  'succeeded',
])

const normalizeResultItems = (items: any[]) => {
  return items
    .filter((item) => !!item?.url)
    .map((item) => ({
      ...item,
      format: item?.format ?? 'mp4',
    }))
}

const extractStandardVideoItems = (response: any) => {
  const resultItems = normalizeResultItems(Array.isArray(response?.result?.data) ? response.result.data : [])
  if (resultItems.length > 0) {
    return resultItems
  }

  // 标准任务的兼容路径（按优先级兜底）
  const fallbackUrl = response?.metadata?.url || response?.data?.video_url || response?.data?.url
  if (fallbackUrl) {
    return [{
      url: fallbackUrl,
      format: response?.metadata?.format ?? 'mp4',
    }]
  }

  return []
}

const extractSeedance20VideoItems = (response: any) => {
  const resultUrl = response?.data?.video_url
  if (!resultUrl) {
    return []
  }

  return [{
    url: resultUrl,
    format: 'mp4',
  }]
}

const getErrorMessage = (response: any, fallbackMessage: string) => {
  const message = response?.error?.message
    || response?.error
    || response?.message
    || response?.data?.error

  if (!message) {
    return fallbackMessage
  }

  if (typeof message === 'string') {
    return message
  }

  return JSON.stringify(message)
}

export const normalizeVideoTaskResponse = (model: string, response: any) => {
  const isSeedance20 = model === 'doubao-seedance-2.0'

  if (isSeedance20) {
    const rawStatus = response?.data?.status
    const taskId = response?.data?.task_id
    const progress = response?.data?.progress ?? 0
    const videoItems = extractSeedance20VideoItems(response)

    if (rawStatus === 'succeeded' || rawStatus === 'completed') {
      return {
        status: GenerationStatus.COMPLETED,
        progress: 100,
        taskId,
        videoItems,
        missingResultUrl: videoItems.length === 0,
        errorMessage: undefined,
      }
    }

    if (rawStatus === 'failed' || rawStatus === 'canceled' || rawStatus === 'cancelled' || rawStatus === 'error') {
      return {
        status: GenerationStatus.FAILED,
        progress,
        taskId,
        videoItems: [],
        missingResultUrl: false,
        errorMessage: getErrorMessage(response, '生成失败，请稍后再试'),
      }
    }

    return {
      status: seedance20InProgressStatusMap[rawStatus] ?? GenerationStatus.IN_PROGRESS,
      progress,
      taskId,
      videoItems,
      missingResultUrl: false,
      errorMessage: undefined,
    }
  }

  const rawStatus = response?.status
  const taskId = response?.id
  const progress = response?.progress ?? 0

  if (standardCompletedStatusSet.has(rawStatus)) {
    const videoItems = extractStandardVideoItems(response)
    return {
      status: GenerationStatus.COMPLETED,
      progress: 100,
      taskId,
      videoItems,
      missingResultUrl: videoItems.length === 0,
      errorMessage: undefined,
    }
  }

  if (standardFailedStatusSet.has(rawStatus)) {
    return {
      status: GenerationStatus.FAILED,
      progress,
      taskId,
      videoItems: [],
      missingResultUrl: false,
      errorMessage: getErrorMessage(response, '生成失败，请稍后再试'),
      rawError: response?.error,
    }
  }

  return {
    status: standardInProgressStatusMap[rawStatus] ?? GenerationStatus.IN_PROGRESS,
    progress,
    taskId,
    videoItems: [],
    missingResultUrl: false,
    errorMessage: undefined,
  }
}
