import { NodeToolbar, Position, type NodeProps, useStore } from '@xyflow/react'
import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { ButtonHandle } from '@/components/button-handle'
import { NodeContextMenu } from '@/pages/Canvas/components/NodeContextMenu'
import { useNodeScale } from '@/hooks/useNodeScale'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { PanoramaNodeType } from '@/types/flow'
import { GenerationStatus } from '@/constants/enum'
import { cn } from '@/lib/utils'

export const PanoramaNode = memo(({
    id,
    data,
    selected,
    dragging
}: NodeProps<PanoramaNodeType>) => {
    const isDragging = Boolean(dragging)
    const { zoom } = useNodeScale()
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode)
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode)
    const addNode = useCanvasFlowStore((state) => state.addNode)
    const onConnect = useCanvasFlowStore((state) => state.onConnect)

    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const controlsRef = useRef<OrbitControls | null>(null)
    const canvasRef = useRef<HTMLDivElement>(null)
    const animationFrameRef = useRef<number>()

    const [isFullscreen, setIsFullscreen] = useState(false)

    const selectedNodesCount = useStore((state) => {
        let count = 0
        for (const node of state.nodes) {
            if (node.selected) count++
        }
        return count
    })

    const handleVisibilityClass = useMemo(() =>
        selected
            ? 'visible opacity-100'
            : 'invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100',
        [selected]
    )

    const shouldShowToolbar = useMemo(() =>
        selected && !isDragging && selectedNodesCount <= 1,
        [selected, isDragging, selectedNodesCount]
    )

    const handleDuplicate = useCallback(() => {
        duplicateNode(id)
    }, [duplicateNode, id])

    const handleDelete = useCallback(() => {
        deleteNode(id)
    }, [deleteNode, id])

    const handleContextMenuDuplicate = useCallback(() => {
        duplicateNode(id)
    }, [duplicateNode, id])

    const handleContextMenuDelete = useCallback(() => {
        deleteNode(id)
    }, [deleteNode, id])

    const handleScreenshot = useCallback(async (type: 'single' | '4grid' | '12grid') => {
        if (!rendererRef.current || !cameraRef.current || !sceneRef.current || !data.image_url) {
            return
        }

        const renderer = rendererRef.current
        const camera = cameraRef.current
        const scene = sceneRef.current

        const origWidth = canvasRef.current?.clientWidth || 400
        const origHeight = canvasRef.current?.clientHeight || 300
        const origAspect = camera.aspect
        const origPos = camera.position.clone()
        const origQuat = camera.quaternion.clone()

        let imageUrls: string[] = []

        if (type === 'single') {
            renderer.setSize(1920, 1080)
            camera.aspect = 1920 / 1080
            camera.updateProjectionMatrix()
            renderer.render(scene, camera)
            const dataURL = renderer.domElement.toDataURL('image/jpeg', 0.95)
            imageUrls = [dataURL]
        } else {
            const cellW = 960
            const cellH = 540
            const cols = type === '4grid' ? 2 : 4
            const rows = type === '12grid' ? 3 : 2

            const finalWidth = cellW * cols
            const finalHeight = cellH * rows

            const canvasObj = document.createElement('canvas')
            canvasObj.width = finalWidth
            canvasObj.height = finalHeight
            const ctx = canvasObj.getContext('2d')!

            renderer.setSize(cellW, cellH)
            camera.aspect = cellW / cellH
            camera.updateProjectionMatrix()

            const baseYaw = Math.atan2(
                camera.getWorldDirection(new THREE.Vector3()).x,
                camera.getWorldDirection(new THREE.Vector3()).z
            )

            const imagesData: { src: string; x: number; y: number }[] = []

            if (type === '4grid') {
                for (let i = 0; i < 4; i++) {
                    const yaw = baseYaw - i * (Math.PI / 2)
                    camera.position.set(0, 0, 0)
                    camera.lookAt(new THREE.Vector3(Math.cos(0) * Math.sin(yaw), Math.sin(0), Math.cos(0) * Math.cos(yaw)))
                    renderer.render(scene, camera)
                    imagesData.push({
                        src: renderer.domElement.toDataURL('image/jpeg', 0.95),
                        x: (i % 2) * cellW,
                        y: Math.floor(i / 2) * cellH,
                    })
                }
            } else if (type === '12grid') {
                const pitchUp = Math.PI / 4
                const pitchDown = -Math.PI / 4

                for (let col = 0; col < 4; col++) {
                    const yaw = baseYaw + (1 - col) * (Math.PI / 2)

                    for (let row = 0; row < 3; row++) {
                        const pitch = row === 0 ? pitchUp : row === 1 ? 0 : pitchDown
                        camera.position.set(0, 0, 0)
                        camera.lookAt(new THREE.Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)))
                        renderer.render(scene, camera)
                        imagesData.push({
                            src: renderer.domElement.toDataURL('image/jpeg', 0.95),
                            x: col * cellW,
                            y: row * cellH,
                        })
                    }
                }
            }

            renderer.setSize(origWidth, origHeight)
            camera.aspect = origAspect
            camera.position.copy(origPos)
            camera.quaternion.copy(origQuat)
            camera.updateProjectionMatrix()

            for (const item of imagesData) {
                const img = new Image()
                await new Promise<void>((resolve) => {
                    img.onload = () => {
                        ctx.drawImage(img, item.x, item.y, cellW, cellH)
                        resolve()
                    }
                    img.src = item.src
                })
            }

            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 4
            ctx.beginPath()
            for (let i = 1; i < cols; i++) {
                ctx.moveTo(i * cellW, 0)
                ctx.lineTo(i * cellW, finalHeight)
            }
            for (let j = 1; j < rows; j++) {
                ctx.moveTo(0, j * cellH)
                ctx.lineTo(finalWidth, j * cellH)
            }
            ctx.stroke()

            const finalDataURL = canvasObj.toDataURL('image/jpeg', 0.95)
            imageUrls = [finalDataURL]
        }

        renderer.setSize(origWidth, origHeight)
        camera.aspect = origAspect
        camera.position.copy(origPos)
        camera.quaternion.copy(origQuat)
        camera.updateProjectionMatrix()

        const currentNode = useCanvasFlowStore.getState().nodes.find(n => n.id === id)
        if (!currentNode) return

        for (const url of imageUrls) {
            const newImageNodeId = addNode('image', {
                x: currentNode.position.x + 250,
                y: currentNode.position.y,
            })

            setTimeout(() => {
                const { nodes, updateImageNodeData } = useCanvasFlowStore.getState()
                const newNode = nodes.find(n => n.id === newImageNodeId)
                if (newNode) {
                    updateImageNodeData(newImageNodeId, {
                        result: {
                            type: 'image',
                            data: [{ url }],
                        },
                        status: GenerationStatus.COMPLETED,
                    })
                }

                onConnect({
                    source: id,
                    sourceHandle: 'output',
                    target: newImageNodeId,
                    targetHandle: 'input',
                })
            }, 100)
        }
    }, [id, data.image_url, addNode, onConnect])

    const handleRecenter = useCallback(() => {
        if (cameraRef.current && controlsRef.current) {
            cameraRef.current.position.set(0, 0, 0.1)
            cameraRef.current.fov = 75
            cameraRef.current.updateProjectionMatrix()
            if (controlsRef.current.target) {
                controlsRef.current.target.set(0, 0, 0)
            }
            controlsRef.current.update()
        }
    }, [])

    const handleToggleFullscreen = useCallback(() => {
        setIsFullscreen(!isFullscreen)
    }, [isFullscreen])

    useEffect(() => {
        console.log('PanoramaNode useEffect triggered:', {
            hasCanvas: !!canvasRef.current,
            imageUrl: data.image_url,
        })

        if (!canvasRef.current || !data.image_url) {
            console.log('PanoramaNode: Missing canvas or image_url')
            return
        }

        if (rendererRef.current) {
            rendererRef.current.dispose()
            if (canvasRef.current.contains(rendererRef.current.domElement)) {
                canvasRef.current.removeChild(rendererRef.current.domElement)
            }
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
        }

        const scene = new THREE.Scene()
        sceneRef.current = scene

        const camera = new THREE.PerspectiveCamera(75, 400 / 300, 0.1, 1000)
        camera.position.set(0, 0, 0.1)
        cameraRef.current = camera

        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setSize(400, 300)
        renderer.setPixelRatio(window.devicePixelRatio)
        canvasRef.current.appendChild(renderer.domElement)
        rendererRef.current = renderer

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableZoom = false
        controls.enablePan = false
        controls.rotateSpeed = -0.5
        controlsRef.current = controls

        console.log('PanoramaNode: Loading texture from', data.image_url)
        
        // 使用 img 元素预加载图片，然后转换为 Three.js 纹理
        const loadImageWithImg = () => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            
            img.onload = () => {
                console.log('PanoramaNode: Image loaded successfully')
                
                try {
                    const texture = new THREE.Texture(img)
                    texture.colorSpace = THREE.SRGBColorSpace
                    texture.needsUpdate = true
                    
                    const geometry = new THREE.SphereGeometry(500, 60, 40)
                    geometry.scale(-1, 1, 1)
                    const material = new THREE.MeshBasicMaterial({ map: texture })
                    const sphere = new THREE.Mesh(geometry, material)
                    scene.add(sphere)

                    const animate = () => {
                        animationFrameRef.current = requestAnimationFrame(animate)
                        controls.update()
                        renderer.render(scene, camera)
                    }
                    animate()
                } catch (error) {
                    console.error('PanoramaNode: Failed to create texture:', error)
                }
            }
            
            img.onerror = (error) => {
                console.error('PanoramaNode: Image load error:', error)
                console.error('PanoramaNode: Failed to load image from:', data.image_url)
                
                // 尝试不带 CORS 加载
                console.log('PanoramaNode: Trying without CORS...')
                const imgNoCors = new Image()
                imgNoCors.onload = () => {
                    console.log('PanoramaNode: Image loaded without CORS')
                    
                    try {
                        // 创建 canvas 来转换图片
                        const canvas = document.createElement('canvas')
                        canvas.width = imgNoCors.width
                        canvas.height = imgNoCors.height
                        const ctx = canvas.getContext('2d')
                        if (ctx) {
                            ctx.drawImage(imgNoCors, 0, 0)
                            
                            const texture = new THREE.CanvasTexture(canvas)
                            texture.colorSpace = THREE.SRGBColorSpace
                            
                            const geometry = new THREE.SphereGeometry(500, 60, 40)
                            geometry.scale(-1, 1, 1)
                            const material = new THREE.MeshBasicMaterial({ map: texture })
                            const sphere = new THREE.Mesh(geometry, material)
                            scene.add(sphere)

                            const animate = () => {
                                animationFrameRef.current = requestAnimationFrame(animate)
                                controls.update()
                                renderer.render(scene, camera)
                            }
                            animate()
                        }
                    } catch (err) {
                        console.error('PanoramaNode: Failed to create texture without CORS:', err)
                    }
                }
                imgNoCors.onerror = () => {
                    console.error('PanoramaNode: All loading methods failed')
                }
                imgNoCors.src = data.image_url!
            }
            
            img.src = data.image_url!
        }
        
        loadImageWithImg()

        return () => {
            console.log('PanoramaNode: Cleaning up')
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
            if (rendererRef.current) {
                rendererRef.current.dispose()
                if (canvasRef.current && canvasRef.current.contains(rendererRef.current.domElement)) {
                    canvasRef.current.removeChild(rendererRef.current.domElement)
                }
            }
        }
    }, [data.image_url])

    return (
        <>
            <NodeContextMenu
                onDuplicate={handleContextMenuDuplicate}
                onDelete={handleContextMenuDelete}
            >
                <div className="group/node relative">
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

                    <NodeToolbar isVisible={shouldShowToolbar} position={Position.Top} offset={10 * zoom}>
                        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'bottom center' }}>
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1f] rounded-lg border border-white/10 shadow-lg">
                                <button
                                    onClick={() => handleScreenshot('single')}
                                    disabled={!data.image_url}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-[#B43FEB] hover:bg-[#9333ea] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    当前视角截图
                                </button>
                                <button
                                    onClick={() => handleScreenshot('4grid')}
                                    disabled={!data.image_url}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-[#B43FEB] hover:bg-[#9333ea] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    四宫格截图
                                </button>
                                <button
                                    onClick={() => handleScreenshot('12grid')}
                                    disabled={!data.image_url}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-[#B43FEB] hover:bg-[#9333ea] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    12宫格截图
                                </button>
                                <button
                                    onClick={handleRecenter}
                                    disabled={!data.image_url}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    重置视角
                                </button>
                                <button
                                    onClick={handleToggleFullscreen}
                                    disabled={!data.image_url}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    全屏查看
                                </button>
                            </div>
                        </div>
                    </NodeToolbar>

                    <div
                        className={cn(
                            "group/card relative flex w-100 h-75 flex-col rounded-xl border bg-gradient-to-br from-[#141418] to-[#0d0d10] transition-all duration-300 ease-out",
                            selected
                                ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                                : "border-white/[0.06] hover:border-white/[0.12] hover:bg-gradient-to-br hover:from-[#18181c] hover:to-[#101014]"
                        )}
                    >
                        {selected && (
                            <>
                                <div className="absolute -top-px -left-px w-4 h-4 border-l-2 border-t-2 border-[#B43FEB] rounded-tl-xl" />
                                <div className="absolute -top-px -right-px w-4 h-4 border-r-2 border-t-2 border-[#B43FEB] rounded-tr-xl" />
                                <div className="absolute -bottom-px -left-px w-4 h-4 border-l-2 border-b-2 border-[#B43FEB] rounded-bl-xl" />
                                <div className="absolute -bottom-px -right-px w-4 h-4 border-r-2 border-b-2 border-[#B43FEB] rounded-br-xl" />
                            </>
                        )}

                        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />

                        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-[#B43FEB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span className="text-sm font-medium text-white">全景图节点</span>
                            </div>
                            {data.image_url && (
                                <span className="text-xs text-white/50">已连接图片</span>
                            )}
                        </div>

                        <div className="relative flex-1 overflow-hidden rounded-b-xl bg-black/30">
                            {data.image_url ? (
                                <div ref={canvasRef} className="w-full h-full" />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-white/40">
                                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-sm">连接图片节点以查看全景图</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </NodeContextMenu>

            {isFullscreen && data.image_url && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] bg-gray-950 overflow-hidden">
                    <div ref={canvasRef} className="w-full h-full" />
                    <div className="fixed top-6 left-6 z-20 flex gap-2">
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="glass-panel hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg flex items-center justify-center"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            关闭
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
})

PanoramaNode.displayName = 'PanoramaNode'