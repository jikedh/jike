import { useMemo, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { ImageTile } from "./ImageTile";
import { getMediaUrl } from "service/projectStorage";
import { uploadFileToOSS } from "service/oss";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";

type ImageItem = {
  url?: string;
  relativePath?: string;
  localFileName?: string;
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
export const CollapsibleImageGallery = ({
  images,
  onReorder,
  nodeId,
  updateImageNodeData,
}: CollapsibleImageGalleryProps) => {
  // 默认折叠，仅展示封面
  const [isExpanded, setIsExpanded] = useState(false);
  // 记录加载失败索引，统一渲染占位
  const [brokenImageIndexes, setBrokenImageIndexes] = useState<number[]>([]);
  // 记录正在刷新的图片索引
  const [refreshingIndexes, setRefreshingIndexes] = useState<number[]>([]);

  const totalCount = images.length;

  // 优先使用本地路径，否则使用远程 URL
  const getDisplayUrl = (item: ImageItem): string => {
    if (item.relativePath) {
      const localUrl = getMediaUrl(item.relativePath);
      if (localUrl) return localUrl;
    }
    return item.url ?? "";
  };

  const coverImage = getDisplayUrl(images[0] ?? {});
  const badgeText = `${totalCount}张`;

  // 当前设计要求：1/2/3/4/5+ 都使用 2 列（1 张时为单列）
  const expandedGridColsClass = useMemo(() => {
    if (totalCount <= 1) return "grid-cols-1";
    return "grid-cols-2";
  }, [totalCount]);

  // 5+ 图片时适度压缩间距，提升信息密度
  const expandedGridGapClass = totalCount > 4 ? "gap-0.5" : "gap-1";

  // 切换折叠/展开
  const handleToggleExpanded = (e: any) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const handleImageError = (index: number) => {
    setBrokenImageIndexes((prev) =>
      prev.includes(index) ? prev : [...prev, index],
    );
  };

  // 刷新图片：重新上传到 OSS
  const handleRefreshImage = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();

    if (!nodeId || !updateImageNodeData || !images[index]?.relativePath) {
      console.log("[刷新图片] 缺少必要参数，无法刷新");
      return;
    }

    const item = images[index];
    if (!item.relativePath || !item.localFileName) {
      console.log("[刷新图片] 缺少本地文件信息，无法刷新");
      return;
    }

    setRefreshingIndexes((prev) => [...prev, index]);

    try {
      // 读取本地文件
      const absolutePath = getMediaUrl(item.relativePath);
      if (!absolutePath || !window.storage) {
        throw new Error("无法获取本地文件路径");
      }

      const readResult = await window.storage.readFile(absolutePath);
      if (!readResult.success || !readResult.data) {
        throw new Error("读取本地文件失败");
      }

      // 创建 File 对象
      const ext = item.localFileName.split(".").pop() || "png";
      const fileBytes = new Uint8Array(readResult.data);
      let file = new File([fileBytes], item.localFileName, {
        type: `image/${ext}`,
      });

      // 检查文件大小，大于10MB时压缩
      if (file.size > MAX_IMAGE_SIZE_MB) {
        console.log(
          `[刷新图片] 文件大小 ${(file.size / 1024 / 1024).toFixed(2)}MB 超过 10MB，开始压缩...`,
        );
        file = await compressImage(file);
      }

      // 上传到 OSS
      const ossResult = await uploadFileToOSS(file);
      if (!ossResult.url) {
        throw new Error("上传到 OSS 失败");
      }

      console.log("[刷新图片] 上传成功，新 OSS URL:", ossResult.url);

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
      setBrokenImageIndexes((prev) => prev.filter((i) => i !== index));
    } catch (error) {
      console.error("[刷新图片] 刷新失败:", error);
    } finally {
      setRefreshingIndexes((prev) => prev.filter((i) => i !== index));
    }
  };

  const handleImageClick = (e: any, index: number) => {
    e.stopPropagation();
    if (index === 0) return;
    if (onReorder) {
      onReorder(index);
    }
    setIsExpanded(false);
  };

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
        {nodeId && updateImageNodeData && images[0]?.relativePath && (
          <button
            type="button"
            onClick={(e) => handleRefreshImage(e, 0)}
            disabled={refreshingIndexes.includes(0)}
            className="absolute left-2 top-2 z-20 cursor-pointer rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
            aria-label="刷新图片"
          >
            <IconRefresh
              size={14}
              className={refreshingIndexes.includes(0) ? "animate-spin" : ""}
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
            isBroken={brokenImageIndexes.includes(0)}
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
                    url={getDisplayUrl(item)}
                    index={index}
                    isBroken={brokenImageIndexes.includes(index)}
                    onError={handleImageError}
                    onClick={(e) => handleImageClick(e, index)}
                    className="rounded-md"
                  />
                  {/* 展开态中的刷新按钮 */}
                  {nodeId && updateImageNodeData && item.relativePath && (
                    <button
                      type="button"
                      onClick={(e) => handleRefreshImage(e, index)}
                      disabled={refreshingIndexes.includes(index)}
                      className="absolute left-1 top-1 z-10 cursor-pointer rounded bg-black/60 p-1 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover/tile:opacity-100"
                      aria-label="刷新图片"
                    >
                      <IconRefresh
                        size={12}
                        className={
                          refreshingIndexes.includes(index)
                            ? "animate-spin"
                            : ""
                        }
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
};
