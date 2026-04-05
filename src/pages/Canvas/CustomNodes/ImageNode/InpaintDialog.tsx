import { IconX } from '@tabler/icons-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

type InpaintTool = 'brush' | 'eraser'

type InpaintDialogProps = {
    open: boolean
    imageUrl?: string
    onOpenChange: (open: boolean) => void
    onGenerate: (payload: { file: File; prompt: string }) => Promise<void>
}

const HISTORY_LIMIT = 30

/**
 * 重绘弹窗。
 * 职责：
 * - 提供画笔/橡皮擦绘制区域能力
 * - 提供撤销/重做/清空与笔刷大小调整
 * - 提供提示词输入，并在点击生成时导出“原图 + mask 涂抹层”的合成图
 */
export const InpaintDialog = memo(({ open, imageUrl, onOpenChange, onGenerate }: InpaintDialogProps) => {
    const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)

    const isDrawingRef = useRef(false)
    const lastPointRef = useRef<{ x: number; y: number } | null>(null)
    const pendingPointRef = useRef<{ x: number; y: number } | null>(null)
    const frameRef = useRef<number | null>(null)

    const [tool, setTool] = useState<InpaintTool>('brush')
    const [brushSize, setBrushSize] = useState(24)
    const [prompt, setPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

    const [history, setHistory] = useState<ImageData[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)

    const canUndo = historyIndex > 0
    const canRedo = historyIndex >= 0 && historyIndex < history.length - 1

    const commitMaskHistory = useCallback(() => {
        const maskCanvas = maskCanvasRef.current
        if (!maskCanvas) {
            return
        }

        const maskCtx = maskCanvas.getContext('2d')
        if (!maskCtx) {
            return
        }

        const snapshot = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)

        setHistory((prev) => {
            const truncated = prev.slice(0, historyIndex + 1)
            const next = [...truncated, snapshot]
            return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
        })

        setHistoryIndex((prev) => {
            const truncatedLength = prev + 1
            const nextLength = Math.min(truncatedLength + 1, HISTORY_LIMIT)
            return nextLength - 1
        })
    }, [historyIndex])

    const renderBaseImage = useCallback(() => {
        const baseCanvas = baseCanvasRef.current
        const image = imageRef.current
        if (!baseCanvas || !image) {
            return
        }

        const baseCtx = baseCanvas.getContext('2d')
        if (!baseCtx) {
            return
        }

        baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height)
        baseCtx.drawImage(image, 0, 0, baseCanvas.width, baseCanvas.height)
    }, [])

    const loadImage = useCallback(() => {
        if (!open || !imageUrl) {
            return
        }

        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => {
            const longestEdge = Math.max(image.naturalWidth, image.naturalHeight)
            const scale = longestEdge > 1400 ? 1400 / longestEdge : 1
            const width = Math.max(1, Math.round(image.naturalWidth * scale))
            const height = Math.max(1, Math.round(image.naturalHeight * scale))

            imageRef.current = image
            setCanvasSize({ width, height })

            requestAnimationFrame(() => {
                const baseCanvas = baseCanvasRef.current
                const maskCanvas = maskCanvasRef.current
                if (!baseCanvas || !maskCanvas) {
                    return
                }

                baseCanvas.width = width
                baseCanvas.height = height
                maskCanvas.width = width
                maskCanvas.height = height

                renderBaseImage()

                const maskCtx = maskCanvas.getContext('2d')
                if (!maskCtx) {
                    return
                }

                maskCtx.clearRect(0, 0, width, height)
                const initial = maskCtx.getImageData(0, 0, width, height)
                setHistory([initial])
                setHistoryIndex(0)
            })
        }

        image.src = imageUrl
    }, [imageUrl, open, renderBaseImage])

    useEffect(() => {
        if (!open) {
            return
        }

        setTool('brush')
        setBrushSize(24)
        setPrompt('')
        setIsGenerating(false)
        setHistory([])
        setHistoryIndex(-1)
        loadImage()
    }, [loadImage, open])

    useEffect(() => {
        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current)
                frameRef.current = null
            }
        }
    }, [])

    const getCanvasPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const maskCanvas = maskCanvasRef.current
        if (!maskCanvas) {
            return null
        }

        const rect = maskCanvas.getBoundingClientRect()
        if (!rect.width || !rect.height) {
            return null
        }

        const scaleX = maskCanvas.width / rect.width
        const scaleY = maskCanvas.height / rect.height

        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        }
    }, [])

    const drawLine = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
        const maskCanvas = maskCanvasRef.current
        if (!maskCanvas) {
            return
        }

        const maskCtx = maskCanvas.getContext('2d')
        if (!maskCtx) {
            return
        }

        maskCtx.save()
        maskCtx.lineCap = 'round'
        maskCtx.lineJoin = 'round'
        maskCtx.lineWidth = brushSize
        maskCtx.globalCompositeOperation = tool === 'brush' ? 'source-over' : 'destination-out'
        // 画笔颜色固定为红色，橡皮擦依赖 destination-out 擦除。
        maskCtx.strokeStyle = '#ff3b30'
        maskCtx.beginPath()
        maskCtx.moveTo(from.x, from.y)
        maskCtx.lineTo(to.x, to.y)
        maskCtx.stroke()
        maskCtx.restore()
    }, [brushSize, tool])

    const scheduleDraw = useCallback(() => {
        if (frameRef.current !== null) {
            return
        }

        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null
            if (!isDrawingRef.current) {
                return
            }

            const nextPoint = pendingPointRef.current
            const prevPoint = lastPointRef.current
            if (!nextPoint || !prevPoint) {
                return
            }

            drawLine(prevPoint, nextPoint)
            lastPointRef.current = nextPoint
            pendingPointRef.current = null

            if (pendingPointRef.current) {
                scheduleDraw()
            }
        })
    }, [drawLine])

    const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const point = getCanvasPoint(event)
        if (!point) {
            return
        }

        event.currentTarget.setPointerCapture(event.pointerId)
        isDrawingRef.current = true
        lastPointRef.current = point
        pendingPointRef.current = point

        drawLine(point, point)
    }, [drawLine, getCanvasPoint])

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) {
            return
        }

        const point = getCanvasPoint(event)
        if (!point) {
            return
        }

        pendingPointRef.current = point
        scheduleDraw()
    }, [getCanvasPoint, scheduleDraw])

    const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) {
            return
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }

        isDrawingRef.current = false
        lastPointRef.current = null
        pendingPointRef.current = null

        commitMaskHistory()
    }, [commitMaskHistory])

    const restoreHistoryAt = useCallback((targetIndex: number) => {
        const maskCanvas = maskCanvasRef.current
        if (!maskCanvas || targetIndex < 0 || targetIndex >= history.length) {
            return
        }

        const maskCtx = maskCanvas.getContext('2d')
        if (!maskCtx) {
            return
        }

        const snapshot = history[targetIndex]
        maskCtx.putImageData(snapshot, 0, 0)
        setHistoryIndex(targetIndex)
    }, [history])

    const handleUndo = useCallback(() => {
        if (!canUndo) {
            return
        }
        restoreHistoryAt(historyIndex - 1)
    }, [canUndo, historyIndex, restoreHistoryAt])

    const handleRedo = useCallback(() => {
        if (!canRedo) {
            return
        }
        restoreHistoryAt(historyIndex + 1)
    }, [canRedo, historyIndex, restoreHistoryAt])

    const handleClear = useCallback(() => {
        const maskCanvas = maskCanvasRef.current
        if (!maskCanvas) {
            return
        }

        const maskCtx = maskCanvas.getContext('2d')
        if (!maskCtx) {
            return
        }

        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
        commitMaskHistory()
    }, [commitMaskHistory])

    const exportCompositedFile = useCallback(async () => {
        const image = imageRef.current
        const maskCanvas = maskCanvasRef.current
        if (!image || !maskCanvas) {
            return null
        }

        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = maskCanvas.width
        outputCanvas.height = maskCanvas.height

        const outputCtx = outputCanvas.getContext('2d')
        if (!outputCtx) {
            return null
        }

        outputCtx.drawImage(image, 0, 0, outputCanvas.width, outputCanvas.height)
        outputCtx.drawImage(maskCanvas, 0, 0)

        const blob = await new Promise<Blob | null>((resolve) => {
            outputCanvas.toBlob((value) => resolve(value), 'image/png')
        })

        if (!blob) {
            return null
        }

        return new File([blob], `inpaint-${Date.now()}.png`, { type: 'image/png' })
    }, [])

    const handleGenerate = useCallback(async () => {
        const trimmedPrompt = prompt.trim()
        if (!trimmedPrompt) {
            toast.warning('请输入提示词')
            return
        }

        setIsGenerating(true)

        try {
            const file = await exportCompositedFile()
            if (!file) {
                toast.error('导出重绘图片失败，请重试')
                return
            }

            await onGenerate({ file, prompt: trimmedPrompt })
            onOpenChange(false)
        } finally {
            setIsGenerating(false)
        }
    }, [exportCompositedFile, onGenerate, onOpenChange, prompt])

    const actionText = useMemo(() => {
        return tool === 'brush' ? '画笔模式' : '橡皮擦模式'
    }, [tool])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[min(1100px,96vw)] max-h-[92vh] overflow-hidden bg-slate-50 p-0">
                <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                    <DialogHeader className="space-y-1">
                        <DialogTitle>重绘</DialogTitle>
                        <DialogDescription>
                            在画布上标记需要修复的区域，设置提示词后生成。当前固定使用豆包 Seedream。
                        </DialogDescription>
                    </DialogHeader>

                    <DialogClose className="static rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                        <IconX size={18} />
                    </DialogClose>
                </div>

                <div className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="rounded-xl border border-slate-200 bg-slate-900 p-3">
                        <div className="relative mx-auto w-full max-h-[65vh] overflow-auto">
                            <div className="relative mx-auto" style={{ width: canvasSize.width || '100%', height: canvasSize.height || 420 }}>
                                <canvas
                                    ref={baseCanvasRef}
                                    className="absolute inset-0 h-full w-full"
                                />
                                <canvas
                                    ref={maskCanvasRef}
                                    className="absolute inset-0 h-full w-full touch-none"
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerCancel={handlePointerUp}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-700">工具</div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    unstyled
                                    className={`h-8 rounded-lg border px-2 text-xs ${tool === 'brush' ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-600'}`}
                                    onClick={() => setTool('brush')}
                                >
                                    画笔
                                </Button>
                                <Button
                                    unstyled
                                    className={`h-8 rounded-lg border px-2 text-xs ${tool === 'eraser' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-600'}`}
                                    onClick={() => setTool('eraser')}
                                >
                                    橡皮擦
                                </Button>
                            </div>
                            <div className="text-xs text-slate-500">当前：{actionText}</div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-700">笔刷大小</div>
                            <Input
                                type="range"
                                min={8}
                                max={72}
                                step={1}
                                value={brushSize}
                                onChange={(event) => {
                                    const next = Number(event.target.value)
                                    setBrushSize(Number.isFinite(next) ? next : 24)
                                }}
                            />
                            <div className="text-xs text-slate-500">{brushSize}px</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                unstyled
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                                onClick={handleUndo}
                                disabled={!canUndo}
                            >
                                撤销
                            </Button>
                            <Button
                                unstyled
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                                onClick={handleRedo}
                                disabled={!canRedo}
                            >
                                重做
                            </Button>
                        </div>

                        <Button
                            unstyled
                            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                            onClick={handleClear}
                        >
                            清空
                        </Button>

                        <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-700">提示词</div>
                            <Textarea
                                rows={5}
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                placeholder="请输入你想修复的内容描述"
                                className="border-slate-200 bg-white text-slate-700 placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-200 bg-white px-5 py-4">
                    <Button
                        variant="blue"
                        size="sm"
                        loading={isGenerating}
                        onClick={handleGenerate}
                        disabled={!imageUrl || !canvasSize.width}
                    >
                        生成
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
})

InpaintDialog.displayName = 'InpaintDialog'
