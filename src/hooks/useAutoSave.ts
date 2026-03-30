import { useEffect, useRef } from 'react'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import { useChatSettingsStore } from '@/store/chatSettingsStore'

/**
 * 自动保存 Hook（防抖版）
 *
 * 性能优化说明：
 * - 原来每次 nodes/edges 变化都会立即调用 saveGraph()，
 *   在拖拽节点时每帧都会触发 localStorage 写入，造成严重性能瓶颈
 * - 改为防抖保存：变化后等待一段时间再保存，拖拽期间不会频繁写入
 *
 * @param debounceMs 防抖延迟（毫秒），默认 1000ms
 */
export const useAutoSave = (debounceMs = 1000) => {
  const nodes = useCanvasFlowStore((state) => state.nodes)
  const edges = useCanvasFlowStore((state) => state.edges)
  const hydrated = useCanvasFlowStore((state) => state.hydrated)
  const projectId = useCanvasFlowStore((state) => state.projectId)
  const saveGraph = useCanvasFlowStore((state) => state.saveGraph)
  const autoSaveEnabled = useChatSettingsStore((state) => state.autoSaveEnabled)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 跳过首次渲染（hydrate 恢复数据时不需要保存）
  const isFirstRender = useRef(true)

  useEffect(() => {
    // 未启用自动保存或未完成数据恢复时跳过
    if (!autoSaveEnabled || !hydrated || !projectId) {
      return
    }

    // 跳过首次渲染
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // 清除上一次的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // 设置新的防抖定时器
    timerRef.current = setTimeout(() => {
      saveGraph()
    }, debounceMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [nodes, edges, autoSaveEnabled, hydrated, projectId, saveGraph, debounceMs])

  // 组件卸载时立即保存（防止数据丢失）
  useEffect(() => {
    return () => {
      if (autoSaveEnabled && hydrated && projectId) {
        saveGraph()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
