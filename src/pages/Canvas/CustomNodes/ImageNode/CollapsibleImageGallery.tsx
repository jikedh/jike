import { useMemo, useState } from 'react'
import { ImageTile } from './ImageTile'

type ImageItem = { url?: string }

type CollapsibleImageGalleryProps = {
    images: ImageItem[]
    onReorder?: (fromIndex: number) => void
}

/**
 * 可折叠图片集合卡片
 * - collapsed：仅展示封面图 + 右上角数量徽标
 * - expanded：2 列网格展示全部图片
 * - 点击展开态中的图片，可将其移动到首位作为新封面
 */
export const CollapsibleImageGallery = ({ images, onReorder }: CollapsibleImageGalleryProps) => {
    // 默认折叠，仅展示封面
    const [isExpanded, setIsExpanded] = useState(false)
    // 记录加载失败索引，统一渲染占位
    const [brokenImageIndexes, setBrokenImageIndexes] = useState<number[]>([])

    const totalCount = images.length
    const coverImage = images[0]?.url ?? ''
    const badgeText = `${totalCount}张`

    // 当前设计要求：1/2/3/4/5+ 都使用 2 列（1 张时为单列）
    const expandedGridColsClass = useMemo(() => {
        if (totalCount <= 1) return 'grid-cols-1'
        return 'grid-cols-2'
    }, [totalCount])

    // 5+ 图片时适度压缩间距，提升信息密度
    const expandedGridGapClass = totalCount > 4 ? 'gap-0.5' : 'gap-1'

    // 切换折叠/展开
  const handleToggleExpanded = (e: any) => {
        e.stopPropagation()
        setIsExpanded((prev) => !prev)
    }

    const handleImageError = (index: number) => {
        setBrokenImageIndexes((prev) => (prev.includes(index) ? prev : [...prev, index]))
    }

    const handleImageClick = (e: any, index: number) => {
        e.stopPropagation()
        if (index === 0) return
        if (onReorder) {
            onReorder(index)
        }
        setIsExpanded(false)
    }

    return (
        <div className={`nopan h-full w-full overflow-hidden rounded-md bg-background p-1 ${isExpanded && totalCount > 4 ? 'nowheel' : ''}`}>
            <div className="relative h-full w-full overflow-hidden rounded-lg bg-background shadow-sm">
                {/* 右上角图片数量徽标：用于展开/收起切换 */}
                <button
                    type="button"
                    onClick={handleToggleExpanded}
            onDoubleClick={(e) => e.stopPropagation()}
            className=" absolute right-2 top-2 z-20 cursor-pointer rounded-lg bg-black/60 px-3 py-2 text-[11px] font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    aria-label={isExpanded ? `收起图片集合，共${badgeText}` : `展开图片集合，共${badgeText}`}
                >
                    {badgeText}
                </button>

                {/* 折叠态：仅显示首图封面 */}
                <div
                    className={`absolute inset-0 transition-all duration-200 ease-out ${isExpanded
                            ? 'pointer-events-none translate-y-1 scale-[0.98] opacity-0'
                            : 'translate-y-0 scale-100 opacity-100'
                        }`}
                >
                    <ImageTile
                        url={coverImage}
                        index={0}
                        isBroken={brokenImageIndexes.includes(0)}
                        onError={handleImageError}
                        className="rounded-lg"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-black/25 to-transparent" />
                </div>

                {/* 展开态：2 列网格展示全部图片 */}
                <div
                    className={`absolute inset-0 transition-all duration-200 ease-out ${isExpanded
                            ? 'translate-y-0 scale-100 opacity-100'
                            : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0'
                        }`}
                >
                    <div className={`h-full w-full ${totalCount > 4 ? 'overflow-y-auto pr-0.5' : ''}`}>
                        <div className={`grid h-full w-full p-1 ${expandedGridColsClass} ${expandedGridGapClass}`}>
                            {images.map((item, index) => (
                                <div key={`${item.url}-${index}`} className={totalCount === 1 ? 'min-h-0' : 'min-h-13'}>
                                    <ImageTile
                                        url={item.url ?? ''}
                                        index={index}
                                        isBroken={brokenImageIndexes.includes(index)}
                                        onError={handleImageError}
                                        onClick={(e) => handleImageClick(e, index)}
                                        className="rounded-md"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
