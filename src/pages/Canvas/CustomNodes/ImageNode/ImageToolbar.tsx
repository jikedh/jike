import {
  Icon3dRotate,
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

import { uploadFileToOSS } from '@/utils/oss'
import { downloadImageFromUrl } from '@/lib/utils'
import { useCanvasFlowStore } from '@/store/canvasFlowStore'
import type { ImageGenerationNode } from '@/types/flow'

import { ImageCropDialog } from './ImageCropDialog'
import { InpaintDialog } from './InpaintDialog'

type ImageToolbarProps = {
    nodeId: string
    data: ImageGenerationNode
    selected: boolean
    onDuplicate?: () => void
    onDelete?: () => void
    onCrop?: (file: File) => Promise<void>
}

type ActionKey = 'upload' | 'erase' | 'enhance' | 'outpaint' | 'crop' | 'download' | 'preview' | 'panorama'

/**
 * 图片节点工具栏组件
 * 职责：
 * - 提供上传,擦除，增强，扩图，裁剪，下载,全屏查看的操作按钮
 * - 处理工具栏按钮交互反馈
 * - 基于 yet-another-react-lightbox 提供放大查看能力
 * - 支持查看全景图功能
 */
export const ImageToolbar = memo(({ nodeId, data, selected, onDelete, onCrop }: ImageToolbarProps) => {
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)
    const [isInpaintDialogOpen, setIsInpaintDialogOpen] = useState(false)
    const [isInpaintGenerating, setIsInpaintGenerating] = useState(false)

    // 隐藏的文件输入框引用
    const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 更新节点数据 & 全景图查看器
    const updateImageNodeData = useCanvasFlowStore((state) => state.updateImageNodeData)
    const startImageGeneration = useCanvasFlowStore((state) => state.startImageGeneration)
  const addNode = useCanvasFlowStore((state) => state.addNode)
  const onConnect = useCanvasFlowStore((state) => state.onConnect)
  const openPanoramaViewer = useCanvasFlowStore((state) => state.openPanoramaViewer)

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
          { key: 'panorama' as const, label: '查看全景图', icon: Icon3dRotate },
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

        setIsUploading(true)

        try {
            const result = await uploadFileToOSS(file)
            const uploadedUrl = result.url

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

    const handleAction = async (actionKey: ActionKey) => {
        if (actionKey === 'upload') {
            handleUploadClick()
            return
        }

        if (actionKey === 'erase') {
            if (!currentImageUrl) {
                toast.info('暂无可重绘图片')
                return
            }

            setIsInpaintDialogOpen(true)
            return
        }

        if (actionKey === 'crop') {
            if (!currentImageUrl) {
                toast.info('暂无可裁剪图片')
                return
            }

            setIsCropDialogOpen(true)
            return
        }

        if (actionKey === 'download') {
            if (!currentImageUrl) {
                toast.info('暂无可下载图片')
                return
            }

            if (isDownloading) {
                return
            }

            setIsDownloading(true)
            try {
                await downloadImageFromUrl(currentImageUrl)
                toast.success('下载成功')
            } catch (error) {
                const message = error instanceof Error ? error.message : '下载失败'
                toast.error(message)
                console.error('下载图片失败:', error)
            } finally {
                setIsDownloading(false)
            }
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

        if (actionKey === 'panorama') {
            if (!currentImageUrl) {
                toast.info('暂无可查看图片')
                return
            }

            // 打开全景图查看器，并把当前节点 ID 一起传过去，便于后续创建子节点
            openPanoramaViewer(currentImageUrl, nodeId)
            return
        }

        toast.info('功能开发中...')
    }

    const handleInpaintGenerate = async ({ file, prompt }: { file: File; prompt: string }) => {
        const trimmedPrompt = prompt.trim()
        if (!trimmedPrompt) {
            toast.warning('请输入提示词')
            return
        }

        const suffix = '修复 mask 区域，使其和周围环境自然融合，保留图像原有风格。'
        const finalPrompt = `${trimmedPrompt} ${suffix}`

        setIsInpaintGenerating(true)

        try {
            const uploadResult = await uploadFileToOSS(file)
            const inpaintImageUrl = uploadResult.url

            if (!inpaintImageUrl) {
                toast.warning('上传成功但未返回图片地址')
                return
            }

          const sourceNode = useCanvasFlowStore.getState().nodes.find((node) => node.id === nodeId)
          if (!sourceNode || sourceNode.type !== 'imageNode') {
            toast.error('当前图片节点不存在')
            return
          }

          const childPosition = {
            x: sourceNode.position.x + (sourceNode.width ?? 350) + 80,
            y: sourceNode.position.y,
          }

          const childId = addNode('image', childPosition)

          onConnect({
            source: nodeId,
            target: childId,
            sourceHandle: 'output',
            targetHandle: 'input',
          })

            // 固定豆包 Seedream，重绘场景走 image_urls 单图输入。
          await startImageGeneration(childId, {
              model: 'doubao-seedream-5-0',
              prompt: finalPrompt,
              image_urls: [inpaintImageUrl],
            })

            toast.success('已开始重绘生成')
        } catch (error: any) {
            console.error('重绘生成失败:', error)
            toast.error(error?.message || '重绘生成失败，请重试')
            throw error
        } finally {
            setIsInpaintGenerating(false)
        }
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
                    const isDisabled = (item.key === 'download' && isDownloading) || (item.key === 'upload' && isUploading) || (item.key === 'crop' && !currentImageUrl)

                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => handleAction(item.key)}
                            disabled={isDisabled}
                            className={`nodrag nopan nowheel inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors ${isDisabled
                                ? 'border-neutral-600 bg-neutral-600/50 text-neutral-400 cursor-not-allowed opacity-50'
                                : isActive
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

            <ImageCropDialog
                open={isCropDialogOpen}
                imageUrl={currentImageUrl}
                onOpenChange={setIsCropDialogOpen}
                onConfirm={async (file) => {
                    if (!onCrop) {
                        toast.info('裁剪功能暂不可用')
                        return
                    }

                    await onCrop(file)
                }}
            />

            <InpaintDialog
                open={isInpaintDialogOpen}
                imageUrl={currentImageUrl}
                onOpenChange={(open) => {
                    if (isInpaintGenerating) {
                        return
                    }

                    setIsInpaintDialogOpen(open)
                }}
                onGenerate={handleInpaintGenerate}
            />
        </>
    )
})

ImageToolbar.displayName = 'ImageToolbar'
