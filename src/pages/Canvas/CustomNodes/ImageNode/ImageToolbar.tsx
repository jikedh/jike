
import {
    IconAspectRatio,
    IconCrop,
    IconDownload,
    IconEraser,
    IconSparkles,
    IconTrash,
    IconUpload,
    IconZoomIn,
} from '@tabler/icons-react'
import { memo, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import Lightbox from 'yet-another-react-lightbox'
// import Captions from 'yet-another-react-lightbox/plugins/captions'
import Download from 'yet-another-react-lightbox/plugins/download'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Share from 'yet-another-react-lightbox/plugins/share'
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow'
// import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import { toast } from 'sonner'

import { uploadImage } from '@/api/ai'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { ImageGenerationNode } from '@/types/flow'

type ImageToolbarProps = {
    nodeId: string
    data: ImageGenerationNode
    selected: boolean
    onDuplicate?: () => void
    onDelete?: () => void
}

type ActionKey = 'upload' | 'erase' | 'enhance' | 'outpaint' | 'crop' | 'download' | 'preview'

/**
 * 图片节点工具栏组件
 * 职责：
 * - 提供上传,擦除，增强，扩图，裁剪，下载,全屏查看的操作按钮
 * - 处理工具栏按钮交互反馈
 * - 基于 yet-another-react-lightbox 提供放大查看能力
 */
export const ImageToolbar = memo(({ nodeId, data, selected, onDelete }: ImageToolbarProps) => {
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    // 隐藏的文件输入框引用
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    // 更新节点数据
    const updateImageNodeData = useCanvasFlowStore((state) => state.updateImageNodeData)

    // 获取所有图片 URL 数组
    const imageUrls = data.result?.data?.map((item) => item.url) ?? []
    const currentImageUrl = imageUrls[0]

    const toolbarActions = useMemo(() => {
        return [
            { key: 'upload' as const, label: '上传', icon: IconUpload },
            { key: 'erase' as const, label: '擦除', icon: IconEraser },
            { key: 'enhance' as const, label: '增强', icon: IconSparkles },
            { key: 'outpaint' as const, label: '扩图', icon: IconAspectRatio },
            { key: 'crop' as const, label: '裁剪', icon: IconCrop },
            { key: 'download' as const, label: '下载', icon: IconDownload },
            { key: 'preview' as const, label: '放大查看', icon: IconZoomIn },
        ]
    }, [])

    // 触发文件选择
    const handleUploadClick = () => {
        if (isUploading) {
            return
        }
        fileInputRef.current?.click()
    }

    // 处理文件上传
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) {
            return
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('purpose', 'generation')

        setIsUploading(true)

        try {
            const response = await uploadImage(formData)
            const uploadedUrl = response?.data?.url

            if (!uploadedUrl) {
                toast.warning('上传成功但未返回图片地址')
                return
            }

            // 将新图片追加到 result.data 数组
            const currentData = data.result?.data ?? []
            updateImageNodeData(nodeId, {
                result: {
                    type: 'image',
                    data: [...currentData, { url: uploadedUrl }],
                },
            })
            toast.success('上传成功')
        } catch (uploadError) {
            console.error('上传图片失败:', uploadError)
            toast.error('上传失败，请重试')
        } finally {
            setIsUploading(false)
            event.target.value = ''
        }
    }

    const handleAction = (actionKey: ActionKey) => {
        if (actionKey === 'upload') {
            handleUploadClick()
            return
        }

        if (actionKey === 'preview') {
            if (!currentImageUrl) {
                toast.info('暂无可预览图片')
                return
            }

            setIsLightboxOpen(true)
            return
        }

        toast.info('功能开发中...')
    }

    const isPreviewActive = isLightboxOpen

    return (
        <>
            {/* 隐藏的文件输入框 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />

            <div
                className={`nodrag nopan nowheel inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/95 px-2 shadow-md ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                {toolbarActions.map((item) => {
                    const Icon = item.icon
                    const isActive = item.key === 'preview' ? isPreviewActive : false

                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => handleAction(item.key)}
                            className={`nodrag nopan nowheel inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors ${isActive
                                ? 'border-neutral-500 bg-neutral-600 text-neutral-100'
                                : 'border-transparent bg-neutral-700 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-600 hover:text-neutral-100 active:border-neutral-400 active:bg-neutral-500 active:text-neutral-50'
                                }`}
                            title={item.label}
                            aria-label={item.label}
                        >
                            <Icon size={24} stroke={1.8} />
                            <span>{item.label}</span>
                        </button>
                    )
                })}

                {/* 分隔线 */}
                <div className="h-5 w-px bg-neutral-600" />

                {/* 删除按钮 */}
                <button
                    type="button"
                    onClick={onDelete}
                    className="nodrag nopan nowheel inline-flex h-8 items-center gap-1 rounded-lg border border-transparent bg-neutral-700 px-2 text-xs font-medium text-neutral-200 transition-colors hover:border-red-500/40 hover:bg-red-500/20 hover:text-red-400 active:bg-red-500/30 active:text-red-300"
                    title="删除节点"
                    aria-label="删除节点"
                >
                    <IconTrash size={24} stroke={1.8} />
                    <span>删除</span>
                </button>
            </div>

            {isLightboxOpen ? (
                <Lightbox
                    open={isLightboxOpen}
                    close={() => {
                        setIsLightboxOpen(false)
                    }}
                    slides={imageUrls.filter((url): url is string => !!url).map((url) => ({ src: url }))}
                    plugins={[Fullscreen, Slideshow, Zoom, Share, Download]}
                    zoom={{ maxZoomPixelRatio: 4, zoomInMultiplier: 2 }}
                    controller={{ closeOnBackdropClick: true }}
                />
            ) : null}
        </>
    )
})

ImageToolbar.displayName = 'ImageToolbar'
