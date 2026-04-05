import { NodeToolbar, Position, type NodeProps, useStore } from '@xyflow/react'
import { memo, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { ButtonHandle } from '@/components/button-handle'
import { NodeContextMenu } from '@/pages/Canvas/components/NodeContextMenu'
import { PanoramaViewer } from '@/components/panorama/PanoramaViewer'
import { useNodeScale } from '@/hooks/useNodeScale'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import { uploadFileToOSS } from '@/utils/oss'
import { GenerationStatus } from '@/constants/enum'
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
 * - 支持点击图片重新排序（将点击的图片移到首位）
 * - 支持查看全景图功能
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
    const addNode = useCanvasFlowStore((state) => state.addNode)
    const splitImage = useCanvasFlowStore((state) => state.splitImage)
    const updateImageNodeData = useCanvasFlowStore((state) => state.updateImageNodeData)
    const onConnect = useCanvasFlowStore((state) => state.onConnect)

    // 全景图查看器状态
    const panoramaViewer = useCanvasFlowStore((state) => state.panoramaViewer)
    const closePanoramaViewer = useCanvasFlowStore((state) => state.closePanoramaViewer)

    // 使用 useStore 的 selector 精确订阅选中节点数量，避免订阅整个 nodes 数组
    const selectedNodesCount = useStore((state) => {
        let count = 0
        for (const node of state.nodes) {
            if (node.selected) count++
        }
        return count
    })

    // 使用 useMemo 缓存样式类名，避免每次渲染都重新拼接字符串
    const handleVisibilityClass = useMemo(() =>
        selected
            ? 'visible opacity-100'
            : 'invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100',
        [selected]
    )

    // 使用 useMemo 缓存工具栏显示条件，避免每次渲染都重新计算
    const shouldShowToolbar = useMemo(() =>
        selected && !isDragging && selectedNodesCount <= 1,
        [selected, isDragging, selectedNodesCount]
    )

    // 缓存传递给 ImageToolbar 的回调函数，避免 zoom 变化时触发子组件重新渲染
    const handleDuplicate = useCallback(() => {
        duplicateNode(id)
    }, [duplicateNode, id])

    const handleDelete = useCallback(() => {
        deleteNode(id)
    }, [deleteNode, id])

    // 缓存传递给 NodeContextMenu 的回调函数
    const handleContextMenuDuplicate = useCallback(() => {
        duplicateNode(id)
    }, [duplicateNode, id])

    const handleContextMenuDelete = useCallback(() => {
        deleteNode(id)
    }, [deleteNode, id])

    const handleContextMenuSplitImage = useCallback((gridSize: number) => {
        splitImage(id, gridSize)
    }, [splitImage, id])

    // 裁剪完成后：上传裁剪文件、创建子节点，并把裁剪结果挂到新节点上
    const handleCrop = useCallback(async (file: File) => {
        try {
            const sourceNode = useCanvasFlowStore.getState().nodes.find((node) => node.id === id)
            if (!sourceNode || sourceNode.type !== 'imageNode') {
                throw new Error('当前图片节点不存在')
            }

            const uploadResult = await uploadFileToOSS(file)
            if (!uploadResult.url) {
                throw new Error('裁剪图片上传失败')
            }

            const childPosition = {
                x: sourceNode.position.x + (sourceNode.width ?? 350) + 80,
                y: sourceNode.position.y,
            }

            const childId = addNode('image', childPosition)

            // 先建立父子连边，方便后续工作流继续沿用图结构。
            onConnect({
                source: id,
                target: childId,
                sourceHandle: 'output',
                targetHandle: 'input',
            })

            // 再把裁剪后的图片写入子节点，让子节点本身就具备可展示的结果。
            updateImageNodeData(childId, {
                image_urls: [uploadResult.url],
                result: {
                    type: 'image',
                    data: [{ url: uploadResult.url }],
                },
                status: GenerationStatus.COMPLETED,
                progress: 100,
            })

            toast.success('裁剪成功')
        } catch (error: any) {
            console.error('裁剪图片失败:', error)
            toast.error(error?.message || '裁剪失败，请重试')
            throw error
        }
    }, [addNode, id, onConnect, updateImageNodeData])

    // 点击图片重新排序：将指定索引的图片移到首位
    const handleReorder = useCallback((fromIndex: number) => {
        const resultData = data.result?.data
        if (!resultData || fromIndex <= 0 || fromIndex >= resultData.length) return

        // 将被点击的图片元素移到数组首位
        const newData = [...resultData]
        const [movedItem] = newData.splice(fromIndex, 1)
        newData.unshift(movedItem)

        // 通过 store 更新节点数据
        updateImageNodeData(id, {
            result: {
                type: data.result?.type ?? 'image',
                data: newData,
            },
        })
    }, [data.result, id, updateImageNodeData])

    return (
        <>
            <NodeContextMenu
                onDuplicate={handleContextMenuDuplicate}
                onDelete={handleContextMenuDelete}
                onSplitImage={handleContextMenuSplitImage}
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
                                onDuplicate={handleDuplicate}
                                onDelete={handleDelete}
                                onCrop={handleCrop}
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
                            <ImageContent data={data} onReorder={handleReorder} />
                        </div>
                    </div>
                </div>
            </NodeContextMenu>

            {/* 全景图查看器 - 使用 Portal 渲染到 body，避免 React Flow 的 CSS 隔离影响 fixed 定位 */}
            {typeof document !== 'undefined' && createPortal(
                <PanoramaViewer
                    open={panoramaViewer.open}
                    onClose={closePanoramaViewer}
                    initialImage={panoramaViewer.imageUrl ?? undefined}
                />,
                document.body
            )}
        </>
    )
})

ImageNode.displayName = 'ImageNode'
