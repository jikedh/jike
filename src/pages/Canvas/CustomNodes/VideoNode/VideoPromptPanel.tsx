import { useCallback, useMemo, useRef } from 'react'

import { VIDEO_DURATION_CONFIG, VIDEO_MODELS } from '@/constants/ai-models'
import { GenerationStatus } from '@/constants/enum'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import useMessage from '@/hooks/useMessage'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { VideoGenerationNode } from '@/types/flow'
import { uploadFileToOSS } from '@/utils/oss'
import { getMediaUrl } from '@/utils/projectStorage'

import { PROMPT_PANEL_STYLES } from '../shared/promptPanelStyles'
import { getVideoPayloadStrategy } from './strategies/videoPayloadStrategies'
import { VideoPromptEditor } from './components/VideoPromptEditor'
import type { VideoPromptEditorHandle } from './components/VideoPromptEditor'
import { VideoReferenceAssetsBar } from './components/VideoReferenceAssetsBar'
import { VideoModelParamsPanel } from './components/VideoModelParamsPanel'
import { useVideoNodeReferences } from './hooks/useVideoNodeReferences'
import { useVideoReferenceActions } from './hooks/useVideoReferenceActions'

/**
 * 视频节点提示词面板（容器组件）。
 * 负责：聚合状态、分发子组件、组织“生成”动作。
 */
export const VideoPromptPanel = ({ nodeId }: { nodeId: string }) => {
  const editorRef = useRef<VideoPromptEditorHandle | null>(null)

  const { success, warning } = useMessage()

  const nodes = useCanvasFlowStore((state) => state.nodes)
  const edges = useCanvasFlowStore((state) => state.edges)
  const startVideoGeneration = useCanvasFlowStore((state) => state.startVideoGeneration)
  const updateVideoNodeData = useCanvasFlowStore((state) => state.updateVideoNodeData)
  const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge)

  const currentNode = useMemo(() => {
    return nodes.find((node) => node.id === nodeId)
  }, [nodes, nodeId])

  const currentVideoData = useMemo(() => {
    if (!currentNode || currentNode.type !== 'videoNode') {
      return null
    }

    return currentNode.data as VideoGenerationNode
  }, [currentNode])

  const referenceImageUrls = useMemo(() => {
    return currentVideoData?.image_urls ?? []
  }, [currentVideoData?.image_urls])

  const model = currentVideoData?.model ?? (VIDEO_MODELS[0]?.model ?? 'doubao-seedance-2.0')
  const aspectRatio = currentVideoData?.aspect_ratio ?? '16:9'
  const videoSize = currentVideoData?.metadata?.size ?? '1280x720'
  const duration = currentVideoData?.duration ?? VIDEO_DURATION_CONFIG.defaultValue
  const resolution = currentVideoData?.metadata?.resolution ?? '720p'
  const seed = currentVideoData?.metadata?.seed ?? -1
  const audio = currentVideoData?.audio ?? false
  const camerafixed = currentVideoData?.camerafixed ?? false
  const promptDraftHtml = currentVideoData?.promptDraftHtml ?? '<p></p>'
  const seedance20Metadata = currentVideoData?.metadata ?? {}

  const {
    parentVideoNodes,
    parentAudioNodes,
    parentImageNodes,
    parentImageNodeUrls,
    parentImageNodeIdByUrl,
    parentNoteContents,
    videoMentionItems,
    allImageUrls,
    allVideoUrls,
    allAudioUrls,
  } = useVideoNodeReferences({
    nodeId,
    nodes,
    edges,
    model,
    referenceImageUrls,
  })

  const {
    isUploading,
    fileInputRef,
    handleDisconnectNode,
    handleRemoveReferenceImage,
    handleUploadClick,
    handleFileChange,
  } = useVideoReferenceActions({
    nodeId,
    edges,
    currentImageUrls: referenceImageUrls,
    updateVideoNodeData,
    deleteEdge,
  })

  const isGenerating = useMemo(() => {
    if (!currentNode || currentNode.type !== 'videoNode') {
      return false
    }

    const status = currentNode.data.status
    return status === GenerationStatus.IN_PROGRESS || status === GenerationStatus.QUEUED
  }, [currentNode])

  /**
   * 编辑器草稿变化回调。
   * 每次输入同步更新纯文本和富文本草稿，保持与当前节点数据一致。
   */
  const handleDraftChange = useCallback((payload: { text: string; html: string }) => {
    updateVideoNodeData(nodeId, {
      promptDraft: payload.text,
      promptDraftHtml: payload.html,
    })
  }, [nodeId, updateVideoNodeData])

  /**
   * 触发视频生成。
   * 合并上游 note 文本与当前编辑器文本后，按模型策略构建 payload。
   */
  const handleGenerate = useCallback(async () => {
    if (!currentVideoData) {
      warning('当前视频节点不可用')
      return
    }

    // 防止连续点击触发重复请求
    if (isGenerating) {
      return
    }

    const promptText = editorRef.current?.getPlainText() ?? ''
    const mergedPrompt = [...parentNoteContents, promptText]
      .map((content) => content.trim())
      .filter((content) => content.length > 0)
      .join(' ')

    if (!mergedPrompt) {
      warning('请输入提示词')
      return
    }

    // 构建本地文件映射：从 URL 到本地文件信息
    const localFileMap = new Map<string, { relativePath: string; fileName: string }>()

    // 添加父节点的本地文件
    for (const parentItem of parentImageNodes) {
      if (parentItem.url && parentItem.relativePath && parentItem.fileName) {
        console.log('[VideoNode] 添加父节点本地文件到映射:', parentItem.url, parentItem.relativePath, parentItem.fileName)
        localFileMap.set(parentItem.url, { relativePath: parentItem.relativePath, fileName: parentItem.fileName })
      }
    }

    // 检查参考图是否是本地文件，如果是则先上传到 OSS
    let processedImageUrls: string[] = []

    console.log('[VideoNode] allImageUrls:', allImageUrls)
    console.log('[VideoNode] localFileMap keys:', Array.from(localFileMap.keys()))

    for (const url of allImageUrls) {
      const localFileInfo = localFileMap.get(url)
      console.log('[VideoNode] 检查 URL:', url, '本地文件信息:', localFileInfo)

      if (localFileInfo) {
        // 这是本地文件，需要上传到 OSS
        try {
          if (window.storage) {
            // 获取绝对路径
            const absolutePath = getMediaUrl(localFileInfo.relativePath)
            console.log('[VideoNode] 绝对路径:', absolutePath)

            if (absolutePath) {
              const readResult = await window.storage.readFile(absolutePath)
              console.log('[VideoNode] 读取结果:', readResult.success, readResult.error)

              if (readResult.success && readResult.data) {
                // 创建 File 对象
                const ext = localFileInfo.fileName.split('.').pop() || 'png'
                const arrayBuffer = readResult.data instanceof Uint8Array
                  ? readResult.data.buffer
                  : readResult.data
                const file = new File([arrayBuffer], localFileInfo.fileName, { type: `image/${ext}` })

                console.log('[VideoNode] 开始上传到 OSS, 文件大小:', file.size)

                // 上传到 OSS
                const ossResult = await uploadFileToOSS(file)
                console.log('[VideoNode] OSS 上传结果:', ossResult)

                if (ossResult.url) {
                  processedImageUrls.push(ossResult.url)
                  console.log('[VideoNode] 上传成功，OSS URL:', ossResult.url)
                } else {
                  warning('上传参考图失败，请重试')
                  return
                }
              } else {
                warning('读取本地参考图失败')
                return
              }
            } else {
              warning('获取本地参考图路径失败')
              return
            }
          } else {
            warning('存储功能不可用，无法上传本地图片')
            return
          }
        } catch (uploadError) {
          console.error('上传本地图片到 OSS 失败:', uploadError)
          warning('上传参考图失败，请重试')
          return
        }
      } else {
        // 这是在线图片 URL，直接使用
        console.log('[VideoNode] 使用在线 URL:', url)
        processedImageUrls.push(url)
      }
    }

    console.log('[VideoNode] 最终上传的 URL 列表:', processedImageUrls)

    // Seedance 2.0 在存在参考音频时仅允许使用 Pro 模式。
    // 命中该条件时先提示用户，再自动修正为 Pro 并继续本次生成。
    const isSeedance20Model = model === 'doubao-seedance-2.0'
    const hasReferenceAudio = allAudioUrls.length > 0
    const currentSeedanceMode = currentVideoData.metadata?.mode ?? 'fast'
    const shouldForceProMode = isSeedance20Model && hasReferenceAudio && currentSeedanceMode !== 'pro'

    let nextVideoData = currentVideoData
    if (shouldForceProMode) {
      warning('当存在音频的时候只能使用Pro模型')

      const nextMetadata = {
        ...(currentVideoData.metadata ?? {}),
        mode: 'pro',
      }

      // 同步更新节点状态，保证 UI 与后续生成配置一致。
      updateVideoNodeData(nodeId, { metadata: nextMetadata })

      // 使用本地修正后的快照立即构建 payload，避免等待 store 异步回流。
      nextVideoData = {
        ...currentVideoData,
        metadata: nextMetadata,
      }
    }

    const strategy = getVideoPayloadStrategy(model)
    const payload = strategy.buildPayload(nextVideoData, {
      prompt: mergedPrompt,
      imageUrls: processedImageUrls,
      videoUrls: allVideoUrls,
      audioUrls: allAudioUrls,
    })

    await startVideoGeneration(nodeId, payload)
    success('已开始生成视频')
  }, [currentVideoData, warning, isGenerating, parentNoteContents, model, allImageUrls, allVideoUrls, allAudioUrls, updateVideoNodeData, startVideoGeneration, nodeId, success, parentImageNodes])

  return (
    <div className={PROMPT_PANEL_STYLES.container} style={{ pointerEvents: 'auto' }}>
      <div className={PROMPT_PANEL_STYLES.inputArea}>
        <VideoPromptEditor
          ref={editorRef}
          promptDraftHtml={promptDraftHtml}
          mentionItems={videoMentionItems}
          onDraftChange={handleDraftChange}
        />

        <VideoReferenceAssetsBar
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          onUploadClick={handleUploadClick}
          onFileChange={handleFileChange}
          referenceImageUrls={referenceImageUrls}
          parentImageNodeUrls={parentImageNodeUrls}
          parentImageNodeIdByUrl={parentImageNodeIdByUrl}
          parentAudioNodes={parentAudioNodes}
          parentVideoNodes={parentVideoNodes}
          model={model}
          onDisconnectNode={handleDisconnectNode}
          onRemoveReferenceImage={handleRemoveReferenceImage}
        />
      </div>

      <div className={PROMPT_PANEL_STYLES.controlArea}>
        <div className="flex items-center gap-2">
          <Select
            value={model}
            onValueChange={(value) => {
              updateVideoNodeData(nodeId, { model: value })
            }}
          >
            <SelectTrigger className={PROMPT_PANEL_STYLES.modelSelect}>
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent className={PROMPT_PANEL_STYLES.modelSelectContent}>
              {VIDEO_MODELS.map((item) => (
                <SelectItem key={item.id} value={item.model} className={PROMPT_PANEL_STYLES.modelSelectItem}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <VideoModelParamsPanel
            model={model}
            currentVideoData={currentVideoData}
            aspectRatio={aspectRatio}
            videoSize={videoSize}
            duration={duration}
            resolution={resolution}
            seed={seed}
            audio={audio}
            camerafixed={camerafixed}
            seedance20Metadata={seedance20Metadata}
            onPatch={(patch) => updateVideoNodeData(nodeId, patch)}
          />

          <div className="ml-auto">
            <Button
              type="button"
              unstyled
              className={PROMPT_PANEL_STYLES.generateButton}
              loading={isGenerating}
              onClick={handleGenerate}
              disabled={isUploading}
            >
              生成
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
