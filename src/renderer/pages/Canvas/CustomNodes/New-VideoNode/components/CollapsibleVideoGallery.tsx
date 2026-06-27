import {
  IconChevronDown,
  IconRefresh,
  IconVideo,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import { getMediaSequence } from "shared/utils/mediaSequence";
import { cn } from "shared/utils/utils";
import {
  getVideoPosterUrl,
  withVideoPosterFields,
} from "shared/utils/videoPoster";
import { VideoPlayer } from "@/components/ui/video-player";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";

type VideoItem = {
  url: string;
  format?: string;
  localPath?: string;
  localName?: string;
  remoteUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  coverUrl?: string;
  mediaType?: string;
  pending?: boolean;
};

type CollapsibleVideoGalleryProps = {
  videos: VideoItem[];
  nodeId?: string;
  updateNewVideoNodeData?: (nodeId: string, patch: any) => void;
  onExpandedChange?: (expanded: boolean) => void;
  forcePosterOnly?: boolean;
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

const getCollapsedScale = (index: number) =>
  COLLAPSED_STACK_SCALE[index] ?? 0.72;
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

const getVideoKey = (item: VideoItem, index: number) =>
  `${item.remoteUrl || item.localPath || item.url || "pending"}-${index}`;

export const CollapsibleVideoGallery = memo(
  ({
    videos,
    nodeId,
    updateNewVideoNodeData,
    onExpandedChange,
    forcePosterOnly = false,
    frameSize,
  }: CollapsibleVideoGalleryProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const brokenIndexesRef = useRef<Set<number>>(new Set());
    const brokenPosterIndexesRef = useRef<Set<number>>(new Set());
    const [, forceUpdate] = useState(0);
    const refreshingIndexesRef = useRef<Set<number>>(new Set());
    const [, forceRefreshUpdate] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [localVideoUrls, setLocalVideoUrls] = useState<
      Record<string, string>
    >({});
    const [localVideoFallbackKeys, setLocalVideoFallbackKeys] = useState<
      Record<string, true>
    >({});
    const localVideoObjectUrlsRef = useRef<Record<string, string>>({});

    const totalCount = videos.length;

    const posterUrls = useMemo(() => {
      return videos.map((item) => getVideoPosterUrl(item) ?? "");
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

    const handleToggleExpanded = useCallback((e: any) => {
      e.stopPropagation();
      setIsExpanded((prev) => !prev);
    }, []);

    const handleVideoError = useCallback((index: number) => {
      if (!brokenIndexesRef.current.has(index)) {
        brokenIndexesRef.current.add(index);
        forceUpdate((n) => n + 1);
      }
    }, []);

    const handlePosterError = useCallback((index: number) => {
      if (!brokenPosterIndexesRef.current.has(index)) {
        brokenPosterIndexesRef.current.add(index);
        forceUpdate((n) => n + 1);
      }
    }, []);

    const isRefreshing = useCallback((index: number) => {
      return refreshingIndexesRef.current.has(index);
    }, []);

    const isBroken = useCallback((index: number) => {
      return brokenIndexesRef.current.has(index);
    }, []);

    const isPosterBroken = useCallback((index: number) => {
      return brokenPosterIndexesRef.current.has(index);
    }, []);

    useEffect(() => {
      let cancelled = false;
      const desiredKeys = new Set<string>();

      const pruneLocalUrls = () => {
        for (const [key, url] of Object.entries(
          localVideoObjectUrlsRef.current,
        )) {
          if (!desiredKeys.has(key)) {
            URL.revokeObjectURL(url);
            delete localVideoObjectUrlsRef.current[key];
          }
        }

        setLocalVideoUrls((prev) => {
          const next = Object.fromEntries(
            Object.entries(prev).filter(([key]) => desiredKeys.has(key)),
          );
          return Object.keys(next).length === Object.keys(prev).length
            ? prev
            : next;
        });
        setLocalVideoFallbackKeys((prev) => {
          const next = Object.fromEntries(
            Object.entries(prev).filter(([key]) => desiredKeys.has(key)),
          ) as Record<string, true>;
          return Object.keys(next).length === Object.keys(prev).length
            ? prev
            : next;
        });
      };

      const loadLocalVideo = async (_item: VideoItem, videoKey: string) => {
        setLocalVideoFallbackKeys((prev) => ({ ...prev, [videoKey]: true }));
      };

      videos.forEach((item, index) => {
        const shouldRenderPlayer =
          !forcePosterOnly && (isExpanded || index === 0);

        if (item.pending || !item.localPath || !shouldRenderPlayer) {
          return;
        }

        const videoKey = getVideoKey(item, index);
        desiredKeys.add(videoKey);
        if (localVideoObjectUrlsRef.current[videoKey]) {
          return;
        }

        void loadLocalVideo(item, videoKey);
      });

      pruneLocalUrls();

      return () => {
        cancelled = true;
      };
    }, [forcePosterOnly, isExpanded, videos]);

    useEffect(() => {
      return () => {
        Object.values(localVideoObjectUrlsRef.current).forEach((url) => {
          URL.revokeObjectURL(url);
        });
        localVideoObjectUrlsRef.current = {};
      };
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

    const handleRefreshVideo = useCallback(
      async (e: React.MouseEvent, index: number) => {
        e.stopPropagation();

        if (!nodeId || !updateNewVideoNodeData || !videos[index]?.url) {
          return;
        }

        const item = videos[index];
        refreshingIndexesRef.current.add(index);
        forceRefreshUpdate((n) => n + 1);

        try {
          const response = await fetch(item.url);
          const blob = await response.blob();
          const file = new File([blob], item.localName || `video-${index}.mp4`, {
            type: blob.type || "video/mp4",
          });

          const ossResult = await uploadFileToOSS(file);
          if (!ossResult.url) {
            throw new Error("上传到 OSS 失败");
          }

          const newVideos = [...videos];
          newVideos[index] = {
            ...newVideos[index],
            url: ossResult.url,
            remoteUrl: ossResult.url,
          };
          newVideos[index] = withVideoPosterFields(newVideos[index]);

          updateNewVideoNodeData(nodeId, {
            result: {
              type: "video",
              data: newVideos,
            },
          });

          brokenIndexesRef.current.delete(index);
          brokenPosterIndexesRef.current.delete(index);
        } catch (error) {
          console.error("[刷新视频] 刷新失败:", error);
        } finally {
          refreshingIndexesRef.current.delete(index);
          forceRefreshUpdate((n) => n + 1);
        }
      },
      [videos, nodeId, updateNewVideoNodeData],
    );

    const handleVideoClick = useCallback(
      (e: any, index: number) => {
        e.stopPropagation();
        if (index === 0) return;

        if (nodeId && updateNewVideoNodeData) {
          const newVideos = [...videos];
          const clickedVideo = newVideos.splice(index, 1)[0];
          if (clickedVideo?.pending) return;
          newVideos.unshift(clickedVideo);

          updateNewVideoNodeData(nodeId, {
            result: {
              type: "video",
              data: newVideos.filter((item) => !item.pending),
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
      [videos, nodeId, updateNewVideoNodeData],
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
            const isPending = Boolean(item.pending);
            const isFocused = isExpanded && hoveredIndex === index;
            const sequence = getMediaSequence(item, index);
            const shouldUseCardChrome =
              totalCount > 1 && (!isExpanded || isSecondary);
            const posterUrl = posterUrls[index] ?? "";
            const videoKey = getVideoKey(item, index);
            const shouldRenderPlayer =
              !forcePosterOnly && (isExpanded || isPrimary);
            const remoteVideoUrl = item.remoteUrl || item.url || "";
            const isWaitingForLocalVideo =
              shouldRenderPlayer &&
              Boolean(item.localPath) &&
              !localVideoUrls[videoKey] &&
              !localVideoFallbackKeys[videoKey];
            const displayUrl =
              shouldRenderPlayer && localVideoUrls[videoKey]
                ? localVideoUrls[videoKey]
                : isWaitingForLocalVideo
                  ? ""
                  : remoteVideoUrl;
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
                key={videoKey}
                role="presentation"
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
                  role="presentation"
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
                  {isPending ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[13px] bg-[#121216] text-[11px] text-muted-foreground">
                      <div className="relative h-7 w-7">
                        <div className="absolute inset-0 rounded-full border-2 border-primary/25" />
                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
                      </div>
                      <span>生成中...</span>
                    </div>
                  ) : isWaitingForLocalVideo ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[13px] bg-[#121216] text-[11px] text-muted-foreground">
                      <div className="relative h-7 w-7">
                        <div className="absolute inset-0 rounded-full border-2 border-primary/25" />
                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
                      </div>
                      <span>读取本地视频...</span>
                    </div>
                  ) : displayUrl && shouldRenderPlayer && !isBroken(index) ? (
                    <VideoPlayer
                      src={displayUrl}
                      muted={!isPrimary}
                      loop={!isPrimary}
                      autoPlay={!isPrimary}
                      poster={posterUrl || undefined}
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
                  ) : displayUrl || (posterUrl && !isPosterBroken(index)) ? (
                    <div
                      className={cn(
                        "relative flex h-full w-full items-center justify-center overflow-hidden rounded-[13px] bg-[#121216]",
                        posterUrl && !isPosterBroken(index)
                          ? ""
                          : "text-[11px] text-muted-foreground",
                      )}
                    >
                      {posterUrl && !isPosterBroken(index) ? (
                        <img
                          src={posterUrl}
                          alt={`视频封面-${sequence}`}
                          className={cn(
                            "h-full w-full rounded-[13px] transition-transform duration-300 ease-out",
                            isExpanded && isSecondary
                              ? "object-contain"
                              : "object-cover",
                            isSecondary && isFocused && "scale-[1.08]",
                          )}
                          loading="lazy"
                          draggable={false}
                          onError={() => handlePosterError(index)}
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[13px] bg-[#121216] text-[11px] text-muted-foreground">
                          <IconVideo size={24} className="text-white/35" />
                          <span>Video</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-[13px] bg-[#121216] text-[11px] text-muted-foreground">
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
                    {totalCount > 1 && (
                      <span className="pointer-events-none inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-white/12 bg-black/60 px-2 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                        #{sequence}
                      </span>
                    )}

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
                  </div>

                  {nodeId &&
                    updateNewVideoNodeData &&
                    item.localPath &&
                    !isPending && (
                      <button
                        type="button"
                        onClick={(e) => handleRefreshVideo(e, index)}
                        disabled={isRefreshing(index)}
                        className={cn(
                          "nodrag absolute left-2 top-2 z-30 cursor-pointer rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-50",
                          isBroken(index)
                            ? "opacity-100"
                            : isExpanded
                              ? isSecondary && isFocused
                                ? "opacity-100"
                                : "opacity-0"
                              : isPrimary
                                ? "opacity-0 group-hover/card:opacity-100"
                                : "opacity-0",
                        )}
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
            );
          })}
        </div>
      </div>
    );
  },
);

CollapsibleVideoGallery.displayName = "CollapsibleVideoGallery";
