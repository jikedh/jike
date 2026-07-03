import {
  IconChevronDown,
  IconDownload,
  IconPhoto,
  IconRefresh,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateThumbnailWithFormat, uploadFileToOSS } from "service/oss";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { getMediaSequence } from "shared/utils/mediaSequence";
import { cn, downloadImageFromUrl } from "shared/utils/utils";
import { toast } from "sonner";
import { ImageTile } from "./ImageTile";

type ImageItem = {
  url: string; // 远程 OSS URL
  remoteUrl?: string; // 远程持久化 URL
};

type CollapsibleImageGalleryProps = {
  images: ImageItem[];
  onReorder?: (fromIndex: number) => void;
  nodeId?: string;
  updateImageNodeData?: (nodeId: string, patch: any) => void;
  onExpandedChange?: (expanded: boolean) => void;
  isNodeActive?: boolean;
  frameSize?: {
    width: number;
    height: number;
  };
};

const STACK_CARD_LIMIT = 4;
const COLLAPSED_STACK_X_RATIO = [0, 24 / 180, 44 / 180, 60 / 180];
const COLLAPSED_STACK_SCALE = [1, 0.92, 0.84, 0.76];
const COLLAPSED_STACK_BRIGHTNESS = [1, 0.65, 0.4, 0.2];

const getCollapsedOffsetX = (index: number, cardWidth: number) => {
  const base = COLLAPSED_STACK_X_RATIO[index];
  if (typeof base === "number") {
    return Math.round(cardWidth * base);
  }
  return Math.min(Math.round(cardWidth * (0.33 + (index - 3) * 0.06)), 92);
};

const getCollapsedScale = (index: number) => {
  return COLLAPSED_STACK_SCALE[index] ?? 0.72;
};

const getCollapsedBrightness = (index: number) => {
  return COLLAPSED_STACK_BRIGHTNESS[index] ?? 0.18;
};

type ExpandedSlot = {
  row: number;
  col: number;
  order: number;
};

type ExpandedCardLayout = {
  width: number;
  height: number;
  x: number;
  y: number;
  order: number;
};

const getExpandedSlots = (totalCount: number) => {
  if (totalCount <= 0) {
    return [];
  }

  return Array.from({ length: totalCount }, (_, index) => ({
    // 固定两行，索引按列从左往右递增：
    // 0 在左下，1 在左上，2 在第二列下方，3 在第二列上方...
    row: totalCount === 1 ? 0 : index % 2,
    col: totalCount === 1 ? 0 : Math.floor(index / 2),
    order: index,
  }));
};

const getExpandedCardLayouts = (
  totalCount: number,
  maxWidth: number,
  maxHeight: number,
  expandedGap: number,
) => {
  const slots = getExpandedSlots(totalCount);

  return slots.map<ExpandedCardLayout>((_, index) => {
    const slot = slots[index];
    return {
      width: maxWidth,
      height: maxHeight,
      x: (slot?.col ?? 0) * (maxWidth + expandedGap),
      y: slot?.row === 1 ? -(maxHeight + expandedGap) : 0,
      order: slot?.order ?? index,
    };
  });
};

const getStackCardStyle = (
  index: number,
  isExpanded: boolean,
  cardWidth: number,
  cardHeight: number,
  totalCount: number,
  expandedLayouts: ExpandedCardLayout[],
) => {
  if (isExpanded) {
    const layout = expandedLayouts[index];

    if (!layout) {
      return {
        transform: "translate(0px, 0px) scale(1)",
        filter: "brightness(1)",
        opacity: 1,
        zIndex: 1,
      } as const;
    }

    return {
      transform: `translate(${layout.x}px, ${layout.y}px) scale(1)`,
      filter: "brightness(1)",
      opacity: 1,
      zIndex: Math.max(1, totalCount - index + 1),
    } as const;
  }

  const collapsedIndex = Math.min(index, STACK_CARD_LIMIT - 1);

  return {
    transform: `translate(${getCollapsedOffsetX(collapsedIndex, cardWidth)}px, 0px) scale(${getCollapsedScale(collapsedIndex)})`,
    filter: `brightness(${getCollapsedBrightness(collapsedIndex)})`,
    opacity: index < STACK_CARD_LIMIT ? 1 : 0,
    zIndex: index < STACK_CARD_LIMIT ? 10 - collapsedIndex : 1,
  } as const;
};

/**
 * 可折叠图片集合卡片
 * - collapsed：仅展示封面图 + 右上角数量徽标
 * - expanded：使用同一套浮层卡片语言展开全部图片
 * - 点击展开态中的图片，可将其移动到首位作为新封面
 * - 优先使用本地路径，如果不存在则使用远程 URL
 * - 刷新按钮：重新上传图片到 OSS
 */
export const CollapsibleImageGallery = memo(
  ({
    images,
    onReorder,
    nodeId,
    updateImageNodeData,
    onExpandedChange,
    isNodeActive = false,
    frameSize,
  }: CollapsibleImageGalleryProps) => {
    // 默认折叠，仅展示封面
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // 记录加载失败索引，统一渲染占位（使用 ref 避免频繁 setState）
    const brokenIndexesRef = useRef<Set<number>>(new Set());
    const [, forceUpdate] = useState(0);
    // 记录正在刷新的图片索引
    const refreshingIndexesRef = useRef<Set<number>>(new Set());
    const [, forceRefreshUpdate] = useState(0);

    const totalCount = images.length;

    // 使用远程 URL - 用 useMemo 缓存
    // OSS 图片使用缩略图展示，减少带宽占用，提升加载速度
    const displayUrls = useMemo(() => {
      return images.map((item) => {
        const originalUrl = item.url ?? "";

        // OSS 图片生成缩略图（使用 WIDTH_200 + webp，体积最小）
        if (originalUrl && originalUrl.includes("oss-cn-")) {
          return generateThumbnailWithFormat(originalUrl, "WIDTH_200", "webp");
        }

        return originalUrl;
      });
    }, [images]);

    const badgeText = `${totalCount}张`;
    const cardWidth = frameSize?.width ?? 180;
    const cardHeight = frameSize?.height ?? 220;
    const expandedGap = useMemo(() => {
      return Math.max(
        12,
        Math.min(22, Math.round(Math.min(cardWidth, cardHeight) * 0.07)),
      );
    }, [cardHeight, cardWidth]);
    const expandedLayouts = useMemo(() => {
      return getExpandedCardLayouts(
        images.length,
        cardWidth,
        cardHeight,
        expandedGap,
      );
    }, [cardHeight, cardWidth, expandedGap, images.length]);
    const renderedItems = useMemo(() => {
      return images.map((item, index) => ({
        item,
        displayUrl: displayUrls[index] ?? "",
        index,
      }));
    }, [displayUrls, images]);

    // 切换折叠/展开
    const handleToggleExpanded = useCallback((e: any) => {
      e.stopPropagation();
      if (!isNodeActive) {
        return;
      }
      setIsExpanded((prev) => !prev);
    }, [isNodeActive]);

    useEffect(() => {
      onExpandedChange?.(isExpanded);
    }, [isExpanded, onExpandedChange]);

    useEffect(() => {
      if (!isNodeActive && isExpanded) {
        setIsExpanded(false);
      }
    }, [isExpanded, isNodeActive]);

    useEffect(() => {
      if (!isExpanded && hoveredIndex !== null) {
        setHoveredIndex(null);
      }
    }, [hoveredIndex, isExpanded]);

    useEffect(() => {
      return () => {
        onExpandedChange?.(false);
      };
    }, [onExpandedChange]);

    useEffect(() => {
      if (!isExpanded) {
        return;
      }

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (target && containerRef.current?.contains(target)) {
          return;
        }

        setIsExpanded(false);
      };

      document.addEventListener("pointerdown", handlePointerDown);
      return () => {
        document.removeEventListener("pointerdown", handlePointerDown);
      };
    }, [isExpanded]);

    const handleImageError = useCallback((index: number) => {
      // 使用 ref + forceUpdate 代替 setState，避免频繁重渲染
      if (!brokenIndexesRef.current.has(index)) {
        brokenIndexesRef.current.add(index);
        forceUpdate((n) => n + 1);
      }
    }, []);

    const isBroken = useCallback((index: number) => {
      return brokenIndexesRef.current.has(index);
    }, []);

    const isRefreshing = useCallback((index: number) => {
      return refreshingIndexesRef.current.has(index);
    }, []);

    // 刷新图片：重新上传到 OSS
    const handleRefreshImage = useCallback(
      async (e: React.MouseEvent, index: number) => {
        e.stopPropagation();

        if (!nodeId || !updateImageNodeData || !images[index]?.url) {
          return;
        }

        const item = images[index];

        // 使用 ref 追踪刷新状态，避免频繁 setState
        refreshingIndexesRef.current.add(index);
        forceRefreshUpdate((n) => n + 1);

        try {
          const response = await fetch(item.url);
          const blob = await response.blob();
          let file = new File([blob], `image-${index}.png`, {
            type: blob.type || "image/png",
          });

          // 检查文件大小，大于10MB时压缩
          if (file.size > MAX_IMAGE_SIZE_MB) {
            file = await compressImage(file);
          }

          // 上传到 OSS
          const ossResult = await uploadFileToOSS(file);
          if (!ossResult.url) {
            throw new Error("上传到 OSS 失败");
          }

          // 更新节点数据
          const newImages = [...images];
          newImages[index] = {
            ...newImages[index],
            url: ossResult.url,
            remoteUrl: ossResult.url,
          };

          updateImageNodeData(nodeId, {
            result: {
              type: "image",
              data: newImages,
            },
          });

          // 移除加载失败标记
          brokenIndexesRef.current.delete(index);
        } catch (error) {
          console.error("[刷新图片] 刷新失败:", error);
        } finally {
          refreshingIndexesRef.current.delete(index);
          forceRefreshUpdate((n) => n + 1);
        }
      },
      [images, nodeId, updateImageNodeData],
    );

    const handleImageClick = useCallback(
      (e: any, index: number) => {
        e.stopPropagation();
        if (index === 0) return;
        if (onReorder) {
          onReorder(index);
        }
        setIsExpanded(false);
      },
      [onReorder],
    );

    const handleDownloadImage = useCallback(
      async (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const imageUrl = images[index]?.remoteUrl || images[index]?.url;

        if (!imageUrl) {
          toast.info("暂无可下载图片");
          return;
        }

        try {
          await downloadImageFromUrl(imageUrl);
          toast.success("下载成功");
        } catch (error) {
          const message = error instanceof Error ? error.message : "下载失败";
          toast.error(message);
        }
      },
      [images],
    );

    return (
      <div
        ref={containerRef}
        className={cn(
          "nopan relative h-full w-full",
          totalCount > 1 && !isExpanded ? "p-1" : "p-0",
          isExpanded ? "z-40 overflow-visible" : "overflow-hidden",
        )}
      >
        <div className="relative h-full w-full overflow-visible rounded-lg">
          <div
            className={cn(
              "pointer-events-none absolute left-0 top-[-26px] z-30 flex items-center gap-1.5 text-[12px] font-medium text-white/50 transition-opacity duration-300",
              isExpanded ? "opacity-0" : "opacity-100 delay-200",
            )}
          >
            <IconPhoto size={13} />
            <span>Image</span>
          </div>

          {renderedItems.map(({ item, displayUrl, index }) => {
            const isPrimary = index === 0;
            const isSecondary = index > 0;
            const isFocused = isExpanded && hoveredIndex === index;
            const sequence = getMediaSequence(item, index);
            const shouldUseCardChrome =
              totalCount > 1 && (!isExpanded || isSecondary);
            const cardKey =
              item.remoteUrl || item.url || `image-${index}`;
            const expandedLayout = expandedLayouts[index];
            const stackStyle = getStackCardStyle(
              index,
              isExpanded,
              cardWidth,
              cardHeight,
              totalCount,
              expandedLayouts,
            );
            const transitionDelay = isExpanded
              ? `${(expandedLayout?.order ?? index) * 55}ms`
              : `${Math.max(0, totalCount - index - 1) * 28}ms`;

            return (
              <div
                key={cardKey}
                className={cn(
                  "group/card absolute left-0 top-0 rounded-[14px] transition-[transform,filter,opacity,box-shadow,border-color,width,height] duration-[700ms] ease-[cubic-bezier(0.2,0.85,0.15,1)] will-change-[transform,filter,opacity,width,height]",
                  shouldUseCardChrome &&
                  "border border-white/8 bg-[#1a1a1a] shadow-[0_10px_30px_rgba(0,0,0,0.28)]",
                  isExpanded || isPrimary
                    ? "pointer-events-auto"
                    : "pointer-events-none",
                  isExpanded &&
                  isSecondary &&
                  "hover:border-white/14 hover:shadow-[0_18px_36px_rgba(0,0,0,0.34)]",
                  isSecondary &&
                  isFocused &&
                  "shadow-[0_24px_48px_rgba(0,0,0,0.38)]",
                )}
                onMouseEnter={() => {
                  if (isExpanded) {
                    setHoveredIndex(isSecondary ? index : null);
                  }
                }}
                onMouseLeave={() => {
                  if (hoveredIndex === index) {
                    setHoveredIndex(null);
                  }
                }}
                style={{
                  width:
                    isExpanded && isSecondary
                      ? (expandedLayout?.width ?? cardWidth)
                      : cardWidth,
                  height:
                    isExpanded && isSecondary
                      ? (expandedLayout?.height ?? cardHeight)
                      : cardHeight,
                  ...(isExpanded && isPrimary
                    ? {
                      transform: "translate(0px, 0px) scale(1)",
                      filter: "brightness(1)",
                      opacity: 1,
                      zIndex: totalCount + 6,
                    }
                    : stackStyle),
                  transitionDelay,
                  zIndex:
                    isExpanded && isPrimary
                      ? totalCount + 6
                      : isSecondary && isFocused
                        ? totalCount + 12
                        : stackStyle.zIndex,
                }}
              >
                <div
                  className={cn(
                    "relative h-full w-full overflow-hidden rounded-[13px]",
                    shouldUseCardChrome && "bg-[#111]",
                    isExpanded && isSecondary && "cursor-pointer",
                  )}
                  onClick={(e) => {
                    if (isExpanded) {
                      handleImageClick(e, index);
                    }
                  }}
                >
                  <div
                    className={cn(
                      "h-full w-full transition-transform duration-300 ease-out",
                      isSecondary && isFocused && "scale-[1.2]",
                    )}
                  >
                    <ImageTile
                      url={displayUrl}
                      index={index}
                      isBroken={isBroken(index)}
                      onError={handleImageError}
                      aspectRatio={cardWidth / cardHeight}
                      className={cn(
                        "rounded-[13px]",
                        isExpanded && !isPrimary
                          ? "object-contain"
                          : "object-cover",
                      )}
                    />
                  </div>

                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 rounded-[13px] ring-0 transition-all duration-200",
                      isSecondary &&
                      isFocused &&
                      "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
                    )}
                  />

                  <div className="absolute right-2 top-2 z-30 flex items-center gap-1.5">
                    {totalCount > 1 && (
                      <span className="pointer-events-none inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-white/12 bg-black/60 px-2 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                        #{sequence}
                      </span>
                    )}

                    {isPrimary && totalCount > 1 && (
                      <button
                        type="button"
                        disabled={!isNodeActive}
                        onClick={handleToggleExpanded}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="nodrag inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-black/60 px-3 py-2 text-[11px] font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        aria-label={
                          isExpanded
                            ? `收起图片集合，共${badgeText}`
                            : `展开图片集合，共${badgeText}`
                        }
                      >
                        <span>{badgeText}</span>
                        <IconChevronDown
                          size={13}
                          className={cn(
                            "transition-transform duration-200",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>
                    )}

                    {isExpanded && isSecondary && (
                      <button
                        type="button"
                        className={cn(
                          "nodrag inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full border border-white/8 bg-[#101014]/82 px-0 text-white/62 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-md transition-all duration-200 hover:border-white/14 hover:bg-[#1a1a20]/92 hover:text-white",
                          isFocused ? "opacity-100" : "opacity-0",
                        )}
                        onClick={(e) => handleDownloadImage(e, index)}
                        aria-label={`下载图片${index + 1}`}
                      >
                        <IconDownload size={14} />
                      </button>
                    )}
                  </div>

                  {nodeId && updateImageNodeData && (
                    <button
                      type="button"
                      onClick={(e) => handleRefreshImage(e, index)}
                      disabled={isRefreshing(index)}
                      className={cn(
                        "nodrag absolute left-2 top-2 z-30 cursor-pointer rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-50",
                        isExpanded
                          ? isSecondary && isFocused
                            ? "opacity-100"
                            : "opacity-0"
                          : isPrimary
                            ? "opacity-0 group-hover/card:opacity-100"
                            : "opacity-0",
                      )}
                      aria-label="刷新图片"
                    >
                      <IconRefresh
                        size={14}
                        className={isRefreshing(index) ? "animate-spin" : ""}
                      />
                    </button>
                  )}

                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/58 via-black/10 to-transparent transition-opacity duration-300",
                      isExpanded ? "opacity-0" : "opacity-100",
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

CollapsibleImageGallery.displayName = "CollapsibleImageGallery";
