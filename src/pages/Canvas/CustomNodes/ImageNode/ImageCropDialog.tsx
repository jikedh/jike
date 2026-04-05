import { IconX } from '@tabler/icons-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

import { createCroppedImageFile } from './utils/cropImage'

type CropRatioKey = 'free' | '1:1' | '4:3' | '16:9' | '3:4' | '9:16'

type ImageCropDialogProps = {
    open: boolean
    imageUrl?: string
    onOpenChange: (open: boolean) => void
    onConfirm: (file: File) => Promise<void>
}

const ratioOptions: Array<{ value: CropRatioKey; label: string; aspect?: number }> = [
    { value: 'free', label: '自由裁剪' },
    { value: '1:1', label: '1:1', aspect: 1 },
    { value: '4:3', label: '4:3', aspect: 4 / 3 },
    { value: '16:9', label: '16:9', aspect: 16 / 9 },
    { value: '3:4', label: '3:4', aspect: 3 / 4 },
    { value: '9:16', label: '9:16', aspect: 9 / 16 },
]

/**
 * 图片裁剪弹窗。
 * 负责展示裁剪面板、切换裁剪比例，并在确认时输出裁剪后的文件。
 */
export const ImageCropDialog = memo(({ open, imageUrl, onOpenChange, onConfirm }: ImageCropDialogProps) => {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [cropRatio, setCropRatio] = useState<CropRatioKey>('free')
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const selectedRatio = useMemo(() => {
        return ratioOptions.find((item) => item.value === cropRatio) ?? ratioOptions[0]
    }, [cropRatio])

    const aspect = selectedRatio.aspect

    useEffect(() => {
        if (!open) {
            return
        }

        // 每次打开都重置为更稳妥的初始状态，避免上一次裁剪位置残留。
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setCropRatio('free')
        setCroppedAreaPixels(null)
        setIsSubmitting(false)
    }, [open, imageUrl])

    const handleCropComplete = useCallback((_: Area, areaPixels: Area) => {
        setCroppedAreaPixels(areaPixels)
    }, [])

    const handleConfirm = useCallback(async () => {
        if (!imageUrl || !croppedAreaPixels) {
            return
        }

        setIsSubmitting(true)

        try {
            const croppedFile = await createCroppedImageFile(
                imageUrl,
                croppedAreaPixels,
                `cropped-${Date.now()}.png`,
            )

            await onConfirm(croppedFile)
            onOpenChange(false)
        } catch (error: any) {
            console.error('裁剪确认失败:', error)
        } finally {
            setIsSubmitting(false)
        }
    }, [croppedAreaPixels, imageUrl, onConfirm, onOpenChange])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[min(980px,96vw)] max-h-[92vh] overflow-hidden bg-slate-50 p-0">
                <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                    <DialogHeader className="space-y-1">
                        <DialogTitle>裁剪图片</DialogTitle>
                        <DialogDescription>
                            选择裁剪比例，拖动图片并调整缩放后，确认生成新的裁剪结果。
                        </DialogDescription>
                    </DialogHeader>

                    <DialogClose className="static rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                        <IconX size={18} />
                    </DialogClose>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="relative min-h-130 overflow-hidden rounded-xl bg-slate-900">
                            {imageUrl ? (
                                <Cropper
                                    image={imageUrl}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={aspect}
                                    onCropChange={setCrop}
                                    onCropComplete={handleCropComplete}
                                    onZoomChange={setZoom}
                                    restrictPosition={false}
                                    showGrid
                                />
                            ) : (
                                <div className="flex h-full min-h-130 items-center justify-center text-sm text-slate-300">
                                    暂无可裁剪图片
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-slate-700">裁剪比例</div>
                                <Select value={cropRatio} onValueChange={(value) => setCropRatio(value as CropRatioKey)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="选择比例" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ratioOptions.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                                    <span>缩放</span>
                                    <span className="text-slate-500">{Math.round(zoom * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.01}
                                    value={zoom}
                                    onChange={(event) => setZoom(Number(event.target.value))}
                                    className="w-full"
                                />
                            </div>

                            <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600">
                                当前模式：{selectedRatio.label}
                                <br />
                                确认后会生成裁剪文件，并交给画布节点流程创建新的子节点。
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-200 bg-white px-5 py-4">
                    <Button
                        variant="default"
                        size="sm"
                        loading={isSubmitting}
                        disabled={!imageUrl || !croppedAreaPixels}
                        onClick={handleConfirm}
                    >
                        确认裁剪
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
})

ImageCropDialog.displayName = 'ImageCropDialog'
