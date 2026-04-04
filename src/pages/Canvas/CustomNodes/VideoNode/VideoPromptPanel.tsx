import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { IconUpload } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import { VIDEO_DURATION_CONFIG, VIDEO_MODELS } from '@/constants/ai-models'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { uploadFileToOSS } from '@/utils/oss'
import { GenerationStatus } from '@/constants/enum'
import useMessage from '@/hooks/useMessage'
import { cn } from '@/lib/utils'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { NoteNodeData, VideoGenerationNode } from '@/types/flow'

import { Seedance15ProParamsPanel } from './components/Seedance15ProParamsPanel'
import { GrokVideoParamsPanel } from './components/GrokVideoParamsPanel'
import { Veo3ParamsPanel } from './components/Veo3ParamsPanel'
import { KlingVideoO1ParamsPanel } from './components/KlingVideoO1ParamsPanel'
import { MinimaxHailuo23ParamsPanel } from './components/MinimaxHailuo23ParamsPanel'
import { Seedance20ParamsPanel } from './components/Seedance20ParamsPanel'
import { getVideoPayloadStrategy } from './strategies/videoPayloadStrategies'

export const VideoPromptPanel = ({ nodeId }: { nodeId: string }) => {
    const [isUploading, setIsUploading] = useState(false)

    const { success, error, warning } = useMessage()

    const nodes = useCanvasFlowStore((state) => state.nodes)
    const edges = useCanvasFlowStore((state) => state.edges)
    const startVideoGeneration = useCanvasFlowStore((state) => state.startVideoGeneration)
    const updateVideoNodeData = useCanvasFlowStore((state) => state.updateVideoNodeData)

    const currentNode = useMemo(() => {
        return nodes.find((node) => node.id === nodeId)
    }, [nodes, nodeId])

    const currentVideoData = useMemo(() => {
        if (!currentNode || currentNode.type !== 'videoNode') {
            return null
        }

        return currentNode.data as VideoGenerationNode
    }, [currentNode])

    const aspectRatio = currentVideoData?.aspect_ratio ?? '16:9'
    const videoSize = currentVideoData?.metadata?.size ?? '1280x720'
    const duration = currentVideoData?.duration ?? VIDEO_DURATION_CONFIG.defaultValue
    const model = currentVideoData?.model ?? (VIDEO_MODELS[0]?.model ?? 'doubao-seedance-1-5-pro')
    const promptDraftHtml = currentVideoData?.promptDraftHtml ?? '<p></p>'
    // 1.5 Pro 专属参数
    const resolution = currentVideoData?.metadata?.resolution ?? '720p'
    const seed = currentVideoData?.metadata?.seed ?? -1
    const audio = currentVideoData?.audio ?? false
    const camerafixed = currentVideoData?.camerafixed ?? false
  const seedance20Metadata = currentVideoData?.metadata ?? {}

    const fileInputRef = useRef<HTMLInputElement | null>(null)

    // 参考图列表：上游连接的图片 + 用户上传的图片
    const referenceImageUrls = useMemo(() => {
        return currentVideoData?.image_urls ?? []
    }, [currentVideoData?.image_urls])

    const parentNoteContents = useMemo(() => {
        const orderedParentIds: string[] = []
        const seenParentIds = new Set<string>()

        edges.forEach((edge) => {
            if (edge.target !== nodeId || seenParentIds.has(edge.source)) {
                return
            }

            seenParentIds.add(edge.source)
            orderedParentIds.push(edge.source)
        })

        return orderedParentIds
            .map((parentId) => nodes.find((node) => node.id === parentId))
            .filter((node) => node?.type === 'noteNode')
            .map((node) => (node?.data as NoteNodeData).content?.trim())
            .filter((content) => Boolean(content)) as string[]
    }, [edges, nodes, nodeId])

    const isGenerating = useMemo(() => {
        if (!currentNode || currentNode.type !== 'videoNode') {
            return false
        }

        const status = currentNode.data.status
        return status === GenerationStatus.IN_PROGRESS || status === GenerationStatus.QUEUED
    }, [currentNode])

    const handleUploadClick = () => {
        if (isUploading) {
            return
        }
        fileInputRef.current?.click()
    }

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) {
            return
        }

        setIsUploading(true)

        try {
            const result = await uploadFileToOSS(file)
            const nextUrl = result.url

            if (!nextUrl) {
                warning('上传成功但未返回图片地址')
                return
            }

            updateVideoNodeData(nodeId, {
                image_urls: [...(currentVideoData?.image_urls ?? []), nextUrl],
            })
            success('上传成功')
        } catch (uploadError: any) {
            console.error('上传图片失败:', uploadError)
            error('上传失败，请重试')
        } finally {
            setIsUploading(false)
            event.target.value = ''
        }
    }

    const editor = useEditor({
        extensions: [StarterKit],
        content: promptDraftHtml,
        editorProps: {
            attributes: {
                class: cn(
                    'nodrag nopan nowheel min-h-[88px] max-h-[220px] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900/85 px-3 py-2 text-sm leading-6 text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                    'focus:outline-none',
                ),
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            updateVideoNodeData(nodeId, {
                promptDraft: currentEditor.getText(),
                promptDraftHtml: currentEditor.getHTML(),
            })
        },
    })

    useEffect(() => {
        if (!editor) {
            return
        }

        const currentHtml = editor.getHTML()
        if (currentHtml === promptDraftHtml) {
            return
        }

        editor.commands.setContent(promptDraftHtml, { emitUpdate: false })
    }, [editor, promptDraftHtml])

  // 根据模式限制视频时长（fast: 4-12, pro: 4-15）
  const clampSeedance20Duration = (value: number, mode: 'fast' | 'pro') => {
    const min = 4
    const max = mode === 'pro' ? 15 : 12
    return Math.min(Math.max(value, min), max)
  }

    const handleGenerate = async () => {
        const promptText = editor?.getText().trim() ?? ''
        const mergedPrompt = [...parentNoteContents, promptText]
            .map((content) => content.trim())
            .filter((content) => content.length > 0)
            .join(' ')

        if (!mergedPrompt) {
            warning('请输入提示词')
            return
        }

        // 使用策略模式构建 payload
        const strategy = getVideoPayloadStrategy(model)
        const payload = strategy.buildPayload(currentVideoData!, {
            prompt: mergedPrompt,
            imageUrls: currentVideoData?.image_urls ?? [],
        })

        try {
            await startVideoGeneration(nodeId, payload)
            success('已开始生成视频')
        } catch (generationError: any) {
            console.error('创建视频生成任务失败:', generationError)
            error('创建任务失败，请稍后再试')
        }
    }

    return (
      <div className="nodrag nopan nowheel w-[700px] min-w-[700px] rounded-3xl border border-neutral-700 bg-[linear-gradient(160deg,rgba(38,38,38,0.98)_0%,rgba(30,30,30,0.97)_58%,rgba(23,23,23,0.96)_100%)] p-3 shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur-md" >
            <div className="mb-3 rounded-2xl border border-neutral-700 bg-neutral-800/80 p-2">
                <EditorContent editor={editor} />

                <div className="nodrag nopan nowheel mt-2.5 flex gap-2 overflow-x-auto pb-1">
                    <Button
                        unstyled
                        className="nodrag nopan nowheel h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-dashed border-neutral-600 bg-neutral-800/90 text-neutral-300 transition-colors hover:border-neutral-400 hover:text-neutral-100"
                        onClick={handleUploadClick}
                        title={isUploading ? '上传中...' : '上传参考图'}
                        disabled={isUploading}
                    >
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px]">
                            <IconUpload size={16} />
                            {isUploading ? '上传中' : '上传'}
                        </div>
                    </Button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {referenceImageUrls.map((url, index) => (
                        <Button
                            key={`${url}-${index}`}
                            unstyled
                            className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800"
                            title="参考图"
                        >
                            <img
                                src={url}
                                alt="参考图"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                loading="lazy"
                            />
                        </Button>
                    ))}
                </div>
            </div>

            {/* 下方区域：参数控制区 */}
            <div className="rounded-2xl border border-neutral-700 bg-neutral-800/80 p-2.5">
                <div className="flex items-center gap-2">
                    {/* 生成模型 */}
                    <Select
                        value={model}
                        onValueChange={(value) => {
                            updateVideoNodeData(nodeId, { model: value })
                        }}
                    >
                        <SelectTrigger className="h-8 min-w-[160px] border-neutral-700 bg-neutral-900 text-xs text-neutral-100">
                            <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-800 border border-neutral-600">
                            {VIDEO_MODELS.map((item) => (
                                <SelectItem key={item.id} value={item.model} className="text-neutral-100 focus:bg-neutral-700 focus:text-neutral-100">
                                    {item.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* 整合参数面板 - 根据模型类型条件渲染 */}
                    {model === 'grok-video-3' ? (
                        <GrokVideoParamsPanel
                            aspectRatio={aspectRatio}
                            duration={duration}
                            resolution={resolution}
                            onAspectRatioChange={(value) => updateVideoNodeData(nodeId, { aspect_ratio: value })}
                            onDurationChange={(value) => updateVideoNodeData(nodeId, { duration: value })}
                            onResolutionChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        resolution: value,
                                    },
                                })
                            }}
                        />
                    ) : model.startsWith('Veo3') ? (
                        <Veo3ParamsPanel
                            aspectRatio={aspectRatio}
                            duration={duration}
                            resolution={resolution}
                            generateAudio={currentVideoData?.metadata?.generateAudio}
                            negativePrompt={currentVideoData?.metadata?.negativePrompt}
                            personGeneration={currentVideoData?.metadata?.personGeneration}
                            referenceImages={currentVideoData?.metadata?.referenceImages}
                            compressionQuality={currentVideoData?.metadata?.compressionQuality}
                            resizeMode={currentVideoData?.metadata?.resizeMode}
                            onAspectRatioChange={(value) => updateVideoNodeData(nodeId, { aspect_ratio: value })}
                            onDurationChange={(value) => updateVideoNodeData(nodeId, { duration: value })}
                            onResolutionChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        resolution: value,
                                    },
                                })
                            }}
                            onGenerateAudioChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        generateAudio: value,
                                    },
                                })
                            }}
                            onNegativePromptChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        negativePrompt: value,
                                    },
                                })
                            }}
                            onPersonGenerationChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        personGeneration: value,
                                    },
                                })
                            }}
                            onReferenceImagesChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        referenceImages: value,
                                    },
                                })
                            }}
                            onCompressionQualityChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        compressionQuality: value,
                                    },
                                })
                            }}
                            onResizeModeChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        resizeMode: value,
                                    },
                                })
                            }}
                        />
                    ) : model === 'kling-video-o1' ? (
                        <KlingVideoO1ParamsPanel
                            mode={currentVideoData?.metadata?.mode}
                            duration={currentVideoData?.duration}
                            aspectRatio={aspectRatio}
                            watermark={currentVideoData?.metadata?.watermark}
                            videoList={currentVideoData?.metadata?.video_list}
                            onModeChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        mode: value,
                                    },
                                })
                            }}
                            onDurationChange={(value) => updateVideoNodeData(nodeId, { duration: value })}
                            onAspectRatioChange={(value) => updateVideoNodeData(nodeId, { aspect_ratio: value })}
                            onWatermarkChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        watermark: value,
                                    },
                                })
                            }}
                            onVideoListChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        video_list: value,
                                    },
                                })
                            }}
                        />
                    ) : model === 'MiniMax-Hailuo-2.3' ? (
                        <MinimaxHailuo23ParamsPanel
                            duration={currentVideoData?.duration}
                            metadata={currentVideoData?.metadata}
                            onDurationChange={(value) => updateVideoNodeData(nodeId, { duration: value })}
                            onMetadataChange={(metadata) => {
                                updateVideoNodeData(nodeId, { metadata })
                            }}
                        />
                  ) : model === 'doubao-seedance-2.0' ? (
                    <Seedance20ParamsPanel
                      mode={(seedance20Metadata.mode as 'fast' | 'pro' | undefined) ?? 'fast'}
                      duration={currentVideoData?.duration}
                      aspectRatio={aspectRatio}
                      resolution={(seedance20Metadata.resolution as '480p' | '720p' | undefined) ?? '720p'}
                      generateAudio={seedance20Metadata.generate_audio}
                      onModeChange={(value) => {
                        const nextDuration = clampSeedance20Duration(currentVideoData?.duration ?? 8, value)
                        updateVideoNodeData(nodeId, {
                          duration: nextDuration,
                          metadata: {
                            ...seedance20Metadata,
                            mode: value,
                          },
                        })
                      }}
                      onDurationChange={(value) => {
                        const currentMode = (currentVideoData?.metadata?.mode ?? 'fast') as 'fast' | 'pro'
                        updateVideoNodeData(nodeId, {
                          duration: clampSeedance20Duration(value, currentMode),
                        })
                      }}
                      onAspectRatioChange={(value) => updateVideoNodeData(nodeId, { aspect_ratio: value })}
                      onResolutionChange={(value) => {
                        updateVideoNodeData(nodeId, {
                          metadata: {
                            ...seedance20Metadata,
                            resolution: value,
                          },
                        })
                      }}
                      onGenerateAudioChange={(value) => {
                        updateVideoNodeData(nodeId, {
                          metadata: {
                            ...seedance20Metadata,
                            generate_audio: value,
                          },
                        })
                      }}
                    />
                    ) : (
                        <Seedance15ProParamsPanel
                            aspectRatio={aspectRatio}
                            videoSize={videoSize}
                            duration={duration}
                            resolution={resolution}
                            seed={seed}
                            audio={audio}
                            camerafixed={camerafixed}
                            onAspectRatioChange={(value) => updateVideoNodeData(nodeId, { aspect_ratio: value })}
                            onVideoSizeChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        size: value,
                                    },
                                })
                            }}
                            onDurationChange={(value) => updateVideoNodeData(nodeId, { duration: value })}
                            onResolutionChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        resolution: value,
                                    },
                                })
                            }}
                            onSeedChange={(value) => {
                                updateVideoNodeData(nodeId, {
                                    metadata: {
                                        ...(currentVideoData?.metadata ?? {}),
                                        seed: value,
                                    },
                                })
                            }}
                            onAudioChange={(value) => updateVideoNodeData(nodeId, { audio: value })}
                            onCameraFixedChange={(value) => updateVideoNodeData(nodeId, { camerafixed: value })}
                        />
                    )}

                    <div className="ml-auto">
                        <Button
                            type="button"
                            variant="blue"
                            size="sm"
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
