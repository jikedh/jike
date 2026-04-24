import { IconChevronDown, IconRefresh, IconVideo } from "@tabler/icons-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { uploadFileToOSS } from "service/oss";
import { readMediaFromLocal } from "service/projectStorage";
import { cn } from "shared/utils/utils";
import { VideoPlayer } from "@/components/ui/video-player";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

type VideoItem = {
  url: string; // 远程 OSS URL
  format?: string; // 视频格式
  localPath?: string; // 本地相对路径
  localName?: string; // 本地文件�?
  remoteUrl?: string; // 远程持久�?URL
};

type CollapsibleVideoGalleryProps = {
  videos: VideoItem[];
  nodeId?: string;
  updateVideoNodeData?: (nodeId: string, patch: any) => void;
  onExpandedChange?: (expanded: boolean) => void;
  frameSize?: {
    width: number;
    height: number;
  };
};

type ExpandedCardLayout = {
  width: number;
  height: number;
  x: number;
  y: number;
  order: number;
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

const getCollapsedScale = (index: number) => COLLAPSED_STACK_SCALE[index] ?? 0.72;
const getCollapsedBrightness = (index: number) =>
  COLLAPSED_STACK_BRIGHTNESS[index] ?? 0.18;

const getExpandedSlots = (totalCount: number) => {
  if (totalCount <= 0) {
    return [];
  }

  return Array.from({ length: totalCount }, (_, index) => ({
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
 * 可折叠视频集合卡�?
 * - collapsed：仅展示封面视频 + 右上角数量徽�?
 * - expanded�? 列网格展示全部视�?
 * - 点击展开态中的视频，可将其移动到首位作为新封�?
 * - 优先使用本地路径，如果不存在则使用远�?URL
 * - 刷新按钮：重新上传视频到 OSS
 */
export const CollapsibleVideoGallery = memo(
  ({
    videos,
    nodeId,
    updateVideoNodeData,
    onExpandedChange,
    frameSize,
  }: CollapsibleVideoGalleryProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    // 记录加载失败索引，统一渲染占位（使�?ref 避免频繁 setState�?
    const brokenIndexesRef = useRef<Set<number>>(new Set());
    const [, forceUpdate] = useState(0);
    // 记录正在刷新的视频索�?
    const refreshingIndexesRef = useRef<Set<number>>(new Set());
    const [, forceRefreshUpdate] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const totalCount = videos.length;

    const displayUrls = useMemo(() => {
      return videos.map((item) => item.url ?? "");
    }, [videos]);
    const badgeText = `${totalCount}个`;
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
        videos.length,
        cardWidth,
        cardHeight,
        expandedGap,
      );
    }, [cardHeight, cardWidth, expandedGap, videos.length]);

    // 切换折叠/展开
    const handleToggleExpanded = useCallback((e: any) => {
      e.stopPropagation();
      setIsExpanded((prev) => !prev);
    }, []);

    const handleVideoError = useCallback((index: number) => {
      // 使用 ref + forceUpdate 代替 setState，避免频繁重渲染
      if (!brokenIndexesRef.current.has(index)) {
        brokenIndexesRef.current.add(index);
        forceUpdate((n) => n + 1);
      }
    }, []);

    const isRefreshing = useCallback((index: number) => {
      return refreshingIndexesRef.current.has(index);
    }, []);

    useEffect(() => {
      onExpandedChange?.(isExpanded);
    }, [isExpanded, onExpandedChange]);

    useEffect(() => {
      return () => {
        onExpandedChange?.(false);
      };
    }, [onExpandedChange]);

    useEffect(() => {
      if (!isExpanded) {
        setHoveredIndex(null);
        return;
      }

      const handlePointerDown = (event: PointerEvent) => {
        if (!containerRef.current) return;
        const target = event.target as Node | null;
        if (target && containerRef.current.contains(target)) {
          return;
        }
        setIsExpanded(false);
      };

      document.addEventListener("pointerdown", handlePointerDown);
      return () => {
        document.removeEventListener("pointerdown", handlePointerDown);
      };
    }, [isExpanded]);

    // 刷新视频：重新上传到 OSS
    const handleRefreshVideo = useCallback(
      async (e: React.MouseEvent, index: number) => {
        e.stopPropagation();

        if (!nodeId || !updateVideoNodeData || !videos[index]?.localPath) {
          return;
        }

        const item = videos[index];
        if (!item.localPath || !item.localName) {
          return;
        }

        // 使用 ref 追踪刷新状态，避免频繁 setState
        refreshingIndexesRef.current.add(index);
        forceRefreshUpdate((n) => n + 1);

        try {
          // 读取本地文件
          const fileBytes = await readMediaFromLocal(item.localPath);
          if (!fileBytes) {
            throw new Error("无法获取本地文件路径");
          }

          // 创建 File 对象
          const ext = item.localName.split(".").pop() || "mp4";
          let file = new File([fileBytes], item.localName, {
            type: `video/${ext}`,
          });

          // 上传�?OSS
          const ossResult = await uploadFileToOSS(file);
          if (!ossResult.url) {
            throw new Error("上传�?OSS 失败");
          }

          // 更新节点数据
          const newVideos = [...videos];
          newVideos[index] = {
            ...newVideos[index],
            url: ossResult.url,
            remoteUrl: ossResult.url,
          };

          updateVideoNodeData(nodeId, {
            result: {
              type: "video",
              data: newVideos,
            },
          });

          // 移除加载失败标记
          brokenIndexesRef.current.delete(index);
        } catch (error) {
          console.error("[刷新视频] 刷新失败:", error);
        } finally {
          refreshingIndexesRef.current.delete(index);
          forceRefreshUpdate((n) => n + 1);
        }
      },
      [videos, nodeId, updateVideoNodeData],
    );

    const handleVideoClick = useCallback(
      (e: any, index: number) => {
        e.stopPropagation();
        if (index === 0) return;

        // 将点击的视频移到首位
        if (nodeId && updateVideoNodeData) {
          const newVideos = [...videos];
          const clickedVideo = newVideos.splice(index, 1)[0];
          newVideos.unshift(clickedVideo);

          updateVideoNodeData(nodeId, {
            result: {
              type: "video",
              data: newVideos,
            },
          });

          const flowStore = useCanvasFlowStore.getState();
          flowStore.requestHistorySave();
          if (useChatSettingsStore.getState().autoSaveEnabled) {
            flowStore.saveGraph();
          }
        }

        setIsExpanded(false);
      },
      [videos, nodeId, updateVideoNodeData],
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
            <IconVideo size={13} />
            <span>Video</span>
          </div>

          {videos.map((item, index) => {
            const isPrimary = index === 0;
            const isSecondary = index > 0;
            const isFocused = isExpanded && hoveredIndex === index;
            const shouldUseCardChrome = totalCount > 1 && (!isExpanded || isSecondary);
            const displayUrl = displayUrls[index] ?? "";
            const expandedLayout = expandedLayouts[index];
            const stackStyle = getStackCardStyle(
              index,
              isExpanded,
              cardWidth,
              totalCount,
              expandedLayouts,
            );
            const transitionDelay = isExpanded
              ? `${(expandedLayout?.order ?? index) * 55}ms`
              : `${Math.max(0, totalCount - index - 1) * 28}ms`;

            return (
              <div
                key={`${item.remoteUrl || item.localPath || item.url}-${index}`}
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
                  width: isExpanded && isSecondary
                    ? expandedLayout?.width ?? cardWidth
                    : cardWidth,
                  height: isExpanded && isSecondary
                    ? expandedLayout?.height ?? cardHeight
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
                    "relative flex h-full w-full items-center justify-center overflow-hidden rounded-[13px]",
                    shouldUseCardChrome && "bg-[#111]",
                    isExpanded && isSecondary && "cursor-pointer",
                  )}
                  onClick={(e) => {
                    if (isExpanded && isSecondary) {
                      handleVideoClick(e, index);
                    }
                  }}
                >
                  {displayUrl ? (
                    <VideoPlayer
                      src={displayUrl}
                      muted={!isPrimary}
                      loop={!isPrimary}
                      autoPlay={!isPrimary}
                      playsInline
                      preload="metadata"
                      showDefaultControls={isPrimary}
                      containerClassName="h-full w-full rounded-[13px] bg-[#111]"
                      videoClassName={cn(
                        "h-full w-full rounded-[13px] transition-transform duration-300 ease-out",
                        isExpanded && isSecondary
                          ? "object-contain"
                          : "object-cover",
                        isSecondary && isFocused && "scale-[1.08]",
                      )}
                      onError={() => handleVideoError(index)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-[13px] border border-border/80 bg-muted/40 text-[11px] text-muted-foreground">
                      视频加载失败
                    </div>
                  )}

                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 rounded-[13px] ring-0 transition-all duration-200",
                      isSecondary &&
                        isFocused &&
                        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
                    )}
                  />

                  <div className="absolute right-2 top-2 z-30 flex items-center gap-1.5">
                    {isPrimary && totalCount > 1 && (
                      <button
                        type="button"
                        onClick={handleToggleExpanded}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="nodrag inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-black/60 px-3 py-2 text-[11px] font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        aria-label={
                          isExpanded
                            ? `收起视频集合，共${badgeText}`
                            : `展开视频集合，共${badgeText}`
                        }
                      >
                        <span>{badgeText}</span>
                        <IconChevronDown
                          size={12}
                          className={cn(
                            "transition-transform duration-300",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>
                    )}

                    {nodeId &&
                      updateVideoNodeData &&
                      item.localPath &&
                      (isPrimary || (isExpanded && isSecondary)) && (
                        <button
                          type="button"
                          onClick={(e) => handleRefreshVideo(e, index)}
                          disabled={isRefreshing(index)}
                          className="nodrag inline-flex cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/65 p-2 text-white/88 backdrop-blur-md transition-all duration-200 hover:border-white/16 hover:bg-black/78 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="刷新视频"
                        >
                          <IconRefresh
                            size={14}
                            className={isRefreshing(index) ? "animate-spin" : ""}
                          />
                        </button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

CollapsibleVideoGallery.displayName = "CollapsibleVideoGallery";
