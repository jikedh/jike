import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    type FinalConnectionState,
  type OnConnectStartParams,
    type InternalNode,
    useReactFlow,
    ControlButton,
    BackgroundVariant,
    applyNodeChanges,
    type NodeChange,
    SelectionMode,
    ConnectionLineType,
} from '@xyflow/react'

import { NodeSearch } from '@/components/node-search'
import { ArrowLeft, Eye, EyeOff, Upload } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { nodeTypes, edgeTypes } from '../constants/canvasConfig'
import { CanvasContextMenu, type CanvasNodeType } from './CanvasContextMenu'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import { useChatSettingsStore } from '@/store/chatSettingsStore'
import { uploadImage } from '@/api/ai'
import type { AllNodeType, EdgeType } from '@/types/flow'
import { Button } from '@/components/ui/button'
import { useCanvasCursor } from '@/hooks/useCanvasCursor'
import { GenerationStatus } from '@/constants/enum'
import { getClosestAspectRatio, getImageDimensions } from '../CustomNodes/ImageNode/utils/aspectRatioUtils'
import { uploadFileToOSS } from '@/utils/oss'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
} from '@/components/ui/dialog'

type CanvasFlowProps = {
    projectId: string | undefined
}

// 画布流组件：仅负责 ReactFlow 相关状态与渲染。
export const CanvasFlow = ({ projectId }: CanvasFlowProps) => {
    // 通过 zustand 读取图状态，避免业务动作散落在多个组件。
    const zustandNodes = useCanvasFlowStore((state) => state.nodes)
    const edges = useCanvasFlowStore((state) => state.edges)
    const currentProjectId = useCanvasFlowStore((state) => state.projectId)
    const storeOnNodesChange = useCanvasFlowStore((state) => state.onNodesChange)
    const onEdgesChange = useCanvasFlowStore((state) => state.onEdgesChange)
    const onConnect = useCanvasFlowStore((state) => state.onConnect)
    const addNode = useCanvasFlowStore((state) => state.addNode)
    const switchProject = useCanvasFlowStore((state) => state.switchProject)
    const gridVisible = useChatSettingsStore((state) => state.gridVisible)
    const nodeSearchVisible = useChatSettingsStore((state) => state.nodeSearchVisible)
    const reactFlowInstance = useReactFlow<AllNodeType, EdgeType>()
    const { screenToFlowPosition } = reactFlowInstance
    const navigate = useNavigate()
  const { cursorClass, setCursorMode, isCtrlPressed, isSpacePressed } = useCanvasCursor()

    // 确认对话框状态
    const [showExitDialog, setShowExitDialog] = useState(false)
    const [generatingCount, setGeneratingCount] = useState(0)

    // 获取正在生成的任务数量和取消方法
    const getGeneratingTasksCount = useCanvasFlowStore((state) => state.getGeneratingTasksCount)
    const cancelAllGeneratingTasks = useCanvasFlowStore((state) => state.cancelAllGeneratingTasks)

    // 获取撤销/重做方法
    const undo = useCanvasFlowStore((state) => state.undo)
    const redo = useCanvasFlowStore((state) => state.redo)
    const canUndo = useCanvasFlowStore((state) => state.canUndo)
    const canRedo = useCanvasFlowStore((state) => state.canRedo)
    const copySelectedNode = useCanvasFlowStore((state) => state.copySelectedNode)
    const pasteNode = useCanvasFlowStore((state) => state.pasteNode)
    const canPaste = useCanvasFlowStore((state) => state.canPaste)

    // 处理键盘快捷键
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // 检查是否在输入框中
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return
        }

        // Ctrl+Z 或 Cmd+Z：撤销
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault()
            if (canUndo()) {
                undo()
            }
        }

        // Ctrl+Shift+Z 或 Cmd+Shift+Z 或 Ctrl+Y：重做
        if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
            event.preventDefault()
            if (canRedo()) {
                redo()
            }
        }

        // Ctrl+C 或 Cmd+C：复制节点
        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            event.preventDefault()
            copySelectedNode()
        }

        // Ctrl+V 或 Cmd+V：粘贴节点或图片
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            // 不阻止默认行为，让 paste 事件处理图片粘贴
            // paste 事件处理器会同时处理图片和节点粘贴
        }
    }, [undo, redo, canUndo, canRedo, copySelectedNode, pasteNode, canPaste])

    // 监听键盘事件
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [handleKeyDown])

    useEffect(() => {
        const handleWheel = (event: WheelEvent) => {
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault()
                
                const { zoom: currentZoom, x, y } = reactFlowInstance.getViewport()
                const zoomStep = 0.15
                const newZoom = event.deltaY < 0 
                    ? Math.min(currentZoom * (1 + zoomStep), 2)
                    : Math.max(currentZoom * (1 - zoomStep), 0.1)

                const reactFlowBounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
                const mouseX = event.clientX - reactFlowBounds.left
                const mouseY = event.clientY - reactFlowBounds.top

                const zoomRatio = newZoom / currentZoom
                
                const newX = mouseX - (mouseX - x) * zoomRatio
                const newY = mouseY - (mouseY - y) * zoomRatio

                reactFlowInstance.setViewport({
                    x: newX,
                    y: newY,
                    zoom: newZoom,
                }, { duration: 100 })
            }
        }

        const reactFlowContainer = document.querySelector('.react-flow')
        if (reactFlowContainer) {
            reactFlowContainer.addEventListener('wheel', handleWheel as EventListener, { passive: false })
        }

        return () => {
            if (reactFlowContainer) {
                reactFlowContainer.removeEventListener('wheel', handleWheel as EventListener)
            }
        }
    }, [reactFlowInstance])

    // 处理返回按钮点击
    const handleBackClick = useCallback(() => {
        const count = getGeneratingTasksCount()
        if (count > 0) {
            setGeneratingCount(count)
            setShowExitDialog(true)
        } else {
            navigate('/home')
        }
    }, [getGeneratingTasksCount, navigate])

    // 确认退出
    const handleConfirmExit = useCallback(() => {
        cancelAllGeneratingTasks()
        setShowExitDialog(false)
        navigate('/home')
    }, [cancelAllGeneratingTasks, navigate])

    // 取消退出
    const handleCancelExit = useCallback(() => {
        setShowExitDialog(false)
    }, [])

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

    // 检测节点靠近并自动连接
    const checkAutoConnect = useCallback(
        (draggedNodeId: string, draggedNodePosition: { x: number; y: number }) => {
            const allNodes = useCanvasFlowStore.getState().nodes
            const draggedNode = allNodes.find((n) => n.id === draggedNodeId)
            if (!draggedNode) return

            const SNAP_DISTANCE = 120
            const SNAP_OFFSET = 50
            const draggedWidth = draggedNode.width || 175
            const draggedHeight = draggedNode.height || 175
            const draggedCenterX = draggedNodePosition.x + draggedWidth / 2
            const draggedCenterY = draggedNodePosition.y + draggedHeight / 2

            let nearestNode: typeof allNodes[0] | null = null
            let nearestDistance = Infinity
            let snapPosition: { x: number; y: number } | null = null

            for (const targetNode of allNodes) {
                if (targetNode.id === draggedNodeId) continue

                const targetWidth = targetNode.width || 175
                const targetHeight = targetNode.height || 175
                const targetCenterX = targetNode.position.x + targetWidth / 2
                const targetCenterY = targetNode.position.y + targetHeight / 2

                const distance = Math.sqrt(
                    Math.pow(draggedCenterX - targetCenterX, 2) +
                    Math.pow(draggedCenterY - targetCenterY, 2)
                )

                if (distance < SNAP_DISTANCE && distance < nearestDistance) {
                    nearestDistance = distance
                    nearestNode = targetNode

                    const isLeft = draggedCenterX < targetCenterX

                    if (isLeft) {
                        snapPosition = {
                            x: targetNode.position.x - draggedWidth - SNAP_OFFSET,
                            y: targetCenterY - draggedHeight / 2,
                        }
                    } else {
                        snapPosition = {
                            x: targetNode.position.x + targetWidth + SNAP_OFFSET,
                            y: targetCenterY - draggedHeight / 2,
                        }
                    }
                }
            }

            if (nearestNode && snapPosition) {
                const existingEdges = useCanvasFlowStore.getState().edges
                const hasConnection = existingEdges.some(
                    (edge) =>
                        (edge.source === draggedNodeId && edge.target === nearestNode.id) ||
                        (edge.source === nearestNode.id && edge.target === draggedNodeId)
                )

                if (!hasConnection) {
                    const isLeft = snapPosition.x < nearestNode.position.x
                    onConnect({
                        source: isLeft ? draggedNodeId : nearestNode.id,
                        sourceHandle: 'output',
                        target: isLeft ? nearestNode.id : draggedNodeId,
                        targetHandle: 'input',
                    })
                }

                const changes: NodeChange<AllNodeType>[] = [{
                    id: draggedNodeId,
                    type: 'position',
                    position: snapPosition,
                    dragging: false,
                }]
                storeOnNodesChange(changes)
            }
        },
        [onConnect, storeOnNodesChange]
    )

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

        // 检测拖动结束时的自动连接
        changes.forEach((change) => {
            if (change.type === 'position' && change.dragging === false && change.position) {
                checkAutoConnect(change.id, change.position)
            }
        })
    }, [storeOnNodesChange, checkAutoConnect])

    const handleNodeDragStart = useCallback(() => {
        isDraggingRef.current = true
    }, [])

    const handleNodeDragStop = useCallback(() => {
        isDraggingRef.current = false
        // ReactFlow 拖动结束时会自动触发 onNodesChange（dragging: false）
        // 上面的 onNodesChange 已经将最终位置写入 Zustand，此处只需重置 ref 即可
    }, [])

    // 点击画布空白区域时取消所有节点的选中状态
    const handlePaneClick = useCallback(() => {
        const allNodes = useCanvasFlowStore.getState().nodes
        const selectedNodes = allNodes.filter((node) => node.selected)

        if (selectedNodes.length > 0) {
            const changes: NodeChange<AllNodeType>[] = selectedNodes.map((node) => ({
                id: node.id,
                type: 'select',
                selected: false,
            }))
            storeOnNodesChange(changes)
        }
    }, [storeOnNodesChange])

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

  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
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
      (_: unknown, params: OnConnectStartParams) => {
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

            const pointer = 'changedTouches' in event ? event.changedTouches[0] : event
            if (!pointer) {
                pendingConnectRef.current = null
                return
            }

            const pendingConnect = pendingConnectRef.current
            if (pendingConnect) {
                const allNodes = useCanvasFlowStore.getState().nodes
                const pointerPos = screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY })

                for (const targetNode of allNodes) {
                    if (targetNode.id === pendingConnect.nodeId) continue

                    const nodeWidth = targetNode.width || 175
                    const nodeHeight = targetNode.height || 175
                    const nodeLeft = targetNode.position.x
                    const nodeRight = targetNode.position.x + nodeWidth
                    const nodeTop = targetNode.position.y
                    const nodeBottom = targetNode.position.y + nodeHeight

                    const isInsideNode =
                        pointerPos.x >= nodeLeft &&
                        pointerPos.x <= nodeRight &&
                        pointerPos.y >= nodeTop &&
                        pointerPos.y <= nodeBottom

                    if (isInsideNode) {
                        const existingEdges = useCanvasFlowStore.getState().edges
                        const hasConnection = existingEdges.some(
                            (edge) =>
                                (edge.source === pendingConnect.nodeId && edge.target === targetNode.id) ||
                                (edge.source === targetNode.id && edge.target === pendingConnect.nodeId)
                        )

                        if (!hasConnection) {
                            if (pendingConnect.handleType === 'source') {
                                onConnect({
                                    source: pendingConnect.nodeId,
                                    sourceHandle: pendingConnect.handleId ?? 'output',
                                    target: targetNode.id,
                                    targetHandle: 'input',
                                })
                            } else {
                                onConnect({
                                    source: targetNode.id,
                                    sourceHandle: 'output',
                                    target: pendingConnect.nodeId,
                                    targetHandle: pendingConnect.handleId ?? 'input',
                                })
                            }
                        }

                        pendingConnectRef.current = null
                        return
                    }
                }
            }

            openContextMenuAt(pointer.clientX, pointer.clientY)
        },
        [screenToFlowPosition, onConnect, openContextMenuAt]
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

                // 设置初始状态为加载中
                updateImageNodeData(newNodeId, {
                    status: GenerationStatus.IN_PROGRESS,
                    isUpload: true,
                })

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
                        // 获取图片尺寸并计算最接近的比例
                        try {
                            const dimensions = await getImageDimensions(imageUrl)
                            const aspectRatio = getClosestAspectRatio(dimensions.width, dimensions.height)

                            updateImageNodeData(newNodeId, {
                                status: GenerationStatus.COMPLETED,
                                size: aspectRatio,
                                result: {
                                    type: 'image',
                                    data: [{ url: imageUrl }],
                                },
                            })
                        } catch (error) {
                            // 如果获取尺寸失败，使用默认比例
                            updateImageNodeData(newNodeId, {
                                status: GenerationStatus.COMPLETED,
                                result: {
                                    type: 'image',
                                    data: [{ url: imageUrl }],
                                },
                            })
                        }
                    } else {
                        updateImageNodeData(newNodeId, {
                            status: GenerationStatus.FAILED,
                            error: { message: '上传失败，未获取到图片地址' },
                        })
                    }
                } catch (error) {
                    console.error('图片上传失败:', error)
                    updateImageNodeData(newNodeId, {
                        status: GenerationStatus.FAILED,
                        error: { message: '上传失败，请重试' },
                    })
                }
            }
        },
        [addNode, screenToFlowPosition, updateImageNodeData]
    )

    // ==================== 音频拖拽上传逻辑 ====================

    const updateAudioNodeData = useCanvasFlowStore((state) => state.updateAudioNodeData)

    // 处理音频文件上传并创建节点
    const handleAudioDrop = useCallback(
        async (files: File[], dropPosition: { x: number; y: number }) => {
            const flowPosition = screenToFlowPosition(dropPosition)

            for (const file of files) {
                const newNodeId = addNode('audio', flowPosition)

                updateAudioNodeData(newNodeId, {
                    status: GenerationStatus.IN_PROGRESS,
                    isUpload: true,
                })

                flowPosition.x += 40
                flowPosition.y += 40

                try {
                    const result = await uploadFileToOSS(file)
                    const url = result.url

                    if (url) {
                        updateAudioNodeData(newNodeId, {
                            status: GenerationStatus.COMPLETED,
                            progress: 100,
                            isUpload: true,
                            result: {
                                type: 'audio',
                                data: [{ url }],
                            },
                        })
                    } else {
                        updateAudioNodeData(newNodeId, {
                            status: GenerationStatus.FAILED,
                            error: { message: '上传失败，未获取到音频地址' },
                        })
                    }
                } catch (error) {
                    console.error('音频上传失败:', error)
                    updateAudioNodeData(newNodeId, {
                        status: GenerationStatus.FAILED,
                        error: { message: '上传失败，请重试' },
                    })
                }
            }
        },
        [addNode, screenToFlowPosition, updateAudioNodeData]
    )

    // ==================== 视频拖拽上传逻辑 ====================

    const updateVideoNodeData = useCanvasFlowStore((state) => state.updateVideoNodeData)

    const handleVideoDrop = useCallback(
        async (files: File[], dropPosition: { x: number; y: number }) => {
            const flowPosition = screenToFlowPosition(dropPosition)

            for (const file of files) {
                const newNodeId = addNode('video', flowPosition)

                updateVideoNodeData(newNodeId, {
                    status: GenerationStatus.IN_PROGRESS,
                    isUpload: true,
                })

                flowPosition.x += 40
                flowPosition.y += 40

                try {
                    const result = await uploadFileToOSS(file)
                    const url = result.url

                    if (url) {
                        updateVideoNodeData(newNodeId, {
                            status: GenerationStatus.COMPLETED,
                            progress: 100,
                            isUpload: true,
                            result: {
                                type: 'video',
                                data: [{ url, format: file.type.split('/')[1] || 'mp4' }],
                            },
                        })
                    } else {
                        updateVideoNodeData(newNodeId, {
                            status: GenerationStatus.FAILED,
                            error: { message: '上传失败，未获取到视频地址' },
                        })
                    }
                } catch (error) {
                    console.error('视频上传失败:', error)
                    updateVideoNodeData(newNodeId, {
                        status: GenerationStatus.FAILED,
                        error: { message: '上传失败，请重试' },
                    })
                }
            }
        },
        [addNode, screenToFlowPosition, updateVideoNodeData]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': [], 'audio/*': [], 'video/*': [] },
        noClick: true,
        noKeyboard: true,
        onDrop: (acceptedFiles, _rejectedFiles, event) => {
            const dropEvent = event as unknown as DragEvent
            if (dropEvent && 'clientX' in dropEvent && 'clientY' in dropEvent) {
                const imageFiles = acceptedFiles.filter(f => f.type.startsWith('image/'))
                const audioFiles = acceptedFiles.filter(f => f.type.startsWith('audio/'))
                const videoFiles = acceptedFiles.filter(f => f.type.startsWith('video/'))
                
                if (imageFiles.length > 0) {
                    handleImageDrop(imageFiles, {
                        x: dropEvent.clientX,
                        y: dropEvent.clientY,
                    })
                }
                
                if (audioFiles.length > 0) {
                    handleAudioDrop(audioFiles, {
                        x: dropEvent.clientX,
                        y: dropEvent.clientY,
                    })
                }
                
                if (videoFiles.length > 0) {
                    handleVideoDrop(videoFiles, {
                        x: dropEvent.clientX,
                        y: dropEvent.clientY,
                    })
                }
            }
        },
    })

    // 处理粘贴图片、音频和视频
    const handlePaste = useCallback(
        async (event: ClipboardEvent) => {
            // 检查是否在输入框中
            const target = event.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return
            }

            const items = event.clipboardData?.items
            if (!items) {
                // 没有剪贴板数据，尝试粘贴节点
                if (canPaste()) {
                    pasteNode()
                }
                return
            }

            const imageFiles: File[] = []
            const audioFiles: File[] = []
            const videoFiles: File[] = []
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile()
                    if (file) {
                        imageFiles.push(file)
                    }
                } else if (item.type.startsWith('audio/')) {
                    const file = item.getAsFile()
                    if (file) {
                        audioFiles.push(file)
                    }
                } else if (item.type.startsWith('video/')) {
                    const file = item.getAsFile()
                    if (file) {
                        videoFiles.push(file)
                    }
                }
            }

            if (imageFiles.length > 0) {
                // 有图片，在画布中心位置创建节点
                event.preventDefault()
                handleImageDrop(imageFiles, {
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                })
            }
            
            if (audioFiles.length > 0) {
                // 有音频，在画布中心位置创建节点
                event.preventDefault()
                handleAudioDrop(audioFiles, {
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                })
            }
            
            if (videoFiles.length > 0) {
                // 有视频，在画布中心位置创建节点
                event.preventDefault()
                handleVideoDrop(videoFiles, {
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                })
            }
            
            if (imageFiles.length === 0 && audioFiles.length === 0 && videoFiles.length === 0 && canPaste()) {
                // 没有图片、音频和视频，尝试粘贴节点
                event.preventDefault()
                pasteNode()
            }
        },
        [handleImageDrop, handleAudioDrop, handleVideoDrop, canPaste, pasteNode]
    )

    // 监听粘贴事件
    useEffect(() => {
        document.addEventListener('paste', handlePaste)
        return () => {
            document.removeEventListener('paste', handlePaste)
        }
    }, [handlePaste])

    return (
        <>
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
                    onPaneClick={handlePaneClick}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    nodesDraggable={!isSpacePressed}
                    fitView
                    minZoom={0.2}
                    maxZoom={2}
                    colorMode='dark'
                    deleteKeyCode={['Backspace', 'Delete']}
                    panOnDrag={isSpacePressed ? true : [1]}
                    selectionOnDrag={!isSpacePressed}
                    selectionMode={SelectionMode.Partial}
                    multiSelectionKeyCode={['Shift']}
                    panOnScroll={!isCtrlPressed}
                    panOnScrollSpeed={0.5}
                    zoomOnDoubleClick={false}
                    zoomOnScroll={isCtrlPressed}
                    zoomOnPinch={true}
                    preventScrolling={false}
                    className={cursorClass}
                    onMouseEnter={() => setCursorMode('default')}
                    connectionLineType={ConnectionLineType.Bezier}
                    connectionLineStyle={{ stroke: '#B43FEB', strokeWidth: 2, fill: 'none' }}
                    snapToGrid={true}
                    snapGrid={[20, 20]}
                    connectionRadius={50}
                    defaultEdgeOptions={{
                        type: 'default',
                        style: { stroke: '#B43FEB', strokeWidth: 2 },
                        animated: false,
                    }}
                    data-space-pressed={isSpacePressed ? 'true' : undefined}
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
              onClick={handleBackClick}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="size-4" />
              返回
            </Button>
          </div>
            </div>
        </CanvasContextMenu>

        {/* 确认退出对话框 */}
        <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
            <DialogContent className="bg-[#1a1a1f] border-white/10">
                <DialogHeader>
                    <h2 className="text-lg font-semibold text-white">确认离开</h2>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-sm text-gray-400">
                        目前有 <span className="font-semibold text-[#B43FEB]">{generatingCount}</span> 个正在生成的任务，离开后这些任务将取消生成。
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                        确定要离开吗？
                    </p>
                </div>
                <DialogFooter className="border-white/10">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleCancelExit}
                        className="border border-white/10 bg-transparent hover:bg-white/5 text-gray-300"
                    >
                        取消
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleConfirmExit}
                        className="bg-[#B43FEB] hover:bg-[#B43FEB]/80 text-white"
                    >
                        确认离开
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    )
}
