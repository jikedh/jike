import { IconUpload } from '@tabler/icons-react'
import Mention from '@tiptap/extension-mention'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import { IMAGE_MODELS } from '@/constants/ai-models'
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
import type { ImageGenerationNode, NoteNodeData } from '@/types/flow'

import { COMMAND_MOCK, MENTION_MOCK } from './mock'
import { MidjourneyAdvancedPanel } from './components/MidjourneyAdvancedPanel'
import { MidjourneyParamsPanel } from './components/MidjourneyParamsPanel'
import { SeedreamParamsPanel } from './components/SeedreamParamsPanel'
import { GeminiParamsPanel } from './components/GeminiParamsPanel'

/**
 * 图片节点底部增强输入区
 * 职责：
 * - 上区：展示参考图列表（mock）
 * - 中区：基于 tiptap 的富文本输入（最小可用）
 *   - 支持 @ 引用 mock 建议
 *   - 支持 / 命令 mock 建议
 * - 下区：参数控制（比例、分辨率、模型、风格模板）
 *
 * 说明：
 * - 本期所有状态均本地 useState 管理，后续可替换为 store/api。
 */

// 图片生成数量选项
const IMAGE_COUNT_OPTIONS = [1, 2, 4] as const
type ImageCount = typeof IMAGE_COUNT_OPTIONS[number]

export const ImagePromptPanel = memo(({ nodeId }: { nodeId: string }) => {
    // 上传中态，避免重复上传触发
    const [isUploading, setIsUploading] = useState(false)
  // 图片生成数量选择
  const [imageCount, setImageCount] = useState<ImageCount>(1)
  // 正在生成的数量（用于显示进度提示）
  const [generatingCount, setGeneratingCount] = useState(0)

    const [mentionQuery, setMentionQuery] = useState('')
    const [commandQuery, setCommandQuery] = useState('')
    const [activeMode, setActiveMode] = useState<'mention' | 'command' | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)

    // 消息提示（成功/失败/警告）
    const { success, error, warning } = useMessage()

    // 画布数据：用于沿边查找父节点
    const nodes = useCanvasFlowStore((state) => state.nodes)
    const edges = useCanvasFlowStore((state) => state.edges)
    const startImageGeneration = useCanvasFlowStore((state) => state.startImageGeneration)
    const updateImageNodeData = useCanvasFlowStore((state) => state.updateImageNodeData)

    // 当前节点状态（用于禁用生成按钮）
    const currentNode = useMemo(() => {
        return nodes.find((node) => node.id === nodeId)
    }, [nodes, nodeId])

    const currentImageData = useMemo(() => {
        if (!currentNode || currentNode.type !== 'imageNode') {
            return null
        }

        return currentNode.data as ImageGenerationNode
    }, [currentNode])

  // 统一使用 size 字段存储宽高比/画面比例
    const size = currentImageData?.size ?? '1:1'
    const resolution = currentImageData?.resolution ?? '2K'
    const model = currentImageData?.model ?? 'doubao-seedream-5-0'
    const uploadedUrls = currentImageData?.uploadedUrls ?? []
  const imageUrls = currentImageData?.image_urls ?? []
    const promptDraftHtml = currentImageData?.promptDraftHtml ?? '<p></p>'

  // ========== 模型专属参数 ==========
  // 判断是否为 Midjourney 系列模型
  const isMidjourneyModel = model === 'midjourney' || model === 'midjourney-niji7'
  // 判断是否为 Seedream 5.0 模型
  const isSeedreamModel = model === 'doubao-seedream-5-0'
  // 判断是否为 Gemini 3 Pro 模型
  const isGeminiModel = model === 'gemini-3-pro-image-preview'

  // Midjourney 高级参数
  const midjourneyAdvanced = currentImageData?.midjourneyAdvanced ?? {
    referenceUrls: imageUrls,
    styleUrls: [],
    iw: 0.5,
    sw: 100,
  }

    const resetSuggestionState = () => {
        setActiveMode(null)
        setMentionQuery('')
        setCommandQuery('')
        setActiveIndex(0)
        triggerRangeRef.current = null
    }

    const getMentionLabel = (attrs: { id?: string; label?: string; value?: string }) => {
        return attrs.label || attrs.value || attrs.id || ''
    }

    const disableBuiltInSuggestion = {
        items: () => [],
        render: () => ({
            onStart: () => { },
            onUpdate: () => { },
            onKeyDown: () => false,
            onExit: () => { },
        }),
    }

    const mentionExtension = useMemo(() => {
        return Mention.configure({
            deleteTriggerWithBackspace: true,
            HTMLAttributes: {
                class: 'image-node-mention-pill',
            },
            renderText({ options, node }) {
                const mentionLabel = getMentionLabel(node.attrs)
                return `${options.suggestion.char}${mentionLabel}`
            },
            renderHTML({ options, node }) {
                const mentionLabel = getMentionLabel(node.attrs)
                return [
                    'span',
                    {
                        ...options.HTMLAttributes,
                        'data-mention-id': node.attrs.id,
                        'data-mention-value': node.attrs.value,
                        'data-mention-label': mentionLabel,
                        contenteditable: 'false',
                    },
                    `${options.suggestion.char}${mentionLabel}`,
                ]
            },
            // 这里禁用内建 suggestion UI，改为当前组件自己的下拉面板实现
            suggestion: {
                char: '@',
                ...disableBuiltInSuggestion,
            },
        })
    }, [])

    const slashCommandExtension = useMemo(() => {
        return Mention.extend({
            name: 'slashCommand',
        }).configure({
            deleteTriggerWithBackspace: true,
            HTMLAttributes: {
                class: 'image-node-slash-pill',
            },
            renderText({ options, node }) {
                const mentionLabel = getMentionLabel(node.attrs)
                return `${options.suggestion.char}${mentionLabel}`
            },
            renderHTML({ options, node }) {
                const mentionLabel = getMentionLabel(node.attrs)
                return [
                    'span',
                    {
                        ...options.HTMLAttributes,
                        'data-mention-id': node.attrs.id,
                        'data-mention-value': node.attrs.value,
                        'data-mention-label': mentionLabel,
                        contenteditable: 'false',
                    },
                    `${options.suggestion.char}${mentionLabel}`,
                ]
            },
            suggestion: {
                char: '/',
                ...disableBuiltInSuggestion,
            },
        })
    }, [])

    // 用于粗粒度识别当前触发词位置，便于替换 @xxx 或 /xxx
    const triggerRangeRef = useRef<{ from: number; to: number } | null>(null)
    // 上传按钮对应的隐藏 input
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const insertSuggestionNode = (
        mode: 'mention' | 'command',
        item: (typeof MENTION_MOCK)[number] | (typeof COMMAND_MOCK)[number],
    ) => {
        if (!triggerRangeRef.current) {
            return
        }

        if (mode === 'mention') {
            const selected = item as (typeof MENTION_MOCK)[number]
            editor
                ?.chain()
                .focus()
                .insertContentAt(triggerRangeRef.current, [
                    {
                        type: 'mention',
                        attrs: {
                            id: selected.id,
                            label: selected.label,
                            value: selected.value,
                        },
                    },
                    {
                        type: 'text',
                        text: ' ',
                    },
                ])
                .run()
            return
        }

        const selected = item as (typeof COMMAND_MOCK)[number]

        // 根据命令自动设置 size
        const commandSizeMap: Record<string, string> = {
          'c-1': '4:3',   // 角色参考图
          'c-2': '21:9',  // 角色三视图
        }
        const targetSize = commandSizeMap[selected.id]
        if (targetSize) {
          updateImageNodeData(nodeId, { size: targetSize })
        }

        // 只插入 description 作为文本，不再插入 slashCommand 节点显示 label
        editor
            ?.chain()
            .focus()
            .insertContentAt(triggerRangeRef.current, [
                {
                    type: 'text',
                    text: selected.description,
                },
            ])
            .run()
    }

    const filteredMentionItems = useMemo(() => {
        const q = mentionQuery.trim().toLowerCase()
        const all = [...MENTION_MOCK]
        if (!q) {
            return all
        }
        return all.filter((item) => {
            return (
                item.label.toLowerCase().includes(q) ||
                item.value.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q)
            )
        })
    }, [mentionQuery])

    const filteredCommandItems = useMemo(() => {
        const q = commandQuery.trim().toLowerCase()
        const all = [...COMMAND_MOCK]
        if (!q) {
            return all
        }
        return all.filter((item) => {
            return (
                item.label.toLowerCase().includes(q) ||
                item.command.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q)
            )
        })
    }, [commandQuery])

    // 沿着边找所有父节点，并合并其第一张图片作为参考图来源
    const parentImageUrls = useMemo(() => {
        const parentIds = edges
            .filter((edge) => edge.target === nodeId)
            .map((edge) => edge.source)

        if (parentIds.length === 0) {
            return [] as string[]
        }

        const urls: string[] = []

        parentIds.forEach((parentId) => {
            const parentNode = nodes.find((node) => node.id === parentId)
            if (!parentNode || parentNode.type !== 'imageNode') {
                return
            }

            const parentData = parentNode.data as ImageGenerationNode
            // 只取父节点的第一张图片 URL（result.data[0]）
            const firstItem = parentData.result?.data?.[0]
            if (firstItem?.url) {
                urls.push(firstItem.url)
            }
        })

        return urls
    }, [edges, nodes, nodeId])

    // 收集父级便签内容：按入边顺序去重后提取 content
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

    // 参考图列表：上传图片 + 父节点结果（不去重，默认顺序）
    const referenceImageUrls = useMemo(() => {
        return [...uploadedUrls, ...parentImageUrls]
    }, [uploadedUrls, parentImageUrls])

    // 是否正在生成（用于按钮禁用态）
    const isGenerating = useMemo(() => {
        if (!currentNode || currentNode.type !== 'imageNode') {
            return false
        }

        const status = currentNode.data.status
        return status === GenerationStatus.IN_PROGRESS || status === GenerationStatus.QUEUED
    }, [currentNode])

    // 触发上传选择
    const handleUploadClick = () => {
        if (isUploading) {
            return
        }
        fileInputRef.current?.click()
    }

    // 上传图片并回填到参考图列表
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

            updateImageNodeData(nodeId, {
                uploadedUrls: [...uploadedUrls, nextUrl],
            })
            success('上传成功')
        } catch (uploadError) {
            console.error('上传图片失败:', uploadError)
            error('上传失败，请重试')
        } finally {
            setIsUploading(false)
            event.target.value = ''
        }
    }

    const editor = useEditor({
        extensions: [StarterKit, mentionExtension, slashCommandExtension],
        content: promptDraftHtml,
        editorProps: {
            attributes: {
                class: cn(
                    'nodrag nopan nowheel min-h-[88px] max-h-[220px] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900/85 px-3 py-2 text-sm leading-6 text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                    'focus:outline-none',
                ),
            },
            handleKeyDown: (_view, event) => {
                const currentItems = activeMode === 'mention' ? filteredMentionItems : filteredCommandItems

                if (!activeMode || currentItems.length === 0) {
                    return false
                }

                if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActiveIndex((prev) => (prev + 1) % currentItems.length)
                    return true
                }

                if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActiveIndex((prev) => (prev - 1 + currentItems.length) % currentItems.length)
                    return true
                }

                if (event.key === 'Escape') {
                    event.preventDefault()
                    resetSuggestionState()
                    return true
                }

                if (event.key === 'Enter') {
                    event.preventDefault()
                    if (activeMode === 'mention') {
                        const selected = filteredMentionItems[activeIndex]
                        if (!selected) {
                            return true
                        }

                        insertSuggestionNode('mention', selected)
                    }

                    if (activeMode === 'command') {
                        const selected = filteredCommandItems[activeIndex]
                        if (!selected) {
                            return true
                        }

                        insertSuggestionNode('command', selected)
                    }

                    resetSuggestionState()
                    return true
                }

                return false
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            updateImageNodeData(nodeId, {
                promptDraft: currentEditor.getText(),
                promptDraftHtml: currentEditor.getHTML(),
            })

            const { from } = currentEditor.state.selection
            const plainText = currentEditor.state.doc.textBetween(0, from, '\n', '\0')
            const mentionMatch = plainText.match(/(^|\s)@([^\s@]*)$/)
            const commandMatch = plainText.match(/(^|\s)\/([^\s/]*)$/)

            if (mentionMatch) {
                setActiveMode('mention')
                setMentionQuery(mentionMatch[2] ?? '')
                setCommandQuery('')
                setActiveIndex(0)

                const triggerLength = `@${mentionMatch[2] ?? ''}`.length
                triggerRangeRef.current = {
                    from: Math.max(from - triggerLength, 0),
                    to: from,
                }
                return
            }

            if (commandMatch) {
                setActiveMode('command')
                setCommandQuery(commandMatch[2] ?? '')
                setMentionQuery('')
                setActiveIndex(0)

                const triggerLength = `/${commandMatch[2] ?? ''}`.length
                triggerRangeRef.current = {
                    from: Math.max(from - triggerLength, 0),
                    to: from,
                }
                return
            }

            resetSuggestionState()
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

    const suggestionItems = activeMode === 'mention' ? filteredMentionItems : filteredCommandItems

  // 点击生成：根据数量多次调用接口创建任务
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

      // 判断是否为 Midjourney Niji7 模型，如果是则在 prompt 最后拼接 --niji7 参数
      const isNiji7Model = model === 'midjourney-niji7'
      // 构建 Midjourney 模型的最终 prompt：添加 --ar 参数
      let finalPrompt = mergedPrompt
      if (isMidjourneyModel) {
        // Midjourney 模型：在 prompt 末尾拼接 --ar 尺寸参数
        finalPrompt = `${finalPrompt} --ar ${size}`
        // 如果是 Niji7 模型，还需要拼接 --niji 7
        if (isNiji7Model) {
          finalPrompt = `${finalPrompt} --niji 7`
        }
      }
      // 发送给后端的 model 字段：如果是 midjourney-niji7 则改为 midjourney
      const backendModel = isNiji7Model ? 'midjourney' : model

        // 构建请求 payload
        const buildPayload = (): any => {
          // 基础 payload
          const basePayload: any = {
            // 请求使用 backendModel（后端统一使用 midjourney，Niji7 效果通过 prompt 参数控制）
            model: backendModel,
            // 保留原始 model 用于 UI 状态同步
            originalModel: model,
            prompt: finalPrompt,
            resolution,
            n: 1,
            image_urls: referenceImageUrls,
            promptDraft: editor?.getText() ?? '',
            promptDraftHtml: editor?.getHTML() ?? '<p></p>',
            uploadedUrls,
            metadata: {},
          }

        // 根据不同模型添加专属参数
        if (isSeedreamModel) {
          // Seedream 5.0: size 作为宽高比
          basePayload.size = size
          basePayload.metadata = {
            resolution,
          }
        } else if (isGeminiModel) {
          // Gemini 3 Pro: size 作为画面比例
          basePayload.size = size
          basePayload.metadata = {
            resolution,
          }
        } else {
          // 其他模型（Midjourney 等）
          basePayload.size = size
          basePayload.aspectRatio = currentImageData?.aspectRatio ?? '1:1'
          basePayload.metadata = {
            resolution,
          }
          if (isMidjourneyModel) {
            basePayload.midjourneyAdvanced = midjourneyAdvanced
          }
        }

        return basePayload
      }

      // 显示总共需要生成的图片数量
      setGeneratingCount(imageCount)

      // 记录成功和失败的数量
      let successCount = 0
      let failCount = 0

      // 多次调用接口，每次只生成 1 张图片
      for (let i = 0; i < imageCount; i++) {
          try {
              await startImageGeneration(nodeId, buildPayload())
              successCount++
            } catch (generationError) {
          console.error(`第 ${i + 1} 张图片生成任务创建失败:`, generationError)
          failCount++
        }
      }

      // 重置进度显示
      setGeneratingCount(0)

      // 根据结果显示提示
      if (failCount === 0) {
        success(`已开始生成 ${successCount} 张图片`)
      } else if (successCount > 0) {
        warning(`已创建 ${successCount} 张图片，${failCount} 张创建失败`)
      } else {
            error('创建任务失败，请稍后再试')
        }
    }

    return (
      <div className="nodrag nopan nowheel w-170 rounded-3xl border border-neutral-700 bg-[linear-gradient(160deg,rgba(38,38,38,0.98)_0%,rgba(30,30,30,0.97)_58%,rgba(23,23,23,0.96)_100%)] p-3 shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur-md" >

            {/* 顶部区域：tiptap 增强输入区 */}
            <div className="relative mb-3 rounded-2xl border border-neutral-700 bg-neutral-800/80 p-2">

                <EditorContent editor={editor} />
                <div className="nodrag nopan nowheel flex gap-2 overflow-x-auto pb-1 mt-2.5">
                    {/* 上传按钮（固定为第一个） */}
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

                    {/* 隐藏 input，用于触发文件选择 */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {/* 参考图（上传 + 父节点结果） */}
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
                {/* 建议面板 */}
                {activeMode && suggestionItems.length > 0 && (
                    <div className="nodrag nopan nowheel absolute right-2 bottom-full left-2 z-30 mb-5 max-h-60 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
                        {suggestionItems.map((item, index) => {
                            const isActive = index === activeIndex
                            const title = item.label
                            const desc = item.description
                            const token = activeMode === 'mention' ? `@${item.value}` : item.command

                            return (
                                <Button
                                    key={item.id}
                                    unstyled
                                    className={cn(
                                        'flex w-full items-start justify-between gap-3 border-b border-neutral-800 px-3 py-2 text-left last:border-b-0',
                                        isActive ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-200 hover:bg-neutral-800',
                                    )}
                                    onMouseDown={(event) => {
                                        event.preventDefault()
                                        setActiveIndex(index)

                                        if (!triggerRangeRef.current) {
                                            return
                                        }

                                        if (activeMode === 'mention') {
                                            insertSuggestionNode('mention', item)
                                        } else {
                                            insertSuggestionNode('command', item)
                                        }

                                        resetSuggestionState()
                                    }}
                                >
                                    <div>
                                        <div className="text-xs font-medium">{title}</div>
                                        <div className="mt-0.5 text-[11px] text-neutral-400">{desc}</div>
                                    </div>
                                    <span className="rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                                        {token}
                                    </span>
                                </Button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* 下方区域：参数控制区 */}
            <div className="rounded-2xl border border-neutral-700 bg-neutral-800/80 p-2.5">
                <div className="flex items-center gap-2">
                    {/* 生成模型 - 始终在最左侧 */}
                    <Select
                        value={model}
                        onValueChange={(value) => {
                            updateImageNodeData(nodeId, { model: value })
                        }}
                    >
                        <SelectTrigger className="h-8 min-w-[160px] border-neutral-700 bg-neutral-900 text-xs text-neutral-100">
                            <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-800 border border-neutral-600">
                            {IMAGE_MODELS.map((item) => (
                                <SelectItem key={item.id} value={item.model} className="text-neutral-100 focus:bg-neutral-700 focus:text-neutral-100">
                                    {item.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* 根据模型动态渲染整合参数面板 */}
                    {isSeedreamModel && (
                        // Seedream 5.0 整合参数面板
                        <SeedreamParamsPanel
                            size={size}
                            resolution={resolution}
                            onSizeChange={(value) => updateImageNodeData(nodeId, { size: value })}
                            onResolutionChange={(value) => updateImageNodeData(nodeId, { resolution: value })}
                        />
                    )}
                    {isGeminiModel && (
                        // Gemini 3 Pro 整合参数面板
                        <GeminiParamsPanel
                            size={size}
                            resolution={resolution}
                            onSizeChange={(value) => updateImageNodeData(nodeId, { size: value })}
                            onResolutionChange={(value) => updateImageNodeData(nodeId, { resolution: value })}
                        />
                    )}

                    {/* Midjourney 整合参数面板 - 仅在选择 Midjourney 模型时显示 */}
                    {isMidjourneyModel && (
                        <MidjourneyParamsPanel
                            size={size}
                            onSizeChange={(value) => updateImageNodeData(nodeId, { size: value })}
                        />
                    )}

                    {/* Midjourney 高级选项 - 仅在选择 Midjourney 模型时显示 */}
                    {isMidjourneyModel && (
                        <MidjourneyAdvancedPanel
                            referenceImageUrls={referenceImageUrls}
                            value={midjourneyAdvanced}
                            onChange={(next) => {
                                updateImageNodeData(nodeId, {
                                    midjourneyAdvanced: {
                                        referenceUrls: next.referenceUrls ?? [],
                                        styleUrls: next.styleUrls ?? [],
                                        iw: next.iw ?? 0.5,
                                        sw: next.sw ?? 100,
                                    },
                                })
                            }}
                        />
                    )}

                    {/* 数量选择和生成按钮 */}
                    <div className="ml-auto flex items-center gap-2">
                    {/* 数量选择按钮 - Midjourney 模型隐藏 */}
                    {!isMidjourneyModel && (
                        <div className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-0.5">
                            {IMAGE_COUNT_OPTIONS.map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => setImageCount(count)}
                                    disabled={isGenerating}
                                    className={`nodrag nopan nowheel inline-flex h-7 min-w-8 items-center justify-center rounded-md px-1.5 text-xs font-medium transition-colors ${imageCount === count
                                            ? 'bg-blue-600 text-white'
                                            : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                                        } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title={`生成 ${count} 张图片`}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                    )}

              {/* 生成按钮 */}
                        <Button
                            type="button"
                            variant="blue"
                            size="sm"
                            loading={isGenerating}
                            onClick={handleGenerate}
                            disabled={isUploading}
                        >
                {isGenerating && generatingCount > 0
                  ? `生成中 (${generatingCount})`
                  : `生成 ${imageCount > 1 ? `×${imageCount}` : ''}`}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
})

ImagePromptPanel.displayName = 'ImagePromptPanel'
