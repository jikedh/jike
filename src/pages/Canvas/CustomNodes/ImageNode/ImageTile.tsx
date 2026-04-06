type ImageTileProps = {
    url: string
    index: number
    isBroken: boolean
    onError: (index: number) => void
    onClick?: (e: React.MouseEvent) => void
    className?: string
}

export const ImageTile = ({ url, index, isBroken, onError, onClick, className }: ImageTileProps) => {
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
            onClick={onClick}
            style={{ cursor: onClick ? 'pointer' : undefined }}
        />
    )
}
