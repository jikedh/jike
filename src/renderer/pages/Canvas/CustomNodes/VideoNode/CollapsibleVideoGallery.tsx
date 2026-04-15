import { IconMenu, IconRefresh } from "@tabler/icons-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import { getMediaUrl } from "service/projectStorage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

type VideoItem = {
  url: string; // 远程 OSS URL
  format?: string; // 视频格式
  localPath?: string; // 本地相对路径
  localName?: string; // 本地文件名
};

type CollapsibleVideoGalleryProps = {
  videos: VideoItem[];
  nodeId?: string;
  updateVideoNodeData?: (nodeId: string, patch: any) => void;
};

/**
 * 可折叠视频集合卡片
 * - collapsed：仅展示封面视频 + 右上角数量徽标
 * - expanded：2 列网格展示全部视频
 * - 点击展开态中的视频，可将其移动到首位作为新封面
 * - 优先使用本地路径，如果不存在则使用远程 URL
 * - 刷新按钮：重新上传视频到 OSS
 * - 右键菜单：支持将视频独立为新视频节点
 */
export const CollapsibleVideoGallery = memo(
  ({ videos, nodeId, updateVideoNodeData }: CollapsibleVideoGalleryProps) => {
    // 默认折叠，仅展示封面
    const [isExpanded, setIsExpanded] = useState(false);
    // 记录加载失败索引，统一渲染占位（使用 ref 避免频繁 setState）
    const brokenIndexesRef = useRef<Set<number>>(new Set());
    const [, forceUpdate] = useState(0);
    // 记录正在刷新的视频索引
    const refreshingIndexesRef = useRef<Set<number>>(new Set());
    const [, forceRefreshUpdate] = useState(0);
    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      videoIndex: number;
    } | null>(null);

    const totalCount = videos.length;

    // 画布操作
    const addVideoNode = useCanvasFlowStore((state) => state.addVideoNode);

    // 优先使用本地路径，否则使用远程 URL - 用 useMemo 缓存
    const displayUrls = useMemo(() => {
      return videos.map((item) => {
        if (item.localPath) {
          const localUrl = getMediaUrl(item.localPath);
          if (localUrl) return localUrl;
        }
        return item.url ?? "";
      });
    }, [videos]);

    const coverVideo = displayUrls[0] ?? "";
    const badgeText = `${totalCount}个`;

    // 当前设计要求：1/2/3/4/5+ 都使用 2 列（1 个时为单列）
    const expandedGridColsClass = useMemo(() => {
      if (totalCount <= 1) return "grid-cols-1";
      return "grid-cols-2";
    }, [totalCount]);

    // 5+ 视频时适度压缩间距，提升信息密度
    const expandedGridGapClass = totalCount > 4 ? "gap-0.5" : "gap-1";

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

    const isBroken = useCallback((index: number) => {
      return brokenIndexesRef.current.has(index);
    }, []);

    const isRefreshing = useCallback((index: number) => {
      return refreshingIndexesRef.current.has(index);
    }, []);

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
          const absolutePath = getMediaUrl(item.localPath);
          if (!absolutePath || !window.storage) {
            throw new Error("无法获取本地文件路径");
          }

          const readResult = await window.storage.readFile(absolutePath);
          if (!readResult.success || !readResult.data) {
            throw new Error("读取本地文件失败");
          }

          // 创建 File 对象
          const ext = item.localName.split(".").pop() || "mp4";
          const fileBytes = new Uint8Array(readResult.data);
          let file = new File([fileBytes], item.localName, {
            type: `video/${ext}`,
          });

          // 上传到 OSS
          const ossResult = await uploadFileToOSS(file);
          if (!ossResult.url) {
            throw new Error("上传到 OSS 失败");
          }

          // 更新节点数据
          const newVideos = [...videos];
          newVideos[index] = {
            ...newVideos[index],
            url: ossResult.url,
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
        }

        setIsExpanded(false);
      },
      [videos, nodeId, updateVideoNodeData],
    );

    // 处理右键菜单
    const handleContextMenu = useCallback(
      (e: React.MouseEvent, videoIndex: number) => {
        e.preventDefault();
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          videoIndex,
        });
      },
      [],
    );

    // 关闭右键菜单
    const closeContextMenu = useCallback(() => {
      setContextMenu(null);
    }, []);

    // 将视频独立为新视频节点
    const handleExtractVideo = useCallback(
      (videoIndex: number) => {
        if (!nodeId) return;

        const video = videos[videoIndex];
        if (!video?.url) return;

        // 创建新的视频节点
        addVideoNode({
          video_urls: [video.url],
          aspect_ratio: "16:9", // 默认宽高比
          metadata: {
            resolution: "720p", // 默认分辨率
          },
        });

        closeContextMenu();
      },
      [nodeId, videos, addVideoNode, closeContextMenu],
    );

    // 点击空白处关闭右键菜单
    useMemo(() => {
      const handleClickOutside = () => {
        closeContextMenu();
      };

      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }, [closeContextMenu]);

    return (
      <div
        className={`nopan h-full w-full overflow-hidden rounded-md bg-background p-1 ${isExpanded && totalCount > 4 ? "nowheel" : ""}`}
      >
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-background shadow-sm group">
          {/* 右上角视频数量徽标：用于展开/收起切换 */}
          <button
            type="button"
            onClick={handleToggleExpanded}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-2 z-20 cursor-pointer rounded-lg bg-black/60 px-3 py-2 text-[11px] font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            aria-label={
              isExpanded
                ? `收起视频集合，共${badgeText}`
                : `展开视频集合，共${badgeText}`
            }
          >
            {badgeText}
          </button>

          {/* 刷新按钮：仅在有本地文件时显示 */}
          {nodeId && updateVideoNodeData && videos[0]?.localPath && (
            <button
              type="button"
              onClick={(e) => handleRefreshVideo(e, 0)}
              disabled={isRefreshing(0)}
              className="absolute left-2 top-2 z-20 cursor-pointer rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
              aria-label="刷新视频"
            >
              <IconRefresh
                size={14}
                className={isRefreshing(0) ? "animate-spin" : ""}
              />
            </button>
          )}

          {/* 折叠态：仅显示首视频封面 */}
          <div
            className={`absolute inset-0 transition-all duration-200 ease-out ${isExpanded
                ? "pointer-events-none translate-y-1 scale-[0.98] opacity-0"
                : "translate-y-0 scale-100 opacity-100"
              }`}
          >
            <div className="h-full w-full overflow-hidden rounded-lg">
              {coverVideo ? (
                <video
                  src={coverVideo}
                  controls
                  className="block h-full w-full object-contain object-center"
                  onError={() => handleVideoError(0)}
                >
                  你的浏览器不支持视频播放
                </video>
              ) : (
                <div className="h-full w-full rounded-md border border-border/80 bg-muted/40 text-muted-foreground flex items-center justify-center text-[11px]">
                  视频加载失败
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-black/25 to-transparent" />
          </div>

          {/* 展开态：2 列网格展示全部视频 */}
          <div
            className={`absolute inset-0 transition-all duration-200 ease-out ${isExpanded
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
              }`}
          >
            <div
              className={`h-full w-full ${totalCount > 4 ? "overflow-y-auto pr-0.5" : ""}`}
            >
              <div
                className={`grid h-full w-full p-1 ${expandedGridColsClass} ${expandedGridGapClass}`}
              >
                {videos.map((item, index) => (
                  <div
                    key={`${item.url}-${index}`}
                    className={`relative ${totalCount === 1 ? "min-h-0" : "min-h-13"} group/tile`}
                    onContextMenu={(e) => handleContextMenu(e, index)}
                  >
                    <div className="h-full w-full overflow-hidden rounded-md">
                      {displayUrls[index] ? (
                        <video
                          src={displayUrls[index]}
                          controls
                          className={`block h-full w-full object-contain object-center`}
                          loading="lazy"
                          onError={() => handleVideoError(index)}
                          onClick={(e) => handleVideoClick(e, index)}
                          style={{ cursor: "pointer" }}
                        >
                          你的浏览器不支持视频播放
                        </video>
                      ) : (
                        <div className="h-full w-full rounded-md border border-border/80 bg-muted/40 text-muted-foreground flex items-center justify-center text-[11px]">
                          视频加载失败
                        </div>
                      )}
                    </div>
                    {/* 展开态中的刷新按钮 */}
                    {nodeId && updateVideoNodeData && item.localPath && (
                      <button
                        type="button"
                        onClick={(e) => handleRefreshVideo(e, index)}
                        disabled={isRefreshing(index)}
                        className="absolute left-1 top-1 z-10 cursor-pointer rounded bg-black/60 p-1 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover/tile:opacity-100"
                        aria-label="刷新视频"
                      >
                        <IconRefresh
                          size={12}
                          className={isRefreshing(index) ? "animate-spin" : ""}
                        />
                      </button>
                    )}
                    {/* 右键菜单图标 */}
                    <button
                      type="button"
                      onClick={(e) => handleContextMenu(e, index)}
                      className="absolute right-1 top-1 z-10 cursor-pointer rounded bg-black/60 p-1 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 opacity-0 group-hover/tile:opacity-100"
                      aria-label="视频操作"
                    >
                      <IconMenu size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右键菜单 */}
          {contextMenu && (
            <div
              className="absolute z-50 right-2 top-10 rounded-lg border border-border bg-background shadow-lg py-2"
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
                position: "fixed",
              }}
            >
              <button
                type="button"
                onClick={() => handleExtractVideo(contextMenu.videoIndex)}
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/50 w-full text-left"
              >
                独立为视频节点
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
);

CollapsibleVideoGallery.displayName = "CollapsibleVideoGallery";
