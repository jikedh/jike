type ImageTileProps = {
    url: string
    index: number
    isBroken: boolean
    onError: (index: number) => void
    className?: string
}

/**
 * 单张图片单元
 * - 正常时渲染图片
 * - 加载失败时渲染占位块（避免网格塌陷）
 */
export const ImageTile = ({ url, index, isBroken, onError, className }: ImageTileProps) => {
    if (isBroken) {
        return (
            <div
                className={`h-full w-full rounded-md border border-border/80 bg-muted/40 text-muted-foreground flex items-center justify-center text-[11px] ${className ?? ''}`}
                role="img"
                aria-label={`图片${index + 1}加载失败`}
            >
                图片加载失败
            </div>
        )
    }

    return (
        <img
            src={url}
            alt={`生成图片-${index + 1}`}
            className={`h-full w-full object-cover ${className ?? ''}`}
            loading="lazy"
            onError={() => onError(index)}
        />
    )
}
