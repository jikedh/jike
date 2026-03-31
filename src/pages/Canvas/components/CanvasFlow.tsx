import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    type FinalConnectionState,
    type InternalNode,
    useReactFlow,
    ControlButton,
    BackgroundVariant,
    applyNodeChanges,
    type NodeChange,
} from '@xyflow/react'

import { NodeSearch } from '@/components/node-search'
import { ArrowLeft, Eye, EyeOff, Upload } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { nodeTypes } from '../constants/canvasConfig'
import { CanvasContextMenu, type CanvasNodeType } from './CanvasContextMenu'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import { useChatSettingsStore } from '@/store/chatSettingsStore'
import { uploadImage } from '@/api/ai'
import type { AllNodeType, EdgeType } from '@/types/flow'
import { Button } from '@/components/ui/button'

type CanvasFlowProps = {
    projectId: string | undefined
}

// 画布流组件：仅负责 ReactFlow 相关状态与渲染。
export const CanvasFlow = ({ projectId }: CanvasFlowProps) => {
    // 通过 zustand 读取图状态，避免业务动作散落在多个组件。
    const zustandNodes = useCanvasFlowStore((state) => state.nodes)
    const edges = useCanvasFlowStore((state) => state.edges)
    const hydrated = useCanvasFlowStore((state) => state.hydrated)
    const currentProjectId = useCanvasFlowStore((state) => state.projectId)
    const storeOnNodesChange = useCanvasFlowStore((state) => state.onNodesChange)
    const onEdgesChange = useCanvasFlowStore((state) => state.onEdgesChange)
    const onConnect = useCanvasFlowStore((state) => state.onConnect)
    const addNode = useCanvasFlowStore((state) => state.addNode)
    const switchProject = useCanvasFlowStore((state) => state.switchProject)
    const gridVisible = useChatSettingsStore((state) => state.gridVisible)
    const nodeSearchVisible = useChatSettingsStore((state) => state.nodeSearchVisible)
    const { screenToFlowPosition } = useReactFlow<AllNodeType, EdgeType>()
    const navigate = useNavigate()

    // ==================== 拖动性能优化：本地 nodes 状态隔离 ====================
    //
    // 问题：ReactFlow 受控模式下，拖动时每帧调用 onNodesChange → Zustand set →
    //       CanvasFlow 重渲染（因为订阅了 zustandNodes） → React DevTools 跟踪
    //       每次重渲染开销 → 打开开发者工具时卡顿。
    //
    // 解法：维护本地 displayNodes 状态用于 ReactFlow 渲染：
    //   - 拖动时：只更新本地 displayNodes（视觉流畅），不写入 Zustand（不触发全局重渲染）
    //   - 拖动结束：同步最终位置到 Zustand（持久化）
    //   - 外部变更（添加/删除节点、图片生成结果等）：Zustand 变化时同步到 displayNodes

    const [displayNodes, setDisplayNodes] = useState<AllNodeType[]>(zustandNodes)
    // 用 ref 而非 state 追踪拖动状态，避免引发额外渲染
    const isDraggingRef = useRef(false)

    // 当 Zustand nodes 发生外部变更时（非拖动），同步到 displayNodes
    useEffect(() => {
        if (!isDraggingRef.current) {
            setDisplayNodes(zustandNodes)
        }
    }, [zustandNodes])

    // 本地 onNodesChange：拖动中只更新 displayNodes，拖动结束才同步 Zustand
    const onNodesChange = useCallback((changes: NodeChange<AllNodeType>[]) => {
        // 始终更新本地显示状态，保证拖动视觉流畅
        setDisplayNodes((prev) => applyNodeChanges(changes, prev))

        // 过滤掉拖动进行中的位置变更，只把最终结果（dragging: false）和其他类型变更写入 Zustand
        const persistableChanges = changes.filter(
            (c) => !(c.type === 'position' && c.dragging === true)
        )
        if (persistableChanges.length > 0) {
            storeOnNodesChange(persistableChanges)
        }
    }, [storeOnNodesChange])

    const handleNodeDragStart = useCallback(() => {
        isDraggingRef.current = true
    }, [])

    const handleNodeDragStop = useCallback(() => {
        isDraggingRef.current = false
        // ReactFlow 拖动结束时会自动触发 onNodesChange（dragging: false）
        // 上面的 onNodesChange 已经将最终位置写入 Zustand，此处只需重置 ref 即可
    }, [])

    // 当 projectId 变化时切换项目
    useEffect(() => {
        if (projectId && projectId !== currentProjectId) {
            switchProject(projectId)
        }
    }, [projectId, currentProjectId, switchProject])

    const contextMenuTriggerRef = useRef<HTMLDivElement | null>(null)
    const [menuScreenPosition, setMenuScreenPosition] = useState({ x: 0, y: 0 })
    const [isMiniMapVisible, setIsMiniMapVisible] = useState(true)
    const pendingConnectRef = useRef<{
        nodeId: string
        handleId: string | null
        handleType: 'source' | 'target'
    } | null>(null)

    const openContextMenuAt = useCallback((x: number, y: number) => {
        setMenuScreenPosition({ x, y })
        const contextMenuEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
        })
        contextMenuTriggerRef.current?.dispatchEvent(contextMenuEvent)
    }, [])

    const handlePaneContextMenu = useCallback((event) => {
        pendingConnectRef.current = null
        setMenuScreenPosition({ x: event.clientX, y: event.clientY })
    }, [])

    // 通过原生 dblclick 事件实现双击唤出菜单
    const handleNativeDblClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        // 只响应点在画布空白区域（.react-flow__pane）上的双击
        const target = event.target as Element
        if (target.closest('.react-flow__pane')) {
            // 阻止 ReactFlow 默认的双击缩放行为
            event.preventDefault()
            event.stopPropagation()
            openContextMenuAt(event.clientX, event.clientY)
        }
    }, [openContextMenuAt])

    const handleConnectStart = useCallback(
        (_, params) => {
            if (!params?.nodeId || !params?.handleType) {
                pendingConnectRef.current = null
                return
            }

            pendingConnectRef.current = {
                nodeId: params.nodeId,
                handleId: params.handleId ?? null,
                handleType: params.handleType,
            }
        },
        []
    )

    const handleConnectEnd = useCallback(
        (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState<InternalNode>) => {
            if (connectionState.isValid) {
                pendingConnectRef.current = null
                return
            }

            // 防止用户在非画布区域释放连接线时意外触发菜单,比如在侧边栏或其他 UI 上。我觉得这个没有必要要，反而会有性能问题
            // if (event.target instanceof Element && !event.target.closest('.react-flow__pane')) {
            //     pendingConnectRef.current = null
            //     return
            // }

            const pointer = 'changedTouches' in event ? event.changedTouches[0] : event
            if (!pointer) {
                pendingConnectRef.current = null
                return
            }

            openContextMenuAt(pointer.clientX, pointer.clientY)
        },
        [openContextMenuAt]
    )

    const handleCreateNodeFromMenu = useCallback(
        (nodeType: CanvasNodeType) => {
            const flowPosition = screenToFlowPosition(menuScreenPosition)
            const newNodeId = addNode(nodeType, flowPosition)

            const pendingConnect = pendingConnectRef.current
            if (!pendingConnect) {
                return
            }

            if (pendingConnect.handleType === 'source') {
                onConnect({
                    source: pendingConnect.nodeId,
                    sourceHandle: pendingConnect.handleId ?? 'output',
                    target: newNodeId,
                    targetHandle: 'input',
                })
            } else {
                onConnect({
                    source: newNodeId,
                    sourceHandle: 'output',
                    target: pendingConnect.nodeId,
                    targetHandle: pendingConnect.handleId ?? 'input',
                })
            }

            pendingConnectRef.current = null
        },
        [addNode, menuScreenPosition, onConnect, screenToFlowPosition]
    )

    // ==================== 图片拖拽上传逻辑 ====================

    const updateImageNodeData = useCanvasFlowStore((state) => state.updateImageNodeData)

    // 处理图片文件上传并创建节点
    const handleImageDrop = useCallback(
        async (files: File[], dropPosition: { x: number; y: number }) => {
            const flowPosition = screenToFlowPosition(dropPosition)

            for (const file of files) {
                const newNodeId = addNode('image', flowPosition)

                // 偏移后续节点位置，避免重叠
                flowPosition.x += 40
                flowPosition.y += 40

                // 创建 FormData 上传
                const formData = new FormData()
                formData.append('file', file)

                try {
                    const response: any = await uploadImage(formData)
                    const imageUrl = response?.url || response?.data?.url

                    if (imageUrl) {
                        updateImageNodeData(newNodeId, {
                            result: {
                                type: 'image',
                                data: [{ url: imageUrl }],
                            },
                        })
                    }
                } catch (error) {
                    console.error('图片上传失败:', error)
                }
            }
        },
        [addNode, screenToFlowPosition, updateImageNodeData]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': [] },
        noClick: true,
        noKeyboard: true,
        onDrop: (acceptedFiles, _rejectedFiles, event) => {
            const dropEvent = event as unknown as DragEvent
            if (dropEvent && 'clientX' in dropEvent && 'clientY' in dropEvent) {
                handleImageDrop(acceptedFiles, {
                    x: dropEvent.clientX,
                    y: dropEvent.clientY,
                })
            }
        },
    })

    return (
        <CanvasContextMenu onCreateNode={handleCreateNodeFromMenu}>
            <div
                {...getRootProps()}
                ref={contextMenuTriggerRef}
                className="h-full w-full relative"
                onDoubleClick={handleNativeDblClick}
            >
                <input {...getInputProps()} />
                <ReactFlow<AllNodeType, EdgeType>
                    nodes={displayNodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onConnectStart={handleConnectStart}
                    onPaneContextMenu={handlePaneContextMenu}
                    onConnectEnd={handleConnectEnd}
                    onNodeDragStart={handleNodeDragStart}
                    onNodeDragStop={handleNodeDragStop}
                    nodeTypes={nodeTypes}
                    nodesDraggable
                    fitView
                    minZoom={0.2}
                    maxZoom={2}
                    colorMode='dark'
                    deleteKeyCode={['Backspace', 'Delete']}
                    panOnDrag={[1]}
                    selectionOnDrag={true}
                    zoomOnDoubleClick={false}
                >
                    {gridVisible && <Background variant={BackgroundVariant.Dots} />}
                    <Controls>
                        <ControlButton onClick={() => setIsMiniMapVisible((prev) => !prev)}>
                            {isMiniMapVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </ControlButton>
                    </Controls>
                    {isMiniMapVisible ? (
                        <MiniMap pannable zoomable position="bottom-left" style={{ left: '48px' }} />
                    ) : null}
                </ReactFlow>

                {/* 拖拽覆盖层 */}
                {isDragActive && (
                    <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center gap-2 text-primary">
                            <Upload className="size-12" />
                            <span className="text-lg font-medium">释放图片到画布</span>
                        </div>
                    </div>
                )}

                {/* 节点搜索框 */}
                {nodeSearchVisible && (
                    <div className="absolute top-4 right-4 z-10">
                        <NodeSearch
                            onSearch={(searchString) => {
                                const allNodes = useCanvasFlowStore.getState().nodes
                                return allNodes.filter((node) =>
                                    node.data?.promptDraft?.toLowerCase().includes(searchString.toLowerCase())
                                )
                            }}
                        />
                    </div>
                )}

          {/* 返回按钮 */}
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/home')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="size-4" />
              返回
            </Button>
          </div>
            </div>
        </CanvasContextMenu>
    )
}
