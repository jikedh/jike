import {
  IconCheck,
  IconLayoutGrid,
  IconMusic,
  IconPhoto,
  IconSearch,
  IconTag,
  IconVideo,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TagFilterPanel } from "@/pages/Assets/components/TagFilterPanel";
import { useRemoteAssetLibrary } from "@/pages/Canvas/hooks/useRemoteAssetLibrary";
import {
  formatFileSize,
  formatTimestamp,
  getMediaTypeLabel,
  getRemoteAssetCategoryLabel,
  type RemoteAsset,
} from "@/pages/Canvas/utils/remoteAssets";
import type { MediaType } from "shared/types/api/assets";
import { cn } from "shared/utils/utils";

const PAGE_SIZE = 24;

const getMediaIcon = (mediaType: MediaType, size = 16) => {
  if (mediaType === "video") return <IconVideo size={size} />;
  if (mediaType === "audio") return <IconMusic size={size} />;
  return <IconPhoto size={size} />;
};

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

const AssetDetailPanel = ({ asset }: { asset: RemoteAsset | null }) => {
  if (!asset) {
    return (
      <aside className="hidden w-80 shrink-0 border-l border-white/8 pl-5 xl:flex">
        <div className="flex size-full items-center justify-center rounded-md border border-dashed border-white/8 text-sm text-white/35">
          选择资产查看详情
        </div>
      </aside>
    );
  }

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
      </div>
    </aside>
  );
};

export default function AssetsPage() {
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);

  // 本页仅展示公共资产；筛选仅依赖标签（AND 语义）与关键词
  const options = useMemo(
    () => ({
      scope: "public" as const,
      keyword,
      tags: selectedTags,
      page,
      pageSize: PAGE_SIZE,
      sortBy: "createTime" as const,
      sortOrder: "desc" as const,
    }),
    [keyword, selectedTags, page],
  );
  const { assets, total, totalPages, loading, error } =
    useRemoteAssetLibrary(options);
  const previewAsset =
    assets.find((asset) => asset.id === previewAssetId) || null;

  useEffect(() => {
    setPage(1);
    setPreviewAssetId(null);
  }, [keyword, selectedTags]);

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
          <div>暂无符合条件的资产</div>
          {selectedTags.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className="text-xs text-[#d486ff] transition-colors hover:text-white"
            >
              清空标签筛选
            </button>
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
          <div>
            <h1 className="text-lg font-medium">公共资产库</h1>
            <p className="text-xs text-white/35">
              面向所有用户开放的 AI 仿真人漫剧资产
            </p>
          </div>
        </div>
        <form
          className="flex items-center gap-2"
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
      </header>

      <TagFilterPanel selectedTags={selectedTags} onTagsChange={setSelectedTags} />

      <main className="flex min-h-0 flex-1 gap-5 overflow-hidden px-6 py-5">
        <div className="asset-library-scrollbar min-w-0 flex-1 overflow-y-auto">
          {renderGrid()}
        </div>
        <AssetDetailPanel asset={previewAsset} />
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
    </div>
  );
}
