import { IconRefresh } from "@tabler/icons-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { generateThumbnailWithFormat, uploadFileToOSS } from "service/oss";
import { readMediaFromLocal } from "service/projectStorage";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import { ImageTile } from "./ImageTile";

type ImageItem = {
  url: string; // 远程 OSS URL
  localPath?: string; // 本地相对路径
  localName?: string; // 本地文件名
};

type CollapsibleImageGalleryProps = {
  images: ImageItem[];
  onReorder?: (fromIndex: number) => void;
  nodeId?: string;
  updateImageNodeData?: (nodeId: string, patch: any) => void;
};

/**
 * 可折叠图片集合卡片
 * - collapsed：仅展示封面图 + 右上角数量徽标
 * - expanded：2 列网格展示全部图片
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
  }: CollapsibleImageGalleryProps) => {
    // 默认折叠，仅展示封面
    const [isExpanded, setIsExpanded] = useState(false);
    // 记录加载失败索引，统一渲染占位（使用 ref 避免频繁 setState）
    const brokenIndexesRef = useRef<Set<number>>(new Set());
    const [, forceUpdate] = useState(0);
    // 记录正在刷新的图片索引
    const refreshingIndexesRef = useRef<Set<number>>(new Set());
    const [, forceRefreshUpdate] = useState(0);

    const totalCount = images.length;

    // 优先使用本地路径，否则使用远程 URL - 用 useMemo 缓存
    // OSS 图片使用缩略图展示，减少带宽占用，提升加载速度
    const displayUrls = useMemo(() => {
      return images.map((item) => {
        const originalUrl = item.url ?? "";

        // OSS 图片生成缩略图（使用 WIDTH_200 + webp，体积最小）
        // 本地图片不需要缩略图优化（已经是本地文件路径）
        if (originalUrl && !item.localPath && originalUrl.includes("oss-cn-")) {
          return generateThumbnailWithFormat(originalUrl, "WIDTH_200", "webp");
        }

        return originalUrl;
      });
    }, [images]);

    const coverImage = displayUrls[0] ?? "";
    const badgeText = `${totalCount}张`;

    // 当前设计要求：1/2/3/4/5+ 都使用 2 列（1 张时为单列）
    const expandedGridColsClass = useMemo(() => {
      if (totalCount <= 1) return "grid-cols-1";
      return "grid-cols-2";
    }, [totalCount]);

    // 5+ 图片时适度压缩间距，提升信息密度
    const expandedGridGapClass = totalCount > 4 ? "gap-0.5" : "gap-1";

    // 切换折叠/展开
    const handleToggleExpanded = useCallback((e: any) => {
      e.stopPropagation();
      setIsExpanded((prev) => !prev);
    }, []);

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

        if (!nodeId || !updateImageNodeData || !images[index]?.localPath) {
          return;
        }

        const item = images[index];
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
          const ext = item.localName.split(".").pop() || "png";
          let file = new File([fileBytes], item.localName, {
            type: `image/${ext}`,
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

    return (
      <div
        className={`nopan h-full w-full overflow-hidden rounded-md bg-background p-1 ${isExpanded && totalCount > 4 ? "nowheel" : ""}`}
      >
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-background shadow-sm group">
          {/* 右上角图片数量徽标：用于展开/收起切换 */}
          <button
            type="button"
            onClick={handleToggleExpanded}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-2 z-20 cursor-pointer rounded-lg bg-black/60 px-3 py-2 text-[11px] font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            aria-label={
              isExpanded
                ? `收起图片集合，共${badgeText}`
                : `展开图片集合，共${badgeText}`
            }
          >
            {badgeText}
          </button>

          {/* 刷新按钮：仅在有本地文件时显示 */}
          {nodeId && updateImageNodeData && images[0]?.localPath && (
            <button
              type="button"
              onClick={(e) => handleRefreshImage(e, 0)}
              disabled={isRefreshing(0)}
              className="absolute left-2 top-2 z-20 cursor-pointer rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
              aria-label="刷新图片"
            >
              <IconRefresh
                size={14}
                className={isRefreshing(0) ? "animate-spin" : ""}
              />
            </button>
          )}

          {/* 折叠态：仅显示首图封面 */}
          <div
            className={`absolute inset-0 transition-all duration-200 ease-out ${isExpanded
              ? "pointer-events-none translate-y-1 scale-[0.98] opacity-0"
              : "translate-y-0 scale-100 opacity-100"
              }`}
          >
            <ImageTile
              url={coverImage}
              index={0}
              isBroken={isBroken(0)}
              onError={handleImageError}
              className="rounded-lg"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-black/25 to-transparent" />
          </div>

          {/* 展开态：2 列网格展示全部图片 */}
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
                {images.map((item, index) => (
                  <div
                    key={`${item.url}-${index}`}
                    className={`relative ${totalCount === 1 ? "min-h-0" : "min-h-13"} group/tile`}
                  >
                    <ImageTile
                      url={displayUrls[index]}
                      index={index}
                      isBroken={isBroken(index)}
                      onError={handleImageError}
                      onClick={(e) => handleImageClick(e, index)}
                      className="rounded-md"
                    />
                    {/* 展开态中的刷新按钮 */}
                    {nodeId && updateImageNodeData && item.localPath && (
                      <button
                        type="button"
                        onClick={(e) => handleRefreshImage(e, index)}
                        disabled={isRefreshing(index)}
                        className="absolute left-1 top-1 z-10 cursor-pointer rounded bg-black/60 p-1 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover/tile:opacity-100"
                        aria-label="刷新图片"
                      >
                        <IconRefresh
                          size={12}
                          className={isRefreshing(index) ? "animate-spin" : ""}
                        />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

CollapsibleImageGallery.displayName = "CollapsibleImageGallery";
