type ImageTileProps = {
  url: string;
  index: number;
  isBroken: boolean;
  onError: (index: number) => void;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  /** 预设宽高比，用于在图片加载前预留空间，减少 CLS */
  aspectRatio?: number;
};

export const ImageTile = ({
  url,
  index,
  isBroken,
  onError,
  onClick,
  className,
  aspectRatio,
}: ImageTileProps) => {
  if (isBroken) {
    return (
      <div
        className={`h-full w-full rounded-md border border-border/80 bg-muted/40 text-muted-foreground flex items-center justify-center text-[11px] ${className ?? ""}`}
        role="img"
        aria-label={`图片${index + 1}加载失败`}
      >
        图片加载失败
      </div>
    );
  }

  // 使用 aspect-ratio CSS 属性预留空间，消除 Layout Shift
  const containerStyle: React.CSSProperties = {
    aspectRatio: aspectRatio ? String(aspectRatio) : undefined,
  };

  return (
    <div className="h-full w-full overflow-hidden" style={containerStyle}>
      <img
        src={url}
        alt={`生成图片-${index + 1}`}
        className={`h-full w-full object-contain ${className ?? ""}`}
        loading="lazy"
        onError={() => onError(index)}
        onClick={onClick}
        style={{ cursor: onClick ? "pointer" : undefined }}
      />
    </div>
  );
};
