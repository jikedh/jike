import {
  IconCheck,
  IconLayoutGrid,
  IconMusic,
  IconPhoto,
  IconSearch,
  IconTag,
  IconTrash,
  IconUpload,
  IconVideo,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getAssetCategories } from "@/api/assets";
import { Button } from "@/components/ui/button";
import { AssetCategoryCascadeSelect } from "@/pages/Canvas/components/AssetCategoryCascadeSelect";
import {
  RemoteCreateAssetDialog,
  type RemoteCreateAssetRequest,
} from "@/pages/Canvas/components/RemoteCreateAssetDialog";
import { useRemoteAssetLibrary } from "@/pages/Canvas/hooks/useRemoteAssetLibrary";
import {
  formatFileSize,
  formatTimestamp,
  getMediaTypeLabel,
  getRemoteAssetCategoryLabel,
  MEDIA_LABEL_MAP,
  type RemoteAsset,
} from "@/pages/Canvas/utils/remoteAssets";
import type {
  AssetCategory,
  AssetScope,
  MediaType,
  PrimaryCategory,
} from "shared/types/api/assets";
import { cn, getJikeingUserId } from "shared/utils/utils";

const PAGE_SIZE = 24;

const MEDIA_OPTIONS: Array<{ id: MediaType; label: string }> = [
  { id: "image", label: MEDIA_LABEL_MAP.image },
  { id: "video", label: MEDIA_LABEL_MAP.video },
  { id: "audio", label: MEDIA_LABEL_MAP.audio },
];

const FALLBACK_CATEGORY_OPTIONS: AssetCategory[] = [
  { id: "character", code: "character", name: "角色", sort: 10, status: 1 },
  { id: "scene", code: "scene", name: "场景", sort: 20, status: 1 },
  { id: "prop", code: "prop", name: "道具", sort: 30, status: 1 },
];

const getCategoryValue = (category: AssetCategory): PrimaryCategory =>
  category.code || String(category.id);

const hasCategoryValue = (
  categories: AssetCategory[],
  value: PrimaryCategory,
): boolean =>
  categories.some(
    (category) =>
      getCategoryValue(category) === value ||
      hasCategoryValue(category.children || [], value),
  );

const getMediaIcon = (mediaType: MediaType, size = 16) => {
  if (mediaType === "video") return <IconVideo size={size} />;
  if (mediaType === "audio") return <IconMusic size={size} />;
  return <IconPhoto size={size} />;
};

const getMediaTypeFromFile = (file: File): MediaType | null => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
};

const getInitialName = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, "").trim() || "未命名资产";

const AssetThumbnail = ({ asset }: { asset: RemoteAsset }) => {
  const [errored, setErrored] = useState(false);
  const hasThumbnail = Boolean(asset.thumbnailUrl) && !errored;

  if (asset.mediaType === "audio") {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1 bg-linear-to-br from-[#2a2a30] to-[#1a1a1f] text-white/55">
        {getMediaIcon(asset.mediaType, 26)}
        <span className="text-[10px] uppercase tracking-wider text-white/40">
          {getMediaTypeLabel(asset.mediaType)}
        </span>
      </div>
    );
  }

  if (hasThumbnail) {
    return (
      <img
        src={asset.thumbnailUrl}
        alt={asset.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setErrored(true)}
        className="size-full object-cover"
      />
    );
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-linear-to-br from-[#2a2a30] via-[#202027] to-[#18181d] text-white/60">
      {getMediaIcon(asset.mediaType, 28)}
      <span className="text-[10px] uppercase tracking-wider text-white/40">
        {getMediaTypeLabel(asset.mediaType)}
      </span>
    </div>
  );
};

const AssetCardSkeleton = () => (
  <div className="overflow-hidden rounded-lg border border-white/8 bg-white/3">
    <div className="aspect-4/5 animate-pulse bg-white/4" />
    <div className="flex flex-col gap-1.5 px-2 py-2">
      <div className="h-3 w-3/4 animate-pulse rounded bg-white/6" />
      <div className="h-2 w-1/2 animate-pulse rounded bg-white/4" />
    </div>
  </div>
);

interface AssetDetailPanelProps {
  asset: RemoteAsset | null;
  currentUserId: string;
  onRequestDelete: (asset: RemoteAsset) => void;
}

const AssetDetailPanel = ({
  asset,
  currentUserId,
  onRequestDelete,
}: AssetDetailPanelProps) => {
  if (!asset) {
    return (
      <aside className="hidden w-80 shrink-0 border-l border-white/8 pl-5 xl:flex">
        <div className="flex size-full items-center justify-center rounded-md border border-dashed border-white/8 text-sm text-white/35">
          选择资产查看详情
        </div>
      </aside>
    );
  }

  const canDelete = Boolean(currentUserId) && asset.userId === currentUserId;

  return (
    <aside className="hidden w-80 shrink-0 border-l border-white/8 pl-5 xl:flex">
      <div className="flex min-h-0 w-full flex-col">
        <div className="mb-3 text-xs uppercase tracking-widest text-white/35">
          详情
        </div>
        <div className="flex min-h-50 items-center justify-center overflow-hidden rounded-md border border-white/8 bg-[#151517]">
          {asset.mediaType === "image" && asset.fileUrl ? (
            <img
              src={asset.fileUrl}
              alt={asset.name}
              className="max-h-full max-w-full object-contain"
              decoding="async"
            />
          ) : asset.mediaType === "video" && asset.fileUrl ? (
            <video src={asset.fileUrl} className="max-h-full max-w-full" controls />
          ) : asset.mediaType === "audio" && asset.fileUrl ? (
            <div className="flex w-full flex-col items-center gap-3 px-5 text-white/65">
              <IconMusic size={36} />
              <audio src={asset.fileUrl} className="w-full" controls />
            </div>
          ) : (
            <div className="text-sm text-white/35">无可用预览</div>
          )}
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 text-sm">
          <div>
            <div className="text-xs text-white/35">名称</div>
            <div className="mt-1 wrap-break-word text-white/90">{asset.name}</div>
          </div>
          {asset.description ? (
            <div>
              <div className="text-xs text-white/35">描述</div>
              <div className="mt-1 whitespace-pre-wrap wrap-break-word text-white/75">
                {asset.description}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-white/35">媒体类型</div>
              <div className="mt-1 flex items-center gap-1.5 text-white/80">
                {getMediaIcon(asset.mediaType, 14)}
                {getMediaTypeLabel(asset.mediaType)}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/35">分类</div>
              <div className="mt-1 text-white/80">
                {getRemoteAssetCategoryLabel(asset)}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/35">大小</div>
              <div className="mt-1 text-white/80">
                {formatFileSize(asset.fileSize)}
              </div>
            </div>
            {asset.width && asset.height ? (
              <div>
                <div className="text-xs text-white/35">尺寸</div>
                <div className="mt-1 text-white/80">
                  {asset.width} × {asset.height}
                </div>
              </div>
            ) : null}
          </div>
          {asset.tagNames.length > 0 ? (
            <div>
              <div className="text-xs text-white/35">标签</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {asset.tagNames.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-[#B43FEB]/15 px-2 py-0.5 text-[11px] text-[#d486ff]"
                  >
                    <IconTag size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <div className="text-xs text-white/35">更新时间</div>
            <div className="mt-1 text-white/70">
              {formatTimestamp(asset.updateTime || asset.createTime)}
            </div>
          </div>
        </div>

        {canDelete ? (
          <div className="mt-3 border-t border-white/8 pt-3">
            <Button
              size="sm"
              className="w-full border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              onClick={() => onRequestDelete(asset)}
            >
              <IconTrash data-icon="inline-start" />
              删除
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

export default function AssetsPage() {
  const currentUserId = getJikeingUserId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeScope, setActiveScope] = useState<
    Extract<AssetScope, "personal" | "public">
  >("personal");
  const [activeMediaType, setActiveMediaType] = useState<MediaType>("image");
  const [activeCategory, setActiveCategory] = useState<PrimaryCategory | "all">(
    "all",
  );
  const [categoryOptions, setCategoryOptions] = useState<AssetCategory[]>(
    FALLBACK_CATEGORY_OPTIONS,
  );
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RemoteAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createRequest, setCreateRequest] =
    useState<RemoteCreateAssetRequest | null>(null);

  const supportsCategory = activeMediaType !== "audio";
  const options = useMemo(
    () => ({
      scope: activeScope,
      mediaType: activeMediaType,
      primaryCategory:
        supportsCategory && activeCategory !== "all"
          ? activeCategory
          : undefined,
      keyword,
      page,
      pageSize: PAGE_SIZE,
      sortBy: "createTime" as const,
      sortOrder: "desc" as const,
      refreshToken: refreshKey,
    }),
    [
      activeCategory,
      activeMediaType,
      activeScope,
      keyword,
      page,
      refreshKey,
      supportsCategory,
    ],
  );
  const { assets, total, totalPages, loading, error, deleteAsset } =
    useRemoteAssetLibrary(options);
  const previewAsset = assets.find((asset) => asset.id === previewAssetId) || null;

  useEffect(() => {
    let cancelled = false;
    void getAssetCategories()
      .then((envelope) => {
        if (
          cancelled ||
          !Array.isArray(envelope.data) ||
          envelope.data.length === 0
        ) {
          return;
        }
        if (envelope.code === 0 || envelope.code === 200) {
          setCategoryOptions(envelope.data);
          setActiveCategory((current) =>
            current !== "all" && !hasCategoryValue(envelope.data, current)
              ? "all"
              : current,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
    setPreviewAssetId(null);
  }, [activeScope, activeMediaType, activeCategory, keyword]);

  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      const mediaType = getMediaTypeFromFile(file);
      if (!mediaType) {
        toast.error("仅支持上传图片、视频或音频文件");
        return;
      }

      setCreateRequest({
        mediaType,
        initialName: getInitialName(file.name),
        blob: file,
        fileName: file.name,
        defaultScope: "personal",
      });
    },
    [],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (
      !deleteTarget ||
      deleting ||
      !currentUserId ||
      deleteTarget.userId !== currentUserId
    ) {
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteAsset(deleteTarget.id);
      if (!result) return;
      toast.success(result.action === "deleted" ? "资产已删除" : "资产已下架");
      setPreviewAssetId(null);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [currentUserId, deleteAsset, deleteTarget, deleting]);

  const renderGrid = () => {
    if (loading && assets.length === 0) {
      return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <AssetCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex min-h-70 items-center justify-center rounded-md border border-dashed border-red-500/30 bg-red-500/5 text-sm text-red-300">
          {error}
        </div>
      );
    }

    if (assets.length === 0) {
      return (
        <div className="flex min-h-70 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-white/10 text-sm text-white/45">
          <IconLayoutGrid size={28} className="text-white/30" />
          <div>暂无资产</div>
          {activeScope === "personal" ? (
            <Button
              size="sm"
              variant="blue"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload data-icon="inline-start" />
              上传资产
            </Button>
          ) : null}
        </div>
      );
    }

    return (
      <div
        role="list"
        aria-label="资产列表"
        className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-4"
      >
        {assets.map((asset) => {
          const selected = previewAssetId === asset.id;
          return (
            <button
              key={asset.id}
              type="button"
              role="listitem"
              onClick={() => setPreviewAssetId(asset.id)}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-[#2a2a2e] text-left transition-colors",
                selected
                  ? "border-[#B43FEB] ring-1 ring-[#B43FEB]/45"
                  : "border-white/8 hover:border-white/25",
              )}
            >
              <div className="flex aspect-4/5 items-center justify-center bg-[#1c1c20]">
                <AssetThumbnail asset={asset} />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-2">
                <span className="text-white/45">
                  {getMediaIcon(asset.mediaType)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-white/85">
                  {asset.name}
                </span>
              </div>
              {selected ? (
                <div className="pointer-events-none absolute left-2 top-2 flex size-5 items-center justify-center rounded bg-black/70">
                  <IconCheck size={14} />
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-[#09090b] text-white">
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-3">
        <div className="flex items-center gap-3">
          <IconLayoutGrid className="text-[#B43FEB]" size={22} />
          <h1 className="text-lg font-medium">资产库</h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/4 p-1">
          {(["personal", "public"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setActiveScope(scope)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                activeScope === scope
                  ? "bg-[#B43FEB]/20 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white",
              )}
            >
              {scope === "personal" ? "个人资产" : "公共资产"}
            </button>
          ))}
        </div>
        {activeScope === "personal" ? (
          <Button
            size="sm"
            variant="blue"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload data-icon="inline-start" />
            上传资产
          </Button>
        ) : (
          <div className="w-20" />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={handleFileSelected}
        />
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/8 px-6 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/35">媒体</span>
          {MEDIA_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActiveMediaType(option.id)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                activeMediaType === option.id
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:text-white",
              )}
            >
              {getMediaIcon(option.id, 13)}
              {option.label}
            </button>
          ))}
        </div>
        {supportsCategory ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/35">分类</span>
            <AssetCategoryCascadeSelect
              categories={categoryOptions}
              value={activeCategory}
              onChange={setActiveCategory}
              includeAll
            />
          </div>
        ) : null}
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setKeyword(keywordInput.trim());
          }}
        >
          <div className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/4 px-2.5 text-xs text-white/65 focus-within:border-[#B43FEB]/60">
            <IconSearch size={13} />
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索资产名称、描述、标签"
              maxLength={120}
              className="h-full w-52 bg-transparent text-xs outline-none placeholder:text-white/30"
            />
          </div>
          <Button size="sm" type="submit">
            搜索
          </Button>
        </form>
      </div>

      <main className="flex min-h-0 flex-1 gap-5 overflow-hidden px-6 py-5">
        <div className="asset-library-scrollbar min-w-0 flex-1 overflow-y-auto">
          {renderGrid()}
        </div>
        <AssetDetailPanel
          asset={previewAsset}
          currentUserId={currentUserId}
          onRequestDelete={setDeleteTarget}
        />
      </main>

      <footer className="flex h-14 shrink-0 items-center justify-between border-t border-white/8 px-6 text-xs text-white/45">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading}
            className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30"
          >
            上一页
          </button>
          <span className="rounded bg-white/8 px-2 py-1 text-white/75">{page}</span>
          <span>/</span>
          <span>{totalPages}</span>
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={page >= totalPages || loading}
            className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30"
          >
            下一页
          </button>
          <span className="ml-3 text-white/35">共 {total} 个</span>
        </div>
        {loading && assets.length > 0 ? <span>正在加载...</span> : null}
      </footer>

      <RemoteCreateAssetDialog
        open={Boolean(createRequest)}
        request={createRequest}
        onClose={() => setCreateRequest(null)}
        onCreated={() => setRefreshKey((current) => current + 1)}
      />

      {deleteTarget ? (
        <div className="fixed inset-0 z-85 flex items-center justify-center bg-black/40 px-6">
          <div className="w-[min(460px,90vw)] rounded-xl border border-white/10 bg-[#171717] p-5 text-white shadow-2xl">
            <div className="text-sm font-medium">删除资产</div>
            <p className="mt-4 text-sm leading-6 text-white/70">
              确定删除资产「{deleteTarget.name}」？被项目引用时会变更为下架状态。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="border-red-500/30 bg-red-500/20 text-red-100 hover:bg-red-500/30"
                loading={deleting}
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
}
