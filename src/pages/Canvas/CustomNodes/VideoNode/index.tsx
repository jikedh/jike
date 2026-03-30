import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'

import { ButtonHandle } from '@/components/button-handle'
import { NodeContextMenu } from '@/pages/Canvas/components/NodeContextMenu'
import { useNodeScale } from '@/hooks/useNodeScale'
import { useSelectedNodesCount } from '@/hooks/useSelectedNodesCount'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { VideoNodeType } from '@/types/flow'

import { VideoContent } from './VideoContent'
import { VideoPromptPanel } from './VideoPromptPanel'
import { VideoToolbar } from './VideoToolbar'

/**
 * 视频节点组件
 * 职责：
 * - 不支持拖拽调整尺寸，使用内容驱动与样式约束
 * - 提供左右 Handle 用于流程连接
 * - 展示视频内容、生成状态与进度
 * - 提供工具栏操作（复制、删除、重新生成）
 */
export const VideoNode = memo(({
    id,
    data,
    selected,
    dragging
}: NodeProps<VideoNodeType>) => {
    const isDragging = Boolean(dragging)
    const { zoom } = useNodeScale()
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode)
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode)
    // 获取选中节点数量，框选多节点时不显示工具栏（使用优化后的 Hook）
    const selectedNodesCount = useSelectedNodesCount()
    const handleVisibilityClass = selected
        ? 'visible opacity-100'
        : 'invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100'
    // 单选且未拖拽时显示工具栏
    const shouldShowToolbar = selected && !isDragging && selectedNodesCount <= 1

    // console.log('视频节点重新渲染', id)

    return (
        <NodeContextMenu onDuplicate={() => duplicateNode(id)} onDelete={() => deleteNode(id)}>
        <div className="group/node relative">
            {/* 左侧输入 Handle */}
            <ButtonHandle
                type="target"
                position={Position.Left}
                id="input"
                visible
                className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />

            {/* 右侧输出 Handle */}
            <ButtonHandle
                type="source"
                position={Position.Right}
                id="output"
                visible
                className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />

            {/* 顶部工具栏：随视口缩放同步变化 */}
          <NodeToolbar isVisible={shouldShowToolbar} position={Position.Top} offset={10 * zoom}>
                    <VideoToolbar
                        data={data}
                        selected={selected}
                        onDuplicate={() => duplicateNode(id)}
                        onDelete={() => deleteNode(id)}
            />
            </NodeToolbar>

            {/* 底部增强输入区：随视口缩放同步变化 */}
            <NodeToolbar
                isVisible={shouldShowToolbar}
                position={Position.Bottom}
                offset={18 * zoom}
          >
            <VideoPromptPanel nodeId={id} />
            </NodeToolbar>

            <div
                className="relative flex w-87.5 min-h-62.5 flex-col gap-2 rounded-xl border bg-card  shadow-sm transition-transform duration-200 ease-in-out"
            >
                {/* 视频内容区：与图片节点一致的比例容器，保证展示区域尺寸标准化 */}
                <div className="relative flex w-full min-h-62.5 aspect-7/5 overflow-hidden rounded-md bg-muted/10">
                    <VideoContent data={data} />
                </div>
            </div>
        </div>
        </NodeContextMenu>
    )
})

VideoNode.displayName = 'VideoNode'
