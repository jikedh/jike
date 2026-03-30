import { NodeToolbar, Position, type NodeProps, useStore } from '@xyflow/react'
import { memo } from 'react'

import { ButtonHandle } from '@/components/button-handle'
import { NodeContextMenu } from '@/pages/Canvas/components/NodeContextMenu'
import { useNodeScale } from '@/hooks/useNodeScale'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { ImageNodeType } from '@/types/flow'

import { ImageContent } from './ImageContent'
import { ImagePromptPanel } from './ImagePromptPanel'
import { ImageToolbar } from './ImageToolbar'

/**
 * 图片节点组件
 * 职责：
 * - 不支持拖拽调整尺寸，使用内容驱动与样式约束
 * - 提供左右 Handle 用于流程连接
 * - 展示图片内容、生成状态与进度
 * - 提供工具栏操作（复制、删除、重新生成）
 */
export const ImageNode = memo(({
    id,
    data,
    selected,
    dragging
}: NodeProps<ImageNodeType>) => {
    const isDragging = Boolean(dragging)
    const { zoom } = useNodeScale()
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode)
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode)
    const splitImage = useCanvasFlowStore((state) => state.splitImage)
    // 获取选中节点数量，框选多节点时不显示工具栏
    const selectedNodesCount = useStore((state) => state.nodes.filter((n) => n.selected).length)
    const handleVisibilityClass = selected
        ? 'visible opacity-100'
        : 'invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100'
    // 单选且未拖拽时显示工具栏
    const shouldShowToolbar = selected && !isDragging && selectedNodesCount <= 1

    // console.log('图片节点重新渲染', id)

    return (
        <NodeContextMenu
            onDuplicate={() => duplicateNode(id)}
            onDelete={() => deleteNode(id)}
            onSplitImage={(gridSize) => splitImage(id, gridSize)}
        >
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
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'bottom center' }}>
                    <ImageToolbar
                        nodeId={id}
                        data={data}
                        selected={selected}
                        onDuplicate={() => duplicateNode(id)}
                        onDelete={() => deleteNode(id)}
                    />
                </div>
            </NodeToolbar>

            {/* 底部增强输入区：随视口缩放同步变化 */}
            <NodeToolbar
                isVisible={shouldShowToolbar}
                position={Position.Bottom}
                offset={18 * zoom}
            >
                <div className="nodrag nopan nowheel" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                    <ImagePromptPanel nodeId={id} />
                </div>
            </NodeToolbar>

            <div
                className="relative flex w-87.5 min-h-62.5 flex-col gap-2 rounded-xl border bg-card  shadow-sm transition-transform duration-200 ease-in-out"
            >
                {/* 图片内容区：提供明确高度基准，避免 h-full + absolute 链路在自适应场景下塌陷 */}
                <div className="relative flex w-full min-h-62.5 aspect-7/5 overflow-hidden rounded-md bg-muted/10">
                    <ImageContent data={data} />
                </div>
            </div>
        </div>
        </NodeContextMenu>
    )
})

ImageNode.displayName = 'ImageNode'
