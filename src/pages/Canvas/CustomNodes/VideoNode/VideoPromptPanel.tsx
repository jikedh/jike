import { EditorContent, useEditor, ReactRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { IconUpload, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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
import { cn, toChineseNumber, getMentionLabel, updateSuggestionPosition, getVideoThumbnail } from '@/lib/utils'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { NoteNodeData, VideoGenerationNode, ImageGenerationNode, AudioGenerationNode } from '@/types/flow'
import { VideoMentionList } from './VideoMentionList'

import { Seedance15ProParamsPanel } from './components/Seedance15ProParamsPanel'
import { GrokVideoParamsPanel } from './components/GrokVideoParamsPanel'
import { Veo3ParamsPanel } from './components/Veo3ParamsPanel'
import { KlingVideoO1ParamsPanel } from './components/KlingVideoO1ParamsPanel'
import { MinimaxHailuo23ParamsPanel } from './components/MinimaxHailuo23ParamsPanel'
import { Seedance20ParamsPanel } from './components/Seedance20ParamsPanel'
import { PROMPT_PANEL_STYLES } from '../shared/promptPanelStyles'
import { getVideoPayloadStrategy } from './strategies/videoPayloadStrategies'

const VideoThumbnailButton = ({ videoUrl }: { videoUrl: string }) => {
    const [thumbnail, setThumbnail] = useState<string | null>(null)

    useEffect(() => {
        getVideoThumbnail(videoUrl)
            .then(setThumbnail)
            .catch(() => {})
    }, [videoUrl])

    if (thumbnail) {
        return (
            <img
                src={thumbnail}
                alt="视频"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
            />
        )
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-[#B43FEB]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span>视频</span>
        </div>
    )
}

const ReferenceItemWrapper = ({ 
    children, 
    onDisconnect,
    className 
}: { 
    children: React.ReactNode
    onDisconnect?: () => void
    className?: string
}) => {
    return (
        <div className={cn(PROMPT_PANEL_STYLES.referenceImageButton, 'group relative', className)}>
            {children}
            {onDisconnect && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onDisconnect()
                    }}
                    className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-neutral-800 text-neutral-400 opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100 flex items-center justify-center"
                    title="断开连接"
                >
                    <IconX size={10} />
                </button>
            )}
        </div>
    )
}

export const VideoPromptPanel = ({ nodeId }: { nodeId: string }) => {
    const [isUploading, setIsUploading] = useState(false)

    const { success, error, warning } = useMessage()

    const nodes = useCanvasFlowStore((state) => state.nodes)
    const edges = useCanvasFlowStore((state) => state.edges)
    const startVideoGeneration = useCanvasFlowStore((state) => state.startVideoGeneration)
    const updateVideoNodeData = useCanvasFlowStore((state) => state.updateVideoNodeData)
    const deleteEdge = useCanvasFlowStore((state) => state.deleteEdge)

    const handleDisconnectNode = useCallback((sourceNodeId: string) => {
        const edgeToDelete = edges.find(
            (edge) => edge.source === sourceNodeId && edge.target === nodeId
        )
        if (edgeToDelete) {
            deleteEdge(edgeToDelete.id)
        }
    }, [edges, nodeId, deleteEdge])

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

    // 获取上游连接的视频节点
    const parentVideoNodes = useMemo(() => {
      const parentIds = edges
        .filter((edge) => edge.target === nodeId)
        .map((edge) => edge.source)

      return parentIds
        .map((parentId) => nodes.find((node) => node.id === parentId))
        .filter((node) => node?.type === 'videoNode')
        .map((node) => ({
          id: node.id,
          url: (node.data as VideoGenerationNode).result?.data?.[0]?.url,
        }))
        .filter((item) => item.url)
    }, [edges, nodeId, nodes])

    // 获取上游连接的音频节点
    const parentAudioNodes = useMemo(() => {
      const parentIds = edges
        .filter((edge) => edge.target === nodeId)
        .map((edge) => edge.source)

      return parentIds
        .map((parentId) => nodes.find((node) => node.id === parentId))
        .filter((node) => node?.type === 'audioNode')
        .map((node) => ({
          id: node.id,
          url: (node.data as AudioGenerationNode).result?.data?.[0]?.url,
        }))
        .filter((item) => item.url)
    }, [edges, nodeId, nodes])

    // 获取上游连接的图片节点
    const parentImageNodes = useMemo(() => {
      const parentIds = edges
        .filter((edge) => edge.target === nodeId)
        .map((edge) => edge.source)

      return parentIds
        .map((parentId) => nodes.find((node) => node.id === parentId))
        .filter((node) => node?.type === 'imageNode')
        .map((node) => ({
          id: node.id,
          url: (node.data as ImageGenerationNode).result?.data?.[0]?.url,
        }))
        .filter((item) => item.url)
    }, [edges, nodeId, nodes])

  // 将所有资源转换成提及候选项
  const videoMentionItems = useMemo(() => {
    const items: { id: string; label: string; value: string; thumbnail: string; type: 'image' | 'video' | 'audio' }[] = []

    // 添加图片（来自上传）
    referenceImageUrls.forEach((url, index) => {
      items.push({
        id: `video-image-${index}`,
        label: `图片${toChineseNumber(index + 1)}`,
        value: `图片${toChineseNumber(index + 1)}`,
        thumbnail: url,
        type: 'image',
      })
    })

    // 添加上游图片节点
    parentImageNodes.forEach((item, index) => {
      items.push({
        id: `parent-image-${item.id}`,
        label: `图片节点${toChineseNumber(index + 1)}`,
        value: `图片节点${toChineseNumber(index + 1)}`,
        thumbnail: item.url!,
        type: 'image',
      })
    })

    // 添加上游视频节点（仅 Seedance 2.0 模型支持 @视频）
    if (model === 'doubao-seedance-2.0') {
      parentVideoNodes.forEach((item, index) => {
        items.push({
          id: `parent-video-${item.id}`,
          label: `视频${toChineseNumber(index + 1)}`,
          value: `视频${toChineseNumber(index + 1)}`,
          thumbnail: item.url!,
          type: 'video',
        })
      })
    }

    // 添加上游音频节点（仅 Seedance 2.0 模型支持 @音频）
    if (model === 'doubao-seedance-2.0') {
      parentAudioNodes.forEach((item, index) => {
        items.push({
          id: `parent-audio-${item.id}`,
          label: `音频${toChineseNumber(index + 1)}`,
          value: `音频${toChineseNumber(index + 1)}`,
          thumbnail: '/audio-icon.svg',
          type: 'audio',
        })
      })
    }

    return items
  }, [referenceImageUrls, parentImageNodes, parentVideoNodes, parentAudioNodes, model])

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

  // 使用原生 Suggestion API，配合 Floating UI 实现动态定位
  const mentionExtension = useMemo(() => {
    return Mention.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          thumbnail: {
            default: null,
            parseHTML: element => element.getAttribute('data-thumbnail'),
            renderHTML: attributes => {
              if (!attributes.thumbnail) {
                return {}
              }
              return {
                'data-thumbnail': attributes.thumbnail,
              }
            },
          },
          type: {
            default: 'image',
            parseHTML: element => element.getAttribute('data-type') || 'image',
            renderHTML: attributes => {
              return {
                'data-type': attributes.type || 'image',
              }
            },
          },
        }
      },
      draggable: true,
    }).configure({
      deleteTriggerWithBackspace: true,
      HTMLAttributes: {
        class: 'video-node-mention-pill',
        draggable: 'true',
      },
      renderText({ node }) {
        return getMentionLabel(node.attrs)
      },
      renderHTML({ options, node }) {
        const mentionLabel = getMentionLabel(node.attrs)
        const thumbnail = node.attrs.thumbnail as string | undefined
        const mentionType = node.attrs.type as 'image' | 'video' | 'audio' | undefined

        const children: any[] = []

        if (mentionType === 'audio') {
          children.push([
            'span',
            {
              class: 'video-node-mention-pill__audio-icon',
            },
            '🎵',
          ])
        } else if (thumbnail) {
          children.push([
            'img',
            {
              class: 'video-node-mention-pill__thumbnail',
              src: thumbnail,
              alt: mentionLabel,
              draggable: 'false',
            },
          ])
        }

        children.push(['span', { class: 'video-node-mention-pill__label' }, mentionLabel])

        return [
          'span',
          {
            ...options.HTMLAttributes,
            'data-mention-id': node.attrs.id,
            'data-mention-value': node.attrs.value,
            'data-mention-label': mentionLabel,
            'data-type': mentionType || 'image',
            contenteditable: 'false',
            draggable: 'true',
          },
          ...children,
        ]
      },
      // 使用原生 Suggestion API
      suggestion: {
        char: '@',
        // 返回候选项列表（不进行过滤，始终返回全量）
        items: () => {
          return videoMentionItems
        },
        // 渲染下拉列表
        render: () => {
          let component: ReactRenderer | null = null
          let keyboardHandler: ((event: KeyboardEvent) => void) | null = null
          let editorDom: HTMLElement | null = null

          return {
            onStart: (props) => {
              if (!props.clientRect) {
                return
              }

              // 保存 editor dom 引用用于清理
              editorDom = props.editor.view.dom

              // 使用 ReactRenderer 创建 React 组件
              component = new ReactRenderer(VideoMentionList, {
                props,
                editor: props.editor,
              })

              // 设置初始样式
              component.element.style.position = 'absolute'
              component.element.style.zIndex = '9999'

              // 添加到 body（避免父容器 overflow 影响）
              document.body.appendChild(component.element)

              // 更新位置
              updateSuggestionPosition(props.editor, component.element)

              // 绑定键盘事件：上下键导航、Enter 选中
              keyboardHandler = (event: KeyboardEvent) => {
                // 类型断言：ReactRenderer.ref 实际上是通过 forwardRef 暴露的 VideoMentionList 实例
                const handled = (component?.ref as { onKeyDown?: (props: { event: KeyboardEvent }) => boolean })?.onKeyDown?.({ event })
                // 如果键盘事件被处理，阻止默认行为和冒泡
                if (handled) {
                  event.preventDefault()
                  event.stopPropagation()
                }
              }
              editorDom.addEventListener('keydown', keyboardHandler, { capture: true })
            },

            onUpdate: (props) => {
              if (!props.clientRect) {
                return
              }

              // 更新 props
              component?.updateProps(props)

              // 更新位置
              updateSuggestionPosition(props.editor, component!.element)
            },

            onExit: () => {
              // 清理键盘事件监听（从正确的 DOM 元素移除）
              if (keyboardHandler && editorDom) {
                editorDom.removeEventListener('keydown', keyboardHandler, { capture: true })
                keyboardHandler = null
                editorDom = null
              }
              component?.destroy()
              component = null
            },
          }
        },
      },
    })
  }, [videoMentionItems])

  // 处理选择候选项
  const handleSelectSuggestion = (item: (typeof videoMentionItems)[number]) => {
    editor
      ?.chain()
      .focus()
      .insertContent([
        {
          type: 'mention',
          attrs: {
            id: item.id,
            label: item.label,
            value: item.value,
            thumbnail: item.thumbnail,
            type: item.type,
          },
        },
        {
          type: 'text',
          text: ' ',
        },
      ])
      .run()
  }

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
      extensions: [
        StarterKit.configure({
          dropcursor: {
            class: 'ProseMirror-dropcursor',
            color: '#B43FEB',
            width: 2,
          },
        }),
        mentionExtension,
      ],
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

  useEffect(() => {
    if (!editor) return

    const editorDom = editor.view.dom

    const handleDragStart = (event: DragEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const mentionPill = target.closest('.video-node-mention-pill')
      if (mentionPill) {
        mentionPill.classList.add('dragging')
        event.dataTransfer?.setData('text/plain', mentionPill.getAttribute('data-mention-id') || '')
      }
    }

    const handleDragEnd = (event: DragEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const mentionPill = target.closest('.video-node-mention-pill')
      if (mentionPill) {
        mentionPill.classList.remove('dragging')
      }
      editorDom.querySelectorAll('.video-node-mention-pill.dragging').forEach((el) => {
        el.classList.remove('dragging')
      })
    }

    editorDom.addEventListener('dragstart', handleDragStart)
    editorDom.addEventListener('dragend', handleDragEnd)

    return () => {
      editorDom.removeEventListener('dragstart', handleDragStart)
      editorDom.removeEventListener('dragend', handleDragEnd)
    }
  }, [editor])

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


            await startVideoGeneration(nodeId, payload)
            success('已开始生成视频')

    }

    return (
      <div className={PROMPT_PANEL_STYLES.container} style={{ pointerEvents: 'auto' }} >
        <div className={PROMPT_PANEL_STYLES.inputArea}>
                <EditorContent editor={editor} />

                <div className="nodrag nopan nowheel mt-2.5 flex gap-2 overflow-x-auto pb-1">
                    <Button
                        unstyled
                        className={PROMPT_PANEL_STYLES.uploadButton}
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
                        <ReferenceItemWrapper key={`${url}-${index}`}>
                            <img
                                src={url}
                                alt="参考图"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                loading="lazy"
                            />
                        </ReferenceItemWrapper>
                    ))}

                    {parentImageNodes.map((item, index) => (
                        <ReferenceItemWrapper 
                            key={`image-${item.id}-${index}`}
                            onDisconnect={() => handleDisconnectNode(item.id)}
                        >
                            <img
                                src={item.url!}
                                alt="参考图"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                loading="lazy"
                            />
                        </ReferenceItemWrapper>
                    ))}

                    {parentAudioNodes.map((item, index) => (
                        <ReferenceItemWrapper 
                            key={`audio-${item.id}-${index}`}
                            className="bg-[#B43FEB]/20 border-[#B43FEB]/40"
                            onDisconnect={() => handleDisconnectNode(item.id)}
                        >
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-[#B43FEB]">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                                <span>音频</span>
                            </div>
                        </ReferenceItemWrapper>
                    ))}

                    {parentVideoNodes.map((item, index) => (
                        <ReferenceItemWrapper 
                            key={`video-${item.id}-${index}`}
                            className="overflow-hidden"
                            onDisconnect={() => handleDisconnectNode(item.id)}
                        >
                            <VideoThumbnailButton videoUrl={item.url!} />
                        </ReferenceItemWrapper>
                    ))}
                </div>
            </div>

            {/* 下方区域：参数控制区 */}
            <div className={PROMPT_PANEL_STYLES.controlArea}>
                <div className="flex items-center gap-2">
                    {/* 生成模型 */}
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
