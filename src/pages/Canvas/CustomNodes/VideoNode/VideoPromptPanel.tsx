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

      const promptText = editorRef.current?.getPlainText() ?? ''
      const mergedPrompt = [...parentNoteContents, promptText]
          .map((content) => content.trim())
          .filter((content) => content.length > 0)
          .join(' ')

      if (!mergedPrompt) {
          warning('请输入提示词')
          return
      }

      const strategy = getVideoPayloadStrategy(model)
      const payload = strategy.buildPayload(currentVideoData, {
          prompt: mergedPrompt,
        imageUrls: allImageUrls,
        videoUrls: allVideoUrls,
        audioUrls: allAudioUrls,
    })

      await startVideoGeneration(nodeId, payload)
      success('已开始生成视频')
  }, [currentVideoData, warning, parentNoteContents, model, allImageUrls, allVideoUrls, allAudioUrls, startVideoGeneration, nodeId, success])

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
