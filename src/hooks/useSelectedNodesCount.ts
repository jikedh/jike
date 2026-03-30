import { useStore } from '@xyflow/react'

/**
 * 获取当前选中节点数量的优化 Hook
 *
 * 性能优化说明：
 * - 原来每个节点组件内部都使用 useStore((state) => state.nodes.filter(n => n.selected).length)
 *   这会在每次 nodes 数组变化时（包括拖拽移动）触发所有节点的重渲染
 * - 通过 useStore 的 equalityFn 参数，仅在选中数量真正变化时才触发重渲染
 */
export const useSelectedNodesCount = () => {
  return useStore(
    (state) => {
      let count = 0
      for (const node of state.nodes) {
        if (node.selected) count++
      }
      return count
    },
    // 使用严格相等比较，只有数量变化时才触发重渲染
    (a, b) => a === b
  )
}
