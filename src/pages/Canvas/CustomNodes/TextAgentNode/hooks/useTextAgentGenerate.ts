/**
 * 文本智能体生成逻辑 hook
 * 处理生成流程、输入验证、输出节点创建等核心业务逻辑
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import { useMessage } from '@/hooks/useMessage'
import { createChatCompletion } from '@/api/ai'
import { getTextAgentPresetById } from '@/constants/text-agent-presets'
import { parseMarkdownTable, calculateNoteSize, filterThinkingContent } from '../utils'
import type { TextAgentPresetId } from '@/types/flow'
import type { TextAgentNodeType } from '@/types/flow'

interface UseTextAgentGenerateProps {
  id: string
  presetId: TextAgentPresetId | undefined
  editableSystemPrompt: string
  currentModel: string
  dataStatus?: string
}

export const useTextAgentGenerate = ({
  id,
  presetId,
  editableSystemPrompt,
  currentModel,
  dataStatus,
}: UseTextAgentGenerateProps) => {
  const [isGenerating, setIsGenerating] = useState(dataStatus === 'generating')
  const abortControllerRef = useRef<AbortController | null>(null)

  const { warning, error, success } = useMessage()
  const nodes = useCanvasFlowStore((state) => state.nodes)
  const edges = useCanvasFlowStore((state) => state.edges)
  const addNode = useCanvasFlowStore((state) => state.addNode)
  const onConnect = useCanvasFlowStore((state) => state.onConnect)
  const setNoteNodeEditing = useCanvasFlowStore((state) => state.setNoteNodeEditing)
  const updateTextAgentNodeData = useCanvasFlowStore((state) => state.updateTextAgentNodeData)

  // 同步 generating 状态
  useEffect(() => {
    setIsGenerating(dataStatus === 'generating')
  }, [dataStatus])

  // 错误时自动中止
  useEffect(() => {
    if (dataStatus === 'error' && isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsGenerating(false)
    }
  }, [dataStatus, isGenerating])

  // 更新节点数据的便捷方法
  const updateNodeData = useCallback((updates: Partial<TextAgentNodeType['data']>) => {
    updateTextAgentNodeData(id, updates)
  }, [id, updateTextAgentNodeData])

  // 获取父级便签节点的内容
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

  // 创建输出节点并连接
  const createOutputNode = useCallback((cleanContent: string) => {
    const currentNode = nodes.find((n) => n.id === id)
    const nextPosition = currentNode
      ? {
          x: currentNode.position.x + 400,
          y: currentNode.position.y,
        }
      : undefined

    if (presetId === 'novel-character-design') {
      // 角色设计预设 → 输出表格节点
      const tableRows = parseMarkdownTable(cleanContent)
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
      // 其他预设 → 输出便签节点
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
  }, [id, nodes, presetId, addNode, setNoteNodeEditing, onConnect])

  // 处理 API 错误响应
  const handleApiError = useCallback((resp: any): string | null => {
    // 错误格式 1: resp.error
    if (resp?.error) {
      const errorData = resp.error
      return typeof errorData?.message === 'string'
        ? errorData.message
        : (typeof errorData === 'string' ? errorData : JSON.stringify(errorData))
    }

    // 错误格式 2: resp.code && resp.message
    if (resp?.code && resp?.message) {
      return typeof resp.message === 'string'
        ? resp.message
        : JSON.stringify(resp.message)
    }

    return null
  }, [])

  // 核心生成方法
  const handleGenerate = useCallback(async () => {
    if (isGenerating) return

    // 1. 输入验证
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

    // 2. 开始生成
    setIsGenerating(true)
    updateNodeData({ status: 'generating' })

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      // 3. 调用 API
      const response = await createChatCompletion({
        model: currentModel,
        messages: [
          {
            role: 'user',
            content: `${inputContent}\n\n${systemPrompt}`,
          },
        ],
      }, abortController.signal)

      const resp = response as any

      // 4. 检查 API 错误
      const errorMsg = handleApiError(resp)
      if (errorMsg) {
        error('生成失败', errorMsg)
        updateNodeData({ status: 'error', error: errorMsg })
        return
      }

      // 5. 提取响应内容
      const choice = resp?.choices?.[0]
      const generatedContent = choice?.message?.content
      const finishReason = choice?.finish_reason

      // 6. 检查结束原因
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

      // 7. 过滤思考内容并验证
      const cleanContent = filterThinkingContent(generatedContent)
      if (!cleanContent) {
        error('生成失败', '未获取到有效内容')
        updateNodeData({ status: 'error', error: '未获取到有效内容' })
        return
      }

      // 8. 创建输出节点
      createOutputNode(cleanContent)

      // 9. 完成
      updateNodeData({ status: 'success' })
      success('生成成功')
    } catch (e: any) {
      // AbortError 是用户主动取消，不显示错误
      if (e?.name === 'AbortError') {
        return
      }

      const errorMsg = typeof e?.message === 'string'
        ? e.message
        : (typeof e === 'string' ? e : JSON.stringify(e))
      error('生成失败', errorMsg)
      updateNodeData({ status: 'error', error: errorMsg })
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }, [
    isGenerating, presetId, editableSystemPrompt, currentModel,
    getParentNoteContent, warning, error, success,
    updateNodeData, handleApiError, createOutputNode
  ])

  // 中止生成
  const abortGenerate = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  return {
    isGenerating,
    handleGenerate,
    abortGenerate,
  }
}
