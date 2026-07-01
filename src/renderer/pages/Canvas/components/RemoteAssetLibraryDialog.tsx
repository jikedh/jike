/**
 * Canvas 远程资产库弹窗
 *
 * 设计目标：
 * - 全部数据来源后端 `/v1/assets` 接口，无任何本地资产路径依赖
 * - 三个 scope 独立模块：项目资产 / 个人资产 / 公共资产
 * - 支持媒体类型 + 主分类 + 关键词搜索 + 分页 + 排序 + 批量操作
 * - 拖拽插入 / 双击插入 / 批量插入 / 上下文菜单
 *
 * 权限差异：
 * - 项目资产：只读项目 scope=project + projectId
 * - 个人资产：仅当前用户
 * - 公共资产：所有人可见；删除/编辑/标签按钮仅资产创建者展示（最终由后端校验）
 */

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
    IconX,
} from "@tabler/icons-react";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type DragEvent,
    type MouseEvent,
} from "react";
import { toast } from "sonner";
import {
    CANVAS_REMOTE_ASSET_DRAG_MIME,
    CANVAS_REMOTE_ASSET_DRAG_TYPE,
    type CanvasRemoteAssetDragPayload,
} from "shared/constants/canvasDrag";
import type {
    AssetScope,
    MediaType,
    PrimaryCategory,
} from "shared/types/api/assets";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { useRemoteAssetLibrary } from "../hooks/useRemoteAssetLibrary";
import {
    CATEGORY_LABEL_MAP,
    formatFileSize,
    formatTimestamp,
    getCategoryLabel,
    getMediaTypeLabel,
    MEDIA_LABEL_MAP,
    SCOPE_LABEL_MAP,
    type RemoteAsset,
} from "../utils/remoteAssets";

export interface RemoteAssetLibraryDialogProps {
    open: boolean;
    /** 当前画布项目 ID（项目资产 scope 必须） */
    projectId?: string | null;
    /** 当前登录用户 ID，用于判断是否展示编辑/删除按钮 */
    currentUserId?: string;
    /** 外部刷新 token（创建后递增以触发重载） */
    refreshKey?: number;
    onClose: () => void;
    /** 双击/确认插入 */
    onUseMany?: (assets: RemoteAsset[]) => void;
    /** 单个插入（右键菜单 / 单选确认） */
    onUseOne?: (asset: RemoteAsset) => void;
    /** 拖拽到弹窗外 */
    onDropAsset?: (
        asset: RemoteAsset,
        clientPosition: { x: number; y: number },
    ) => void;
    /** 触发上传入口 */
    onRequestUpload?: () => void;
}

interface ScopeOption {
    id: AssetScope;
    label: string;
    description: string;
}

const SCOPE_OPTIONS: ScopeOption[] = [
    {
        id: "project",
        label: SCOPE_LABEL_MAP.project,
        description: "当前项目下的资产",
    },
    {
        id: "personal",
        label: SCOPE_LABEL_MAP.personal,
        description: "我创建的个人资产",
    },
    {
        id: "public",
        label: SCOPE_LABEL_MAP.public,
        description: "全局共享的公共资产",
    },
];

const MEDIA_OPTIONS: Array<{ id: MediaType; label: string }> = [
    { id: "image", label: MEDIA_LABEL_MAP.image },
    { id: "video", label: MEDIA_LABEL_MAP.video },
    { id: "audio", label: MEDIA_LABEL_MAP.audio },
];

const CATEGORY_OPTIONS: Array<{ id: PrimaryCategory; label: string }> = [
    { id: "character", label: CATEGORY_LABEL_MAP.character },
    { id: "scene", label: CATEGORY_LABEL_MAP.scene },
    { id: "prop", label: CATEGORY_LABEL_MAP.prop },
];

const PAGE_SIZE = 24;

const getMediaIcon = (mediaType: MediaType, size = 16) => {
    if (mediaType === "video") return <IconVideo size={size} />;
    if (mediaType === "audio") return <IconMusic size={size} />;
    return <IconPhoto size={size} />;
};

const buildDragPayload = (
    asset: RemoteAsset,
): CanvasRemoteAssetDragPayload => ({
    type: CANVAS_REMOTE_ASSET_DRAG_TYPE,
    asset: {
        id: asset.id,
        name: asset.name,
        scope: asset.scope,
        mediaType: asset.mediaType,
        primaryCategory: asset.primaryCategory,
        fileUrl: asset.fileUrl,
        thumbnailUrl: asset.thumbnailUrl,
        projectId: asset.projectId,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
    },
});

const AssetThumbnail = ({ asset }: { asset: RemoteAsset }) => {
    const [errored, setErrored] = useState(false);
    const hasThumb = Boolean(asset.thumbnailUrl) && !errored;

    if (asset.mediaType === "audio" || !hasThumb) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-[#2a2a30] to-[#1a1a1f] text-white/55">
                {getMediaIcon(asset.mediaType, 26)}
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                    {getMediaTypeLabel(asset.mediaType)}
                </span>
            </div>
        );
    }

    return (
        <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
        />
    );
};

const AssetCardSkeleton = () => (
    <div className="overflow-hidden rounded-lg border border-white/8 bg-white/[0.03]">
        <div className="aspect-[4/5] animate-pulse bg-white/[0.04]" />
        <div className="space-y-1.5 px-2 py-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-white/[0.04]" />
        </div>
    </div>
);

interface AssetDetailPanelProps {
    asset: RemoteAsset | null;
    currentUserId?: string;
    onClose: () => void;
    onRequestDelete?: (asset: RemoteAsset) => void;
}

const AssetDetailPanel = ({
    asset,
    currentUserId,
    onClose,
    onRequestDelete,
}: AssetDetailPanelProps) => {
    if (!asset) {
        return (
            <aside className="hidden w-80 shrink-0 border-l border-white/8 pl-5 xl:flex">
                <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-white/8 text-sm text-white/35">
                    选择资产查看详情
                </div>
            </aside>
        );
    }

    const canEdit = currentUserId ? asset.userId === currentUserId : false;

    return (
        <aside className="hidden w-80 shrink-0 border-l border-white/8 pl-5 xl:flex">
            <div className="flex h-full w-full min-h-0 flex-col">
                <div className="flex items-center justify-between pb-3">
                    <span className="text-xs uppercase tracking-widest text-white/35">
                        详情
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
                        aria-label="关闭详情"
                    >
                        <IconX size={14} />
                    </button>
                </div>

                <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-md border border-white/8 bg-[#151517]">
                    {asset.mediaType === "image" && asset.fileUrl ? (
                        <img
                            src={asset.fileUrl}
                            alt={asset.name}
                            className="max-h-full max-w-full object-contain"
                            decoding="async"
                        />
                    ) : asset.mediaType === "video" && asset.fileUrl ? (
                        <video
                            src={asset.fileUrl}
                            className="max-h-full max-w-full"
                            controls
                        />
                    ) : asset.mediaType === "audio" && asset.fileUrl ? (
                        <div className="flex w-full flex-col items-center gap-3 px-5 text-white/65">
                            <IconMusic size={36} />
                            <audio src={asset.fileUrl} className="w-full" controls />
                        </div>
                    ) : (
                        <div className="text-sm text-white/35">无可用预览</div>
                    )}
                </div>

                <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
                    <div>
                        <div className="text-xs text-white/35">名称</div>
                        <div className="mt-1 break-words text-white/90">{asset.name}</div>
                    </div>

                    {asset.description ? (
                        <div>
                            <div className="text-xs text-white/35">描述</div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-white/75">
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
                                {getCategoryLabel(asset.primaryCategory)}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-white/35">范围</div>
                            <div className="mt-1 text-white/80">
                                {SCOPE_LABEL_MAP[asset.scope]}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-white/35">引用</div>
                            <div className="mt-1 text-white/80">{asset.refCount}</div>
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

                {canEdit && onRequestDelete ? (
                    <div className="border-t border-white/8 pt-3">
                        <Button
                            size="sm"
                            className="w-full border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                            onClick={() => onRequestDelete(asset)}
                        >
                            <IconTrash size={14} />
                            删除
                        </Button>
                    </div>
                ) : null}
            </div>
        </aside>
    );
};

interface ContextMenuState {
    asset: RemoteAsset;
    x: number;
    y: number;
}

interface DeleteConfirmState {
    assets: RemoteAsset[];
    message: string;
}

export const RemoteAssetLibraryDialog = ({
    open,
    projectId,
    currentUserId,
    refreshKey,
    onClose,
    onUseMany,
    onUseOne,
    onDropAsset,
    onRequestUpload,
}: RemoteAssetLibraryDialogProps) => {
    // 顶部 tab
    const [activeScope, setActiveScope] = useState<AssetScope>(() =>
        projectId ? "project" : "personal",
    );
    // 过滤条件
    const [activeMediaType, setActiveMediaType] = useState<MediaType>("image");
    const [activeCategory, setActiveCategory] = useState<PrimaryCategory | "all">(
        "all",
    );
    const [keyword, setKeyword] = useState("");
    const [keywordInput, setKeywordInput] = useState("");
    const [page, setPage] = useState(1);
    // 选择
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(
        null,
    );
    const [deleting, setDeleting] = useState(false);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const selectionAnchorRef = useRef<string | null>(null);

    // 当画布无 projectId 时，自动隐藏项目资产 scope
    const visibleScopes = useMemo(
        () =>
            projectId
                ? SCOPE_OPTIONS
                : SCOPE_OPTIONS.filter((scope) => scope.id !== "project"),
        [projectId],
    );

    // 仅图片/视频支持主分类（音频忽略）
    const supportsCategory = activeMediaType !== "audio";

    const libraryOptions = useMemo(
        () => ({
            projectId: projectId || null,
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
            projectId,
            refreshKey,
            supportsCategory,
        ],
    );

    const {
        assets,
        total,
        totalPages,
        loading,
        error,
        deleteAsset,
    } = useRemoteAssetLibrary(libraryOptions);

    // ===================== 副作用：清理选择 =====================

    useEffect(() => {
        if (!open) {
            setSelectedIds([]);
            setPreviewAssetId(null);
            setContextMenu(null);
            setDeleteConfirm(null);
            selectionAnchorRef.current = null;
        }
    }, [open]);

    useEffect(() => {
        // 切换条件时重置选择 / 翻页
        setSelectedIds([]);
        setPreviewAssetId(null);
        selectionAnchorRef.current = null;
        setPage(1);
    }, [activeScope, activeMediaType, activeCategory, keyword]);

    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        window.addEventListener("pointerdown", close);
        window.addEventListener("keydown", close);
        return () => {
            window.removeEventListener("pointerdown", close);
            window.removeEventListener("keydown", close);
        };
    }, [contextMenu]);

    // 项目资产 scope 缺少 projectId 时给出提示
    useEffect(() => {
        if (!visibleScopes.some((scope) => scope.id === activeScope)) {
            setActiveScope(visibleScopes[0]?.id || "personal");
        }
    }, [activeScope, visibleScopes]);

    // ===================== 派生数据 =====================

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const selectedAssets = useMemo(
        () => assets.filter((asset) => selectedIdSet.has(asset.id)),
        [assets, selectedIdSet],
    );
    const previewAsset =
        assets.find((asset) => asset.id === previewAssetId) || null;
    const isAllPageSelected =
        assets.length > 0 && assets.every((asset) => selectedIdSet.has(asset.id));

    // ===================== 选择 =====================

    const handleAssetClick = useCallback(
        (event: MouseEvent, asset: RemoteAsset) => {
            const additive = event.ctrlKey || event.metaKey;
            const rangeSelect = event.shiftKey;
            const ids = assets.map((item) => item.id);

            setSelectedIds((current) => {
                if (rangeSelect) {
                    const fallbackAnchor = current[0] || asset.id;
                    const anchor = selectionAnchorRef.current || fallbackAnchor;
                    const anchorIndex = ids.indexOf(anchor);
                    const targetIndex = ids.indexOf(asset.id);
                    if (anchorIndex >= 0 && targetIndex >= 0) {
                        const start = Math.min(anchorIndex, targetIndex);
                        const end = Math.max(anchorIndex, targetIndex);
                        const rangeIds = ids.slice(start, end + 1);
                        return additive
                            ? Array.from(new Set([...current, ...rangeIds]))
                            : rangeIds;
                    }
                }
                selectionAnchorRef.current = asset.id;
                if (additive) {
                    return current.includes(asset.id)
                        ? current.filter((id) => id !== asset.id)
                        : [...current, asset.id];
                }
                return [asset.id];
            });
            setPreviewAssetId(asset.id);
        },
        [assets],
    );

    const toggleAllPageSelection = useCallback(() => {
        if (assets.length === 0) return;
        setSelectedIds((current) => {
            const set = new Set(current);
            if (assets.every((asset) => set.has(asset.id))) {
                for (const asset of assets) set.delete(asset.id);
            } else {
                for (const asset of assets) set.add(asset.id);
            }
            return Array.from(set);
        });
    }, [assets]);

    // ===================== 删除 =====================

    const requestDeleteAssets = useCallback((targetAssets: RemoteAsset[]) => {
        if (targetAssets.length === 0) return;
        const message =
            targetAssets.length === 1
                ? `确定删除资产「${targetAssets[0].name}」？被项目引用时会变更为下架状态。`
                : `确定删除选中的 ${targetAssets.length} 个资产？被项目引用的资产会变更为下架状态。`;
        setDeleteConfirm({ assets: targetAssets, message });
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteConfirm || deleting) return;
        setDeleting(true);
        let unlisted = 0;
        let deleted = 0;
        let failed = 0;
        try {
            for (const asset of deleteConfirm.assets) {
                // eslint-disable-next-line no-await-in-loop
                const result = await deleteAsset(asset.id);
                if (!result) {
                    failed += 1;
                } else if (result.action === "deleted") {
                    deleted += 1;
                } else {
                    unlisted += 1;
                }
            }
            if (failed === 0) {
                const parts: string[] = [];
                if (deleted > 0) parts.push(`已删除 ${deleted} 个`);
                if (unlisted > 0) parts.push(`已下架 ${unlisted} 个`);
                toast.success(parts.join("，") || "操作完成");
            } else {
                toast.error(`部分删除失败（${failed} 个）`);
            }
            setSelectedIds([]);
            setPreviewAssetId(null);
            setDeleteConfirm(null);
        } finally {
            setDeleting(false);
        }
    }, [deleteAsset, deleteConfirm, deleting]);

    // ===================== 拖拽 =====================

    const handleOverlayDragOver = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            if (!onDropAsset) return;
            if (
                !Array.from(event.dataTransfer.types).includes(
                    CANVAS_REMOTE_ASSET_DRAG_MIME,
                )
            ) {
                return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        },
        [onDropAsset],
    );

    const handleOverlayDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            if (!onDropAsset) return;
            const target = event.target as Node | null;
            if (target && panelRef.current?.contains(target)) return;

            const raw = event.dataTransfer.getData(CANVAS_REMOTE_ASSET_DRAG_MIME);
            if (!raw) return;
            event.preventDefault();
            event.stopPropagation();
            try {
                const payload = JSON.parse(raw) as CanvasRemoteAssetDragPayload;
                const asset = assets.find((item) => item.id === payload.asset.id);
                if (!asset) return;
                onDropAsset(asset, { x: event.clientX, y: event.clientY });
                onClose();
            } catch {
                toast.error("资产拖拽失败");
            }
        },
        [assets, onClose, onDropAsset],
    );

    // ===================== 子渲染 =====================

    const renderGrid = () => {
        if (loading && assets.length === 0) {
            return (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
                    {Array.from({ length: 8 }).map((_, idx) => (
                        <AssetCardSkeleton key={idx} />
                    ))}
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-md border border-dashed border-red-500/30 bg-red-500/5 text-sm text-red-300">
                    {error}
                </div>
            );
        }

        if (activeScope === "project" && !projectId) {
            return (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-md border border-dashed border-white/10 text-sm text-white/40">
                    未关联项目，无法查看项目资产
                </div>
            );
        }

        if (assets.length === 0) {
            return (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-white/10 text-sm text-white/45">
                    <IconLayoutGrid size={28} className="text-white/30" />
                    <div>暂无资产</div>
                    {onRequestUpload && activeScope !== "public" ? (
                        <Button size="sm" variant="blue" onClick={onRequestUpload}>
                            <IconUpload size={14} />
                            上传资产
                        </Button>
                    ) : null}
                </div>
            );
        }

        return (
            <div
                role="list"
                aria-label="assets"
                className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start gap-4"
            >
                {assets.map((asset) => {
                    const selected = selectedIdSet.has(asset.id);
                    const isPreview = previewAssetId === asset.id;
                    return (
                        <div
                            key={asset.id}
                            role="listitem"
                            draggable
                            onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = "copy";
                                event.dataTransfer.setData(
                                    CANVAS_REMOTE_ASSET_DRAG_MIME,
                                    JSON.stringify(buildDragPayload(asset)),
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
                            onDoubleClick={() => onUseOne?.(asset)}
                            className={cn(
                                "group relative overflow-hidden rounded-lg border bg-[#2a2a2e] transition-colors",
                                selected || isPreview
                                    ? "border-[#B43FEB] ring-1 ring-[#B43FEB]/45"
                                    : "border-white/8 hover:border-white/25",
                            )}
                        >
                            <button
                                type="button"
                                className="block w-full text-left"
                                onClick={(event) => handleAssetClick(event, asset)}
                            >
                                <div className="flex aspect-[4/5] items-center justify-center bg-[#1c1c20]">
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
                            </button>

                            {selected ? (
                                <div className="pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded bg-black/70">
                                    <IconCheck size={14} />
                                </div>
                            ) : null}

                            {asset.scope === "public" ? (
                                <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200">
                                    public
                                </span>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        );
    };

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="远程资产库"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-6 py-8 backdrop-blur-sm"
            onDragOver={handleOverlayDragOver}
            onDrop={handleOverlayDrop}
        >
            <div
                ref={panelRef}
                className="noflow nodrag nopan nowheel flex h-[min(820px,92vh)] w-[min(1240px,94vw)] flex-col overflow-hidden rounded-xl border border-white/8 bg-[#15151a] text-white shadow-2xl"
            >
                {/* Header: scope tabs + 关闭 */}
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/8 px-6">
                    <nav className="flex items-center gap-1">
                        {visibleScopes.map((scope) => (
                            <button
                                type="button"
                                key={scope.id}
                                onClick={() => setActiveScope(scope.id)}
                                title={scope.description}
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                                    activeScope === scope.id
                                        ? "bg-[#B43FEB]/20 text-white"
                                        : "text-white/55 hover:bg-white/5 hover:text-white",
                                )}
                            >
                                {scope.label}
                            </button>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        {onRequestUpload && activeScope !== "public" ? (
                            <Button size="sm" variant="blue" onClick={onRequestUpload}>
                                <IconUpload size={14} />
                                上传资产
                            </Button>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
                            aria-label="关闭"
                        >
                            <IconX size={18} />
                        </button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/8 px-6 py-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-white/35">媒体</span>
                        {MEDIA_OPTIONS.map((option) => (
                            <button
                                type="button"
                                key={option.id}
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
                            <button
                                type="button"
                                onClick={() => setActiveCategory("all")}
                                className={cn(
                                    "rounded-md px-2 py-1 text-xs transition-colors",
                                    activeCategory === "all"
                                        ? "bg-white/10 text-white"
                                        : "text-white/55 hover:text-white",
                                )}
                            >
                                全部
                            </button>
                            {CATEGORY_OPTIONS.map((option) => (
                                <button
                                    type="button"
                                    key={option.id}
                                    onClick={() => setActiveCategory(option.id)}
                                    className={cn(
                                        "rounded-md px-2 py-1 text-xs transition-colors",
                                        activeCategory === option.id
                                            ? "bg-white/10 text-white"
                                            : "text-white/55 hover:text-white",
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    ) : null}

                    <form
                        className="ml-auto flex items-center gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setKeyword(keywordInput.trim());
                        }}
                    >
                        <div className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs text-white/65 focus-within:border-[#B43FEB]/60">
                            <IconSearch size={13} />
                            <input
                                value={keywordInput}
                                onChange={(event) => setKeywordInput(event.target.value)}
                                placeholder="搜索资产名称、描述、标签"
                                maxLength={120}
                                className="h-full w-52 bg-transparent text-xs outline-none placeholder:text-white/30"
                            />
                            {keywordInput ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setKeywordInput("");
                                        setKeyword("");
                                    }}
                                    className="text-white/40 hover:text-white"
                                    aria-label="清除搜索"
                                >
                                    <IconX size={12} />
                                </button>
                            ) : null}
                        </div>
                        <Button size="sm" type="submit">
                            搜索
                        </Button>
                    </form>
                </div>

                {/* Body: 网格 + 详情 */}
                <div className="flex min-h-0 flex-1 gap-5 overflow-hidden px-6 py-5">
                    <div className="asset-library-scrollbar min-w-0 flex-1 overflow-y-auto">
                        {renderGrid()}
                    </div>
                    <AssetDetailPanel
                        asset={previewAsset}
                        currentUserId={currentUserId}
                        onClose={() => setPreviewAssetId(null)}
                        onRequestDelete={(asset) => requestDeleteAssets([asset])}
                    />
                </div>

                {/* Footer: 分页 + 选择操作 */}
                <div className="flex h-14 shrink-0 items-center justify-between border-t border-white/8 px-6">
                    <div className="flex items-center gap-3 text-xs text-white/45">
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                            disabled={page <= 1 || loading}
                            className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30"
                        >
                            上一页
                        </button>
                        <span className="rounded bg-white/8 px-2 py-1 text-white/75">
                            {page}
                        </span>
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

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50">
                            已选 {selectedIds.length} 项
                        </span>
                        <Button
                            size="sm"
                            onClick={toggleAllPageSelection}
                            disabled={assets.length === 0}
                        >
                            {isAllPageSelected ? "全不选" : "全选"}
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => requestDeleteAssets(selectedAssets)}
                            disabled={
                                selectedAssets.length === 0 ||
                                selectedAssets.some(
                                    (asset) =>
                                        currentUserId
                                            ? asset.userId !== currentUserId
                                            : false,
                                )
                            }
                            className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        >
                            <IconTrash size={13} />
                            删除
                        </Button>
                        <Button size="sm" onClick={onClose}>
                            取消
                        </Button>
                        <Button
                            size="sm"
                            variant="blue"
                            ignoreTitleCase
                            onClick={() => onUseMany?.(selectedAssets)}
                            disabled={selectedAssets.length === 0}
                        >
                            确定
                        </Button>
                    </div>
                </div>
            </div>

            {/* Context menu */}
            {contextMenu ? (
                <div
                    className="fixed z-[90] w-36 overflow-hidden rounded-lg border border-white/10 bg-[#121214] p-1 text-sm shadow-2xl"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        className="flex w-full items-center rounded-md px-3 py-2 text-left text-white/80 hover:bg-[#B43FEB]/10 hover:text-white"
                        onClick={() => {
                            onUseOne?.(contextMenu.asset);
                            setContextMenu(null);
                        }}
                    >
                        插入画布
                    </button>
                    {(!currentUserId || contextMenu.asset.userId === currentUserId) ? (
                        <button
                            type="button"
                            className="flex w-full items-center rounded-md px-3 py-2 text-left text-red-300 hover:bg-red-500/15 hover:text-red-200"
                            onClick={() => {
                                const asset = contextMenu.asset;
                                setContextMenu(null);
                                requestDeleteAssets([asset]);
                            }}
                        >
                            删除
                        </button>
                    ) : null}
                </div>
            ) : null}

            {/* Delete confirm */}
            {deleteConfirm ? (
                <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40">
                    <div className="w-[min(460px,90vw)] rounded-xl border border-white/10 bg-[#171717] p-5 text-white shadow-2xl">
                        <div className="text-sm font-medium">删除资产</div>
                        <div className="mt-4 rounded-md border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-white/70">
                            {deleteConfirm.message}
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button
                                size="sm"
                                onClick={() => setDeleteConfirm(null)}
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

            {/* Loading overlay */}
            {loading && assets.length > 0 ? (
                <div className="pointer-events-none absolute bottom-20 right-12 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
                    正在加载...
                </div>
            ) : null}
        </div>
    );
};
