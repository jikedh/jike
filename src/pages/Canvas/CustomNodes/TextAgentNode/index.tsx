import { Position, type NodeProps } from '@xyflow/react'
import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { 
  IconChevronDown, 
  IconRefresh, 
  IconCheck, 
  IconSparkles,
  IconBook,
  IconVideo,
  IconPhoto,
  IconUser,
  IconSend
} from '@tabler/icons-react'

import { ButtonHandle } from '@/components/button-handle'
import { Button } from '@/components/ui/button'
import { NodeContextMenu } from '@/pages/Canvas/components/NodeContextMenu'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { TextAgentNodeType, TextAgentPresetId } from '@/types/flow'
import { cn } from '@/lib/utils'
import { 
  TEXT_AGENT_PRESET_LIST, 
  TEXT_AGENT_MODELS, 
  getTextAgentPresetById,
  getTextAgentPresetLabelById 
} from '@/constants/text-agent-presets'
import { createChatCompletion } from '@/api/ai'
import { useMessage } from '@/hooks/useMessage'

const PRESET_ICONS: Record<TextAgentPresetId, React.ReactNode> = {
  'novel-to-script-agent': <IconBook size={18} />,
  'short-video-storyboard': <IconVideo size={18} />,
  'jimeng-prompt': <IconPhoto size={18} />,
  'novel-character-design': <IconUser size={18} />,
}

const areTextAgentNodePropsEqual = (prev: NodeProps<TextAgentNodeType>, next: NodeProps<TextAgentNodeType>) => {
  return (
    prev.id === next.id
    && prev.selected === next.selected
    && prev.data.model === next.data.model
    && prev.data.presetId === next.data.presetId
    && prev.data.useDefaultSystemPrompt === next.data.useDefaultSystemPrompt
    && prev.data.customSystemPrompt === next.data.customSystemPrompt
    && prev.data.status === next.data.status
  )
}

export const TextAgentNode = memo(({ id, data, selected }: NodeProps<TextAgentNodeType>) => {
  const handleVisibilityClass = selected
    ? 'visible opacity-100'
    : 'invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100'

  const [showPresetSelector, setShowPresetSelector] = useState(!data.presetId)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [currentModel, setCurrentModel] = useState(data.model || 'gemini-3.1-pro')
  const [editableSystemPrompt, setEditableSystemPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(data.status === 'generating')
  const abortControllerRef = useRef<AbortController | null>(null)

  const { warning, error, success } = useMessage()
  const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode)
  const deleteNode = useCanvasFlowStore((state) => state.deleteNode)
  const addNode = useCanvasFlowStore((state) => state.addNode)
  const onConnect = useCanvasFlowStore((state) => state.onConnect)
  const setNoteNodeEditing = useCanvasFlowStore((state) => state.setNoteNodeEditing)
  const updateTextAgentNodeData = useCanvasFlowStore((state) => state.updateTextAgentNodeData)
  const nodes = useCanvasFlowStore((state) => state.nodes)
  const edges = useCanvasFlowStore((state) => state.edges)

  const presetId = data.presetId
  const preset = presetId ? getTextAgentPresetById(presetId) : null

  useEffect(() => {
    if (preset) {
      setEditableSystemPrompt(preset.systemPrompt)
    }
  }, [preset])

  useEffect(() => {
    if (data.status === 'error' && isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsGenerating(false)
    }
  }, [data.status, isGenerating])

  const updateNodeData = useCallback((updates: Partial<TextAgentNodeType['data']>) => {
    updateTextAgentNodeData(id, updates)
  }, [id, updateTextAgentNodeData])

  const hasConnectedNote = useCallback(() => {
    const incomingEdges = edges.filter((edge) => edge.target === id)
    if (!incomingEdges.length) return false

    const parentNoteNode = incomingEdges
      .map((edge) => nodes.find((node) => node.id === edge.source))
      .find((node) => node?.type === 'noteNode')

    return !!parentNoteNode
  }, [id, nodes, edges])

  const handleSelectPreset = useCallback((newPresetId: TextAgentPresetId) => {
    updateNodeData({ presetId: newPresetId })
    setShowPresetSelector(false)

    if (hasConnectedNote()) {
      return
    }

    const currentNode = nodes.find((n) => n.id === id)
    if (!currentNode) return

    const inputNoteId = addNode('note', {
      x: currentNode.position.x - 280,
      y: currentNode.position.y,
    })
    setNoteNodeEditing(inputNoteId, true)

    setTimeout(() => {
      onConnect({
        source: inputNoteId,
        sourceHandle: 'output',
        target: id,
        targetHandle: 'input',
      })
    }, 100)
  }, [id, nodes, addNode, setNoteNodeEditing, onConnect, updateNodeData, hasConnectedNote])

  const getParentNoteContent = useCallback(() => {
    const incomingEdges = edges.filter((edge) => edge.target === id)
    if (!incomingEdges.length) {
      return { content: null, error: '需要连接一个便签节点作为输入' }
    }

    const parentNoteNode = incomingEdges
      .map((edge) => nodes.find((node) => node.id === edge.source))
      .find((node) => node?.type === 'noteNode')

    if (!parentNoteNode) {
      return { content: null, error: '输入节点必须是便签节点' }
    }

    const content = String(parentNoteNode.data?.content ?? '').trim()
    if (!content) {
      return { content: null, error: '输入便签内容为空' }
    }

    return { content, error: null }
  }, [id, nodes, edges])

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return

    const { content: inputContent, error: inputError } = getParentNoteContent()
    if (inputError || !inputContent) {
      warning(inputError || '未知错误')
      return
    }

    if (!presetId) {
      warning('请先选择智能体类型')
      return
    }

    const systemPrompt = editableSystemPrompt.trim()
    if (!systemPrompt) {
      warning('系统提示词不能为空')
      return
    }

    setIsGenerating(true)
    updateNodeData({ status: 'generating' })

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const requestBody = {
        model: currentModel,
        messages: [
          { 
            role: 'user', 
            content: `${inputContent}\n\n${systemPrompt}` 
          },
        ],
      }

      const response = await createChatCompletion(requestBody, abortController.signal)

      const resp = response as any
      
      // 检查 API 错误响应
      if (resp?.error) {
        const errorData = resp.error
        const errorMsg = typeof errorData?.message === 'string' 
          ? errorData.message 
          : (typeof errorData === 'string' ? errorData : JSON.stringify(errorData))
        error('生成失败', errorMsg)
        updateNodeData({ status: 'error', error: errorMsg })
        return
      }

      if (resp?.code && resp?.message) {
        const errorMsg = typeof resp.message === 'string' 
          ? resp.message 
          : JSON.stringify(resp.message)
        error('生成失败', errorMsg)
        updateNodeData({ status: 'error', error: errorMsg })
        return
      }

      // 提取 API 响应参数
      const choice = resp?.choices?.[0]
      const generatedContent = choice?.message?.content
      const finishReason = choice?.finish_reason
      const choiceIndex = choice?.index

      // 检查结束原因
      if (finishReason === 'content_filter') {
        error('生成失败', '内容被安全过滤器拦截')
        updateNodeData({ status: 'error', error: '内容被安全过滤器拦截' })
        return
      }

      if (finishReason === 'length') {
        warning('生成内容达到最大长度限制，可能不完整')
      }

      if (!generatedContent) {
        error('生成失败', '未获取到有效内容')
        updateNodeData({ status: 'error', error: '未获取到有效内容' })
        return
      }

      // 过滤掉模型的思考过程（<think...</think 标签内容）
      const cleanContent = generatedContent
        .replace(/<think[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking[\s\S]*?<\/thinking>/gi, '')
        .trim()

      if (!cleanContent) {
        error('生成失败', '未获取到有效内容')
        updateNodeData({ status: 'error', error: '未获取到有效内容' })
        return
      }

      const currentNode = nodes.find((n) => n.id === id)
      const nextPosition = currentNode
        ? {
          x: currentNode.position.x + 400,
          y: currentNode.position.y,
        }
        : undefined

      // 根据预设类型决定输出节点类型
      if (presetId === 'novel-character-design') {
        // 解析 Markdown 表格格式，转换为表格数据
        const parseMarkdownTable = (markdown: string) => {
          const characters: any[] = []
          
          // 匹配 Markdown 表格行
          const lines = markdown.split('\n')
          const tableRows: string[] = []
          let inTable = false
          
          for (const line of lines) {
            const trimmedLine = line.trim()
            // 检测表格行（以 | 开头和结尾）
            if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
              // 跳过分隔行（如 |---|---|）
              if (/^\|[\s\-:|]+\|$/.test(trimmedLine)) {
                continue
              }
              tableRows.push(trimmedLine)
              inTable = true
            } else if (inTable && trimmedLine === '') {
              // 空行结束表格
              break
            }
          }
          
          // 跳过表头行，从第二行开始解析数据
          for (let i = 1; i < tableRows.length; i++) {
            const row = tableRows[i]
            // 分割单元格
            const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
            
            if (cells.length >= 6) {
              characters.push({
                '姓名': cells[0],
                '基础设定': cells[1],
                '性格特征': cells[2],
                '核心动机': cells[3],
                '核心关系': cells[4],
                '习惯和兴趣': cells[5],
              })
            }
          }
          
          return characters
        }

        const tableRows = parseMarkdownTable(cleanContent)
        
        // 始终创建表格节点（即使没有解析到角色，也显示空表格）
        const outputTableId = addNode('table', nextPosition, {
          tableTitle: '角色设计表',
          tableRows: tableRows,
        })

        setTimeout(() => {
          onConnect({
            source: id,
            sourceHandle: 'output',
            target: outputTableId,
            targetHandle: 'input',
          })
        }, 100)
      } else {
        // 其他预设类型输出便签节点
        const calculateNoteSize = (content: string) => {
          const charCount = content.length
          const lineCount = content.split('\n').length
          const avgCharsPerLine = 40
          const estimatedLines = Math.max(lineCount, Math.ceil(charCount / avgCharsPerLine))
          const width = Math.min(Math.max(280, Math.min(500, charCount * 2)), 500)
          const height = Math.min(Math.max(180, estimatedLines * 24 + 40), 600)
          return { width, height }
        }

        const noteSize = calculateNoteSize(cleanContent)

        const outputNoteId = addNode('note', nextPosition, {
          initialWidth: noteSize.width,
          initialHeight: noteSize.height,
          initialContent: cleanContent,
        })
        setNoteNodeEditing(outputNoteId, false)

        setTimeout(() => {
          onConnect({
            source: id,
            sourceHandle: 'output',
            target: outputNoteId,
            targetHandle: 'input',
          })
        }, 100)
      }

      updateNodeData({ status: 'success' })
      success('生成成功')
    } catch (e: any) {
      const errorMsg = typeof e?.message === 'string' 
        ? e.message 
        : (typeof e === 'string' ? e : JSON.stringify(e))
      if (e?.name === 'AbortError') {
        return
      }
      error('生成失败', errorMsg)
      updateNodeData({ status: 'error', error: errorMsg })
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }, [
    isGenerating, presetId, editableSystemPrompt, currentModel, 
    getParentNoteContent, warning, error, success, nodes, id, 
    addNode, setNoteNodeEditing, onConnect, updateNodeData
  ])

  return (
    <NodeContextMenu onDuplicate={() => duplicateNode(id)} onDelete={() => deleteNode(id)}>
      <div className="group/node relative flex flex-col items-center">
        {showPresetSelector ? (
          <div className="w-[280px] bg-[#1a1a1c] border border-white/[0.08] rounded-xl p-5 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-sm text-white/50 mb-8">
              <IconSparkles size={16} className="text-[#B43FEB]" />
              <span>文本智能体</span>
            </div>
            
            <div className="flex justify-center mb-8 text-white/30">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M4 6h16M4 12h10M4 18h6" />
              </svg>
            </div>

            <div className="text-xs text-white/50 mb-3">选择智能体：</div>
            
            <div className="flex flex-col gap-1">
              {TEXT_AGENT_PRESET_LIST.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all hover:bg-white/[0.05]"
                >
                  <span className="text-white/40">
                    {PRESET_ICONS[p.id]}
                  </span>
                  <span className="text-sm text-white/80">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div 
              className={cn(
                "group/nodeBox relative w-[200px] h-[200px] bg-[#1a1a1c] rounded-xl flex items-center justify-center",
                selected
                  ? "border-2 border-[#B43FEB] shadow-[0_0_20px_rgba(180,63,235,0.4),inset_0_0_10px_rgba(180,63,235,0.1)]"
                  : "border border-white/[0.08] hover:border-white/[0.15]"
              )}
            >
              <ButtonHandle
                type="target"
                position={Position.Left}
                id="input"
                visible
                className={`transition-opacity duration-150 ${handleVisibilityClass}`}
              />

              <ButtonHandle
                type="source"
                position={Position.Right}
                id="output"
                visible
                className={`transition-opacity duration-150 ${handleVisibilityClass}`}
              />

              <button
                onClick={() => setShowPresetSelector(true)}
                className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#141416] px-3 py-1 text-xs text-white/40 transition-all hover:border-white/20 hover:text-white/60"
              >
                <IconRefresh size={12} />
                <span>切换文本智能体</span>
              </button>

              <div className="flex items-center gap-2 text-sm text-white/50">
                {isGenerating ? (
                  <>
                    <div className="relative w-5 h-5">
                      <div className="absolute inset-0 border-2 border-[#B43FEB]/30 rounded-full"></div>
                      <div className="absolute inset-0 border-2 border-transparent border-t-[#B43FEB] rounded-full animate-spin"></div>
                    </div>
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    {presetId && PRESET_ICONS[presetId]}
                    <span>{preset ? getTextAgentPresetLabelById(presetId) : '文本智能体'}</span>
                  </>
                )}
              </div>
            </div>

            {selected && (
              <div className="nodrag nopan nowheel absolute left-1/2 -translate-x-1/2 top-[216px] w-[500px] rounded-2xl border border-white/[0.05] bg-[#1e1e20] p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-2 duration-200 z-30">
                <div className="relative mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <textarea
                    value={editableSystemPrompt}
                    onChange={(e) => setEditableSystemPrompt(e.target.value)}
                    placeholder="系统提示词..."
                    className="nodrag nopan nowheel min-h-[120px] max-h-[300px] w-full overflow-y-auto bg-transparent text-sm leading-6 text-white/90 placeholder:text-white/30 resize-none outline-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <button
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/70 transition-colors hover:border-[#B43FEB]/30 hover:text-white/90 hover:bg-white/[0.04]"
                    >
                      <span>{TEXT_AGENT_MODELS.find(m => m.value === currentModel)?.label || currentModel}</span>
                      <IconChevronDown size={14} className={cn("transition-transform", showModelDropdown && "rotate-180")} />
                    </button>
                    {showModelDropdown && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-white/[0.06] bg-[#09090b] py-1 shadow-xl">
                        {TEXT_AGENT_MODELS.map((m) => (
                          <button
                            key={m.value}
                            onClick={() => {
                              setCurrentModel(m.value)
                              updateNodeData({ model: m.value })
                              setShowModelDropdown(false)
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-xs transition-colors",
                              currentModel === m.value 
                                ? "bg-[#B43FEB]/20 text-[#B43FEB]" 
                                : "text-white/60 hover:bg-white/5"
                            )}
                          >
                            <span>{m.label}</span>
                            {currentModel === m.value && <IconCheck size={14} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    disabled={isGenerating}
                    onClick={handleGenerate}
                    className={cn(
                      "gap-1.5 h-8 px-4 text-xs font-medium rounded-lg transition-colors active:scale-[0.97]",
                      isGenerating 
                        ? "bg-white/10 text-white/40 cursor-not-allowed"
                        : "bg-[#B43FEB] text-white hover:bg-[#B43FEB]/80"
                    )}
                  >
                    <IconSend size={14} />
                    {isGenerating ? '生成中...' : '生成'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </NodeContextMenu>
  )
}, areTextAgentNodePropsEqual)

TextAgentNode.displayName = 'TextAgentNode'
