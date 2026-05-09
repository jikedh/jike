import {
  IconCheck,
  IconDownload,
  IconMusic,
  IconPhoto,
  IconTrash,
  IconUpload,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AssetCategory,
  type AssetMediaType,
  type AssetRecord,
  type AssetScope,
  createAssetFromBuffer,
  deleteAssetsById,
  getAssetCategoryLabel,
  getAssetDisplayUrl,
  readAssetIndex,
  renameAsset,
} from "service/assetStorage";
import {
  CANVAS_ASSET_DRAG_MIME,
  CANVAS_ASSET_DRAG_TYPE,
  type CanvasAssetDragPayload,
} from "shared/constants/canvasDrag";
import {
  getAssetMediaType,
  SUPPORTED_ASSET_AUDIO_EXTENSIONS,
  SUPPORTED_ASSET_IMAGE_EXTENSIONS,
  SUPPORTED_ASSET_VIDEO_EXTENSIONS,
} from "shared/constants/mediaTypes";
import type { AllNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadAssets } from "../utils/assetDownload";
import { countAssetReferencesInCanvas } from "../utils/assetReferences";

type AssetLibraryDialogProps = {
  open: boolean;
  basePath: string;
  projectId?: string | null;
  nodes: AllNodeType[];
  refreshKey?: number;
  onClose: () => void;
  onUse?: (asset: AssetRecord) => void;
  onDropAsset?: (
    asset: AssetRecord,
    clientPosition: { x: number; y: number },
  ) => void;
  variant?: "dialog" | "page";
};

const scopes: Array<{ id: AssetScope; label: string }> = [
  { id: "project", label: "项目资产" },
  { id: "canvas", label: "画布资产" },
  { id: "public", label: "公共资产" },
];

const categories: Array<{ id: AssetCategory; label: string }> = [
  { id: "person", label: "人物" },
  { id: "scene", label: "场景" },
  { id: "prop", label: "道具" },
  { id: "audio", label: "音效" },
];

const PAGE_SIZE = 24;

const VISUAL_ASSET_FILE_ACCEPT = [
  ...SUPPORTED_ASSET_IMAGE_EXTENSIONS,
  ...SUPPORTED_ASSET_VIDEO_EXTENSIONS,
].join(",");
const AUDIO_ASSET_FILE_ACCEPT = SUPPORTED_ASSET_AUDIO_EXTENSIONS.join(",");
const VISUAL_ASSET_SUPPORTED_TYPES_LABEL =
  "图片 jpg/jpeg/png/webp/gif，视频 mp4/webm/mov";
const AUDIO_ASSET_SUPPORTED_TYPES_LABEL = "音频 mp3/wav/m4a/aac/ogg";

const getCategoryUploadAccept = (category: AssetCategory) =>
  category === "audio" ? AUDIO_ASSET_FILE_ACCEPT : VISUAL_ASSET_FILE_ACCEPT;

const getCategorySupportedTypesLabel = (category: AssetCategory) =>
  category === "audio"
    ? AUDIO_ASSET_SUPPORTED_TYPES_LABEL
    : VISUAL_ASSET_SUPPORTED_TYPES_LABEL;

const isMediaTypeAllowedInCategory = (
  mediaType: AssetMediaType,
  category: AssetCategory,
) => (category === "audio" ? mediaType === "audio" : mediaType !== "audio");

const getUploadCategory = (
  mediaType: AssetMediaType,
  category: AssetCategory,
): AssetCategory => (mediaType === "audio" ? "audio" : category);

const getAssetIcon = (mediaType: AssetMediaType) => {
  if (mediaType === "video") return <IconVideo size={16} />;
  if (mediaType === "audio") return <IconMusic size={16} />;
  return <IconPhoto size={16} />;
};

const createDragPayload = (asset: AssetRecord): CanvasAssetDragPayload => ({
  type: CANVAS_ASSET_DRAG_TYPE,
  asset: {
    id: asset.id,
    name: asset.name,
    mediaType: asset.mediaType,
    category: asset.category,
    fileUrl: asset.fileUrl,
    coverUrl: asset.coverUrl,
    localName: asset.fileUrl.split("/").pop(),
  },
});

const getMediaTypeLabel = (mediaType: AssetMediaType) => {
  if (mediaType === "image") return "图片";
  if (mediaType === "video") return "视频";
  return "音频";
};

const AssetPreviewPane = ({
  asset,
  basePath,
}: {
  asset: AssetRecord | null;
  basePath: string;
}) => {
  if (!asset) {
    return (
      <aside className="hidden w-80 shrink-0 border-l border-white/10 pl-5 xl:block">
        <div className="flex h-full min-h-[420px] items-center justify-center rounded-md border border-dashed border-white/10 text-sm text-white/35">
          选择资产查看详情
        </div>
      </aside>
    );
  }

  const displayUrl = getAssetDisplayUrl(asset, basePath);
  const updatedAt = new Date(asset.updatedAt || asset.createdAt);

  return (
    <aside className="hidden w-80 shrink-0 border-l border-white/10 pl-5 xl:block">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#151515]">
          {asset.mediaType === "image" ? (
            <img
              src={displayUrl}
              alt={asset.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : asset.mediaType === "video" ? (
            <video
              src={displayUrl}
              className="max-h-full max-w-full"
              controls
            />
          ) : (
            <div className="flex w-full flex-col items-center gap-4 px-5 text-white/65">
              <IconMusic size={40} />
              <audio src={displayUrl} className="w-full" controls />
            </div>
          )}
        </div>
        <div className="mt-5 min-h-0 space-y-4 overflow-auto text-sm">
          <div>
            <div className="text-xs text-white/35">名称</div>
            <div className="mt-1 break-words text-white/90">{asset.name}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-white/35">类型</div>
              <div className="mt-1 text-white/75">
                {getMediaTypeLabel(asset.mediaType)}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/35">分类</div>
              <div className="mt-1 text-white/75">
                {getAssetCategoryLabel(asset.category)}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-white/35">更新时间</div>
            <div className="mt-1 text-white/75">
              {Number.isNaN(updatedAt.getTime())
                ? "-"
                : updatedAt.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/35">本地路径</div>
            <div className="mt-1 break-all text-xs leading-5 text-white/45">
              {asset.originalFile}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export const AssetLibraryDialog = ({
  open,
  basePath,
  projectId,
  nodes,
  refreshKey,
  onClose,
  onUse,
  onDropAsset,
  variant = "dialog",
}: AssetLibraryDialogProps) => {
  const [activeScope, setActiveScope] = useState<AssetScope>("project");
  const [activeCategory, setActiveCategory] = useState<AssetCategory>("person");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [contextMenu, setContextMenu] = useState<{
    asset: AssetRecord;
    x: number;
    y: number;
  } | null>(null);
  const [renamingAsset, setRenamingAsset] = useState<AssetRecord | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    assets: AssetRecord[];
    message: string;
  } | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AssetRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isPageVariant = variant === "page";
  const allowInsert = !isPageVariant && Boolean(onUse);
  const visibleScopes = useMemo(
    () =>
      isPageVariant ? scopes.filter((scope) => scope.id !== "canvas") : scopes,
    [isPageVariant],
  );

  const reloadAssets = useCallback(async () => {
    if (!basePath || !open) return;
    setLoading(true);
    try {
      const index = await readAssetIndex(basePath);
      setAssets(index.assets);
    } catch (error) {
      console.error("[AssetLibrary] load failed", error);
      toast.error("读取资产库失败");
    } finally {
      setLoading(false);
    }
  }, [basePath, open]);

  useEffect(() => {
    void reloadAssets();
  }, [reloadAssets, refreshKey]);

  useEffect(() => {
    if (!open) {
      setBatchMode(false);
      setSelectedIds([]);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIds([]);
    setPage(1);
  }, [activeScope, activeCategory]);

  useEffect(() => {
    if (!visibleScopes.some((scope) => scope.id === activeScope)) {
      setActiveScope(visibleScopes[0]?.id ?? "project");
    }
  }, [activeScope, visibleScopes]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = () => setContextMenu(null);
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, [contextMenu]);

  const filteredAssets = useMemo(() => {
    if (activeScope === "public") return [];
    return assets.filter((asset) => {
      if (asset.scope !== activeScope || asset.category !== activeCategory) {
        return false;
      }
      if (activeScope === "canvas") {
        return asset.projectId === projectId;
      }
      return true;
    });
  }, [activeCategory, activeScope, assets, projectId]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const pageAssets = filteredAssets.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const activePreviewAsset =
    previewAsset && filteredAssets.some((asset) => asset.id === previewAsset.id)
      ? previewAsset
      : null;

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds],
  );

  const handleDownloadAssets = useCallback(async () => {
    if (selectedAssets.length === 0 || downloading) return;

    setDownloading(true);
    try {
      const saved = await downloadAssets(basePath, selectedAssets);
      if (!saved) return;
      toast.success(
        selectedAssets.length === 1
          ? "资产已下载"
          : `已打包下载 ${selectedAssets.length} 个资产`,
      );
    } catch (error) {
      console.error("[AssetLibrary] download failed", error);
      toast.error(error instanceof Error ? error.message : "下载资产失败");
    } finally {
      setDownloading(false);
    }
  }, [basePath, downloading, selectedAssets]);

  const handleDownloadSingleAsset = useCallback(
    async (asset: AssetRecord) => {
      if (downloading) return;

      setDownloading(true);
      try {
        const saved = await downloadAssets(basePath, [asset]);
        if (!saved) return;
        toast.success("资产已下载");
      } catch (error) {
        console.error("[AssetLibrary] download failed", error);
        toast.error(error instanceof Error ? error.message : "下载资产失败");
      } finally {
        setDownloading(false);
      }
    },
    [basePath, downloading],
  );

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";

      if (activeScope === "public") {
        toast.warning("公共资产暂不支持本地上传");
        return;
      }
      if (files.length === 0) return;

      try {
        const validFiles: Array<{
          file: File;
          mediaType: AssetMediaType;
        }> = [];
        const invalidFiles: File[] = [];

        for (const file of files) {
          const mediaType = getAssetMediaType(file);
          if (!mediaType) {
            invalidFiles.push(file);
            continue;
          }
          if (!isMediaTypeAllowedInCategory(mediaType, activeCategory)) {
            invalidFiles.push(file);
            continue;
          }
          validFiles.push({ file, mediaType });
        }

        if (invalidFiles.length > 0) {
          const fileNames = invalidFiles
            .slice(0, 3)
            .map((file) => file.name)
            .join("、");
          toast.warning(
            `已跳过不支持的资产类型：${fileNames}${invalidFiles.length > 3 ? " 等" : ""}。当前分类支持${getCategorySupportedTypesLabel(activeCategory)}`,
          );
        }

        if (validFiles.length === 0) return;

        for (const { file, mediaType } of validFiles) {
          await createAssetFromBuffer({
            basePath,
            name: file.name.replace(/\.[^.]+$/, ""),
            scope: activeScope,
            category: getUploadCategory(mediaType, activeCategory),
            mediaType,
            fileName: file.name,
            buffer: await file.arrayBuffer(),
            projectId:
              activeScope === "canvas" ? projectId || undefined : undefined,
            source: { type: "upload", projectId: projectId || undefined },
          });
        }

        toast.success(
          validFiles.length === 1
            ? "资产已上传"
            : `已上传 ${validFiles.length} 个资产`,
        );
        await reloadAssets();
      } catch (error) {
        console.error("[AssetLibrary] upload failed", error);
        toast.error(error instanceof Error ? error.message : "上传资产失败");
      }
    },
    [activeCategory, activeScope, basePath, projectId, reloadAssets],
  );

  const toggleSelected = useCallback((assetId: string) => {
    setSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }, []);

  const handleDeleteAssets = useCallback(
    (targetAssets: AssetRecord[]) => {
      if (targetAssets.length === 0) return;

      const referenceCount = targetAssets.reduce(
        (sum, asset) => sum + countAssetReferencesInCanvas(asset, nodes),
        0,
      );
      const referencedAssetCount = targetAssets.filter(
        (asset) => countAssetReferencesInCanvas(asset, nodes) > 0,
      ).length;

      const message =
        targetAssets.length === 1
          ? referenceCount > 0
            ? `该资产已被当前画布中的 ${referenceCount} 处引用，删除后相关节点可能无法正常显示。是否继续删除？`
            : "确定删除该资产吗？删除后不可恢复。"
          : referenceCount > 0
            ? `选中的 ${targetAssets.length} 个资产中有 ${referencedAssetCount} 个已被当前画布引用，共 ${referenceCount} 处引用。删除后相关节点可能无法正常显示。是否继续删除？`
            : `确定删除选中的 ${targetAssets.length} 个资产吗？删除后不可恢复。`;

      setDeleteConfirm({ assets: targetAssets, message });
    },
    [nodes],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    try {
      await deleteAssetsById(
        basePath,
        deleteConfirm.assets.map((asset) => asset.id),
      );
      setSelectedIds([]);
      setDeleteConfirm(null);
      toast.success("资产已删除");
      await reloadAssets();
    } catch (error) {
      console.error("[AssetLibrary] delete failed", error);
      toast.error("删除资产失败");
    }
  }, [basePath, deleteConfirm, reloadAssets]);

  const handleRenameAsset = useCallback(async () => {
    if (!renamingAsset) return;

    try {
      await renameAsset(basePath, renamingAsset.id, renameInput);
      toast.success("资产名称已更新");
      setRenamingAsset(null);
      setRenameInput("");
      await reloadAssets();
    } catch (error) {
      console.error("[AssetLibrary] rename failed", error);
      toast.error(error instanceof Error ? error.message : "修改资产名称失败");
    }
  }, [basePath, reloadAssets, renameInput, renamingAsset]);

  const handleOverlayDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!onDropAsset || isPageVariant) return;

      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) {
        return;
      }

      const rawPayload = event.dataTransfer.getData(CANVAS_ASSET_DRAG_MIME);
      if (!rawPayload) return;

      event.preventDefault();
      event.stopPropagation();

      try {
        const payload = JSON.parse(rawPayload) as CanvasAssetDragPayload;
        const asset = assets.find((item) => item.id === payload.asset?.id);
        if (!asset) return;

        onDropAsset(asset, { x: event.clientX, y: event.clientY });
        onClose();
      } catch {
        toast.error("资产拖拽失败");
      }
    },
    [assets, isPageVariant, onClose, onDropAsset],
  );

  const handleOverlayDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!onDropAsset || isPageVariant) return;
      if (
        !Array.from(event.dataTransfer.types).includes(CANVAS_ASSET_DRAG_MIME)
      ) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [isPageVariant, onDropAsset],
  );

  if (!open) return null;

  const overlayDragProps = isPageVariant
    ? {}
    : {
        onDragOver: handleOverlayDragOver,
        onDrop: handleOverlayDrop,
      };

  return (
    <div
      role={isPageVariant ? "region" : "dialog"}
      aria-modal={isPageVariant ? undefined : true}
      aria-label="资产库"
      tabIndex={isPageVariant ? undefined : -1}
      className={cn(
        isPageVariant
          ? "flex h-full min-h-0 w-full flex-col bg-[#09090b] text-white"
          : "fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-8 py-8 backdrop-blur-sm",
      )}
      {...overlayDragProps}
    >
      <div
        ref={panelRef}
        className={cn(
          "noflow nodrag nopan nowheel flex min-h-0 flex-col overflow-hidden text-white",
          isPageVariant
            ? "h-full w-full bg-[#09090b]"
            : "h-[min(760px,88vh)] w-[min(1180px,88vw)] rounded-xl border border-white/10 bg-[#202020] shadow-2xl",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-6">
            {visibleScopes.map((scope) => (
              <button
                type="button"
                key={scope.id}
                onClick={() => setActiveScope(scope.id)}
                className={cn(
                  "text-sm transition-colors",
                  activeScope === scope.id
                    ? "text-white"
                    : "text-white/38 hover:text-white/70",
                )}
              >
                {scope.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {batchMode ? (
              <>
                <span className="mr-2 text-xs text-white/50">
                  已选{selectedIds.length}项
                </span>
                <Button
                  size="sm"
                  onClick={() => void handleDeleteAssets(selectedAssets)}
                  disabled={selectedIds.length === 0}
                >
                  <IconTrash size={14} />
                  删除
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleDownloadAssets()}
                  disabled={selectedIds.length === 0 || downloading}
                >
                  <IconDownload size={14} />
                  {downloading ? "下载中" : "下载"}
                </Button>
                {allowInsert ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      selectedAssets.forEach((asset) => onUse?.(asset))
                    }
                    disabled={selectedIds.length === 0}
                  >
                    <IconCheck size={14} />
                    使用
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  onClick={() =>
                    setSelectedIds(pageAssets.map((asset) => asset.id))
                  }
                >
                  全选
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setBatchMode(true)}>
                批量操作
              </Button>
            )}
            {!isPageVariant ? (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
              >
                <IconX size={18} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between px-6 pt-5">
          <div className="flex items-center gap-5">
            {categories.map((category) => (
              <button
                type="button"
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "text-xs transition-colors",
                  activeCategory === category.id
                    ? "text-white"
                    : "text-white/38 hover:text-white/70",
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-white/35">
            {activeScope === "public"
              ? "公共资产接口待接入"
              : `${filteredAssets.length} 个资产`}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 gap-5 overflow-hidden px-6 py-6">
          <div className="min-w-0 flex-1 overflow-auto">
            {activeScope !== "public" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-[4/5] flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.03] text-white/50 transition-colors hover:border-[#B43FEB]/70 hover:bg-[#B43FEB]/10 hover:text-white"
                >
                  <IconUpload size={24} />
                  <span className="mt-3 text-xs">本地上传</span>
                </button>

                {loading ? (
                  <div className="col-span-full flex h-40 items-center justify-center text-sm text-white/45">
                    正在读取资产...
                  </div>
                ) : (
                  pageAssets.map((asset) => {
                    const selected = selectedIds.includes(asset.id);
                    const displayUrl = getAssetDisplayUrl(asset, basePath);

                    return (
                      <div
                        key={asset.id}
                        role="listitem"
                        draggable={allowInsert}
                        onDragStart={(event) => {
                          if (!allowInsert) return;
                          event.dataTransfer.effectAllowed = "copy";
                          event.dataTransfer.setData(
                            CANVAS_ASSET_DRAG_MIME,
                            JSON.stringify(createDragPayload(asset)),
                          );
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setContextMenu({
                            asset,
                            x: event.clientX,
                            y: event.clientY,
                          });
                        }}
                        className={cn(
                          "group relative overflow-hidden rounded-md border bg-[#2a2a2a] transition-colors",
                          selected || activePreviewAsset?.id === asset.id
                            ? "border-[#B43FEB] ring-1 ring-[#B43FEB]/50"
                            : "border-white/8 hover:border-white/20",
                        )}
                      >
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => {
                            if (batchMode) {
                              toggleSelected(asset.id);
                              return;
                            }
                            if (isPageVariant) {
                              setPreviewAsset(asset);
                            }
                          }}
                        >
                          <div className="flex aspect-[4/5] items-center justify-center bg-[#333]">
                            {asset.mediaType === "image" ? (
                              <img
                                src={displayUrl}
                                alt={asset.name}
                                className="h-full w-full object-cover"
                                draggable={false}
                              />
                            ) : asset.mediaType === "video" ? (
                              <video
                                src={displayUrl}
                                className="h-full w-full object-cover"
                                muted
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center text-white/55">
                                <IconMusic size={30} />
                                <span className="mt-2 text-xs">Audio</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-2">
                            <span className="text-white/45">
                              {getAssetIcon(asset.mediaType)}
                            </span>
                            <span className="min-w-0 truncate text-xs text-white/80">
                              {asset.name}
                            </span>
                          </div>
                        </button>

                        {batchMode ? (
                          <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded bg-black/70">
                            {selected ? <IconCheck size={14} /> : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-[360px] items-center justify-center rounded-md border border-dashed border-white/10 text-sm text-white/40">
                公共资产列表待后端接口接入
              </div>
            )}
          </div>
          {isPageVariant ? (
            <AssetPreviewPane asset={activePreviewAsset} basePath={basePath} />
          ) : null}
        </div>

        <div className="flex h-14 shrink-0 items-center border-t border-white/10 px-6">
          <div className="flex items-center gap-2 text-xs text-white/45">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30"
            >
              &lt;
            </button>
            <span className="rounded bg-white/10 px-2 py-1">{page}</span>
            <span>/</span>
            <span>{totalPages}</span>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages}
              className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30"
            >
              &gt;
            </button>
            <span className="ml-3">{PAGE_SIZE}条/页</span>
            <span>{getAssetCategoryLabel(activeCategory)}</span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept={getCategoryUploadAccept(activeCategory)}
          onChange={handleUpload}
        />
      </div>
      {contextMenu ? (
        <div
          className="fixed z-[90] w-32 overflow-hidden rounded-lg border border-white/10 bg-[#121214] p-1 text-sm text-white shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {allowInsert ? (
            <button
              type="button"
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-white/80 hover:bg-[#B43FEB]/10 hover:text-white"
              onClick={() => {
                onUse?.(contextMenu.asset);
                setContextMenu(null);
              }}
            >
              插入画布
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-white/80 hover:bg-[#B43FEB]/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={downloading}
            onClick={() => {
              const asset = contextMenu.asset;
              setContextMenu(null);
              void handleDownloadSingleAsset(asset);
            }}
          >
            下载
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-white/80 hover:bg-[#B43FEB]/10 hover:text-white"
            onClick={() => {
              setRenamingAsset(contextMenu.asset);
              setRenameInput(contextMenu.asset.name);
              setContextMenu(null);
            }}
          >
            重命名
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-red-300 hover:bg-red-500/15 hover:text-red-200"
            onClick={() => {
              const asset = contextMenu.asset;
              setContextMenu(null);
              void handleDeleteAssets([asset]);
            }}
          >
            删除
          </button>
        </div>
      ) : null}

      {renamingAsset ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40">
          <div className="w-[min(420px,90vw)] rounded-xl border border-white/10 bg-[#171717] p-5 text-white shadow-2xl">
            <div className="text-sm font-medium">修改资产名称</div>
            <input
              value={renameInput}
              onChange={(event) => setRenameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleRenameAsset();
                }
              }}
              className="mt-4 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#B43FEB]/70"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" onClick={() => setRenamingAsset(null)}>
                取消
              </Button>
              <Button
                size="sm"
                variant="blue"
                onClick={() => void handleRenameAsset()}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirm ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40">
          <div className="w-[min(460px,90vw)] rounded-xl border border-white/10 bg-[#171717] p-5 text-white shadow-2xl">
            <div className="text-sm font-medium">删除资产</div>
            <div className="mt-4 rounded-md border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-white/65">
              {deleteConfirm.message}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" onClick={() => setDeleteConfirm(null)}>
                取消
              </Button>
              <Button
                size="sm"
                className="border-red-500/30 bg-red-500/20 text-red-100 hover:bg-red-500/30"
                onClick={() => void handleConfirmDelete()}
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
