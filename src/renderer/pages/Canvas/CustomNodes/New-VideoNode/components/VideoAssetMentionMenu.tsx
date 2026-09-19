/**
 * 视频节点 @ 选择器（左右分栏）
 *
 * 左半部分：可 @ 提及的参考节点（已连接节点 + 已添加到参考列表的素材库资源）
 * 右半部分：个人素材库（侧边栏分类导航 + 内容区素材资源）
 *
 * 键盘：上下选择、Enter 激活、Escape 交给 TipTap 关闭。
 */

import {
    IconFolder,
    IconMusic,
    IconPhoto,
    IconVideo,
} from "@tabler/icons-react";
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
} from "react";
import { toast } from "sonner";
import { getAssetList, getProjectFolders } from "@/api/assets";
import type { AssetFolder, AssetListItem, MediaType } from "shared/types/api/assets";
import { cn } from "shared/utils/utils";
import type { RemoteAssetMentionPayload } from "./VideoPromptEditor";

interface ConnectedOption {
    id: string;
    label: string;
    originalLabel?: string;
    value: string;
    thumbnail: string;
    url?: string;
    fileUrl?: string;
    source?: string;
    scope?: string;
    assetId?: string;
    nodeId?: string;
    primaryCategory?: string;
    category?: string;
    folderId?: string;
    type: "image" | "video" | "audio";
    mediaType?: "image" | "video" | "audio";
}

type FlatOption =
    | { key: string; kind: "connected"; item: ConnectedOption }
    | { key: string; kind: "folder"; folder: AssetFolder }
    | { key: string; kind: "asset"; asset: AssetListItem };

interface VideoAssetMentionMenuProps {
    items: ConnectedOption[];
    projectId?: string | null;
    command: (payload: Record<string, unknown>) => void;
    onSelectRemoteAsset?: (payload: RemoteAssetMentionPayload) => void;
}

export interface VideoAssetMentionMenuHandle {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const mediaIconMap = {
    image: IconPhoto,
    video: IconVideo,
    audio: IconMusic,
} satisfies Record<MediaType, typeof IconPhoto>;

const getThumb = (asset: AssetListItem): string => {
    if (asset.thumbnailUrl) return asset.thumbnailUrl;
    if (asset.mediaType === "image") return asset.fileUrl;
    return "";
};

const getConnectedThumb = (item: ConnectedOption): string =>
    item.thumbnail || item.fileUrl || item.url || "";

const MediaIcon = ({
    mediaType,
    size = 16,
}: {
    mediaType: MediaType;
    size?: number;
}) => {
    const Icon = mediaIconMap[mediaType];
    return <Icon size={size} />;
};

export const VideoAssetMentionMenu = forwardRef<
    VideoAssetMentionMenuHandle,
    VideoAssetMentionMenuProps
>(({ items, projectId, command, onSelectRemoteAsset }, ref) => {
    const [folders, setFolders] = useState<AssetFolder[]>([]);
    const [foldersLoading, setFoldersLoading] = useState(false);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [assets, setAssets] = useState<AssetListItem[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const loadFolders = useCallback(async () => {
        if (!projectId) return;
        setFoldersLoading(true);
        try {
            const envelope = await getProjectFolders(projectId);
            if (!envelope || (envelope.code !== 0 && envelope.code !== 200)) {
                throw new Error(envelope?.msg || envelope?.message || "加载文件夹失败");
            }
            setFolders(Array.isArray(envelope.data) ? envelope.data : []);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "加载文件夹失败");
        } finally {
            setFoldersLoading(false);
        }
    }, [projectId]);

    const loadAssets = useCallback(
        async (folderId: string) => {
            if (!projectId) return;
            setAssetsLoading(true);
            try {
                const envelope = await getAssetList({
                    scope: "project",
                    projectId,
                    folderId,
                    page: 1,
                    pageSize: 50,
                    sortBy: "createTime",
                    sortOrder: "desc",
                });
                if (!envelope || (envelope.code !== 0 && envelope.code !== 200)) {
                    throw new Error(envelope?.msg || envelope?.message || "加载素材失败");
                }
                setAssets(Array.isArray(envelope.data?.list) ? envelope.data.list : []);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "加载素材失败");
                setAssets([]);
            } finally {
                setAssetsLoading(false);
            }
        },
        [projectId],
    );

    useEffect(() => {
        void loadFolders();
    }, [loadFolders]);

    useEffect(() => {
        if (folders.length === 0) return;
        setActiveFolderId((current) =>
            current && folders.some((folder) => folder.id === current)
                ? current
                : folders[0].id,
        );
    }, [folders]);

    useEffect(() => {
        if (!activeFolderId) {
            setAssets([]);
            return;
        }
        void loadAssets(activeFolderId);
    }, [activeFolderId, loadAssets]);

    const connectedOptions = useMemo<FlatOption[]>(
        () =>
            items.map((item) => ({
                key: `connected:${item.id}`,
                kind: "connected" as const,
                item,
            })),
        [items],
    );

    const folderOptions = useMemo<FlatOption[]>(
        () =>
            folders.map((folder) => ({
                key: `folder:${folder.id}`,
                kind: "folder" as const,
                folder,
            })),
        [folders],
    );

    const assetOptions = useMemo<FlatOption[]>(
        () =>
            assets.map((asset) => ({
                key: `asset:${asset.id}`,
                kind: "asset" as const,
                asset,
            })),
        [assets],
    );

    const flatOptions = useMemo<FlatOption[]>(
        () => [...connectedOptions, ...folderOptions, ...assetOptions],
        [assetOptions, connectedOptions, folderOptions],
    );

    const selectedKey = flatOptions[selectedIndex]?.key ?? null;

    useEffect(() => {
        setSelectedIndex((current) => {
            if (flatOptions.length === 0) return 0;
            return Math.min(current, flatOptions.length - 1);
        });
    }, [flatOptions.length]);

    const connectedGroup = useMemo(
        () =>
            connectedOptions.filter(
                (option): option is FlatOption & { kind: "connected" } =>
                    option.kind === "connected" &&
                    option.item.source !== "remote-asset",
            ),
        [connectedOptions],
    );
    const remoteGroup = useMemo(
        () =>
            connectedOptions.filter(
                (option): option is FlatOption & { kind: "connected" } =>
                    option.kind === "connected" && option.item.source === "remote-asset",
            ),
        [connectedOptions],
    );

    const activeFolder = useMemo(
        () => folders.find((folder) => folder.id === activeFolderId) ?? null,
        [activeFolderId, folders],
    );

    const insertConnected = useCallback(
        (item: ConnectedOption) => {
            command({
                id: item.id,
                label: item.label,
                originalLabel: item.originalLabel ?? item.label,
                value: item.value,
                thumbnail: item.thumbnail,
                url: item.url,
                fileUrl: item.fileUrl,
                source: item.source,
                scope: item.scope,
                assetId: item.assetId,
                nodeId: item.nodeId,
                primaryCategory: item.primaryCategory,
                category: item.category,
                folderId: item.folderId,
                type: item.type,
                mediaType: item.mediaType ?? item.type,
            });
        },
        [command],
    );

    const insertRemote = useCallback(
        (asset: AssetListItem) => {
            const id = `asset-${asset.id}`;
            const payload: RemoteAssetMentionPayload = {
                id,
                label: asset.name,
                value: asset.fileUrl,
                fileUrl: asset.fileUrl,
                thumbnail: getThumb(asset),
                mediaType: asset.mediaType,
                assetId: asset.id,
                scope: "project",
                folderId: asset.folderId ?? activeFolderId,
                primaryCategory: asset.primaryCategory,
                category: asset.categoryName,
            };
            onSelectRemoteAsset?.(payload);
            command({
                id,
                label: asset.name,
                originalLabel: asset.name,
                value: asset.fileUrl,
                thumbnail: payload.thumbnail,
                url: asset.fileUrl,
                fileUrl: asset.fileUrl,
                source: "remote-asset",
                scope: "project",
                assetId: asset.id,
                primaryCategory: asset.primaryCategory,
                category: asset.categoryName,
                folderId: asset.folderId ?? activeFolderId,
                type: asset.mediaType,
                mediaType: asset.mediaType,
            });
        },
        [activeFolderId, command, onSelectRemoteAsset],
    );

    const activate = useCallback(
        (option: FlatOption | undefined) => {
            if (!option) return;
            if (option.kind === "connected") {
                insertConnected(option.item);
            } else if (option.kind === "folder") {
                setActiveFolderId(option.folder.id);
            } else if (option.kind === "asset") {
                insertRemote(option.asset);
            }
        },
        [insertConnected, insertRemote],
    );

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === "ArrowUp") {
                event.preventDefault();
                if (flatOptions.length === 0) return true;
                setSelectedIndex((prev) => (prev - 1 + flatOptions.length) % flatOptions.length);
                return true;
            }
            if (event.key === "ArrowDown") {
                event.preventDefault();
                if (flatOptions.length === 0) return true;
                setSelectedIndex((prev) => (prev + 1) % flatOptions.length);
                return true;
            }
            if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                activate(flatOptions[selectedIndex]);
                return true;
            }
            return false;
        },
    }));

    const renderConnectedRow = (option: FlatOption & { kind: "connected" }) => {
        const item = option.item;
        const selected = option.key === selectedKey;
        const thumb = getConnectedThumb(item);
        return (
            <button
                key={option.key}
                type="button"
                className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
                    selected ? "bg-white/12" : "hover:bg-white/6",
                )}
                onMouseDown={(event) => {
                    event.preventDefault();
                    activate(option);
                }}
                onMouseEnter={() => setSelectedIndex(flatOptions.indexOf(option))}
            >
                {thumb && item.type !== "audio" ? (
                    <img
                        src={thumb}
                        alt={item.label}
                        className="h-8 w-8 shrink-0 rounded-md object-cover"
                        draggable={false}
                    />
                ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#B43FEB]/18 text-[#B43FEB]">
                        <MediaIcon mediaType={item.mediaType ?? item.type} />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] text-white/90">
                        {item.originalLabel || item.label}
                    </div>
                    {item.label && item.label !== (item.originalLabel || item.label) ? (
                        <div className="truncate text-[10px] text-white/40">
                            {item.label}
                        </div>
                    ) : null}
                </div>
            </button>
        );
    };

    return (
        <div className="flex max-h-96 w-160 overflow-hidden rounded-xl border border-white/12 bg-[#111217]/95 text-white shadow-[0_14px_34px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            {/* 左半部分：可 @ 提及的参考节点 */}
            <div className="flex w-52 shrink-0 flex-col border-r border-white/10">
                <div className="shrink-0 border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-white/60">
                    可 @ 提及
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                    {items.length === 0 ? (
                        <div className="px-2 py-3 text-center text-xs text-white/35">
                            暂无已添加的参考素材
                        </div>
                    ) : (
                        <>
                            {connectedGroup.length > 0 ? (
                                <div className="mb-1">
                                    <div className="px-1 py-1 text-[10px] text-white/42">
                                        已连接节点
                                    </div>
                                    {connectedGroup.map(renderConnectedRow)}
                                </div>
                            ) : null}
                            {remoteGroup.length > 0 ? (
                                <div>
                                    <div className="px-1 py-1 text-[10px] text-white/42">
                                        素材库资源
                                    </div>
                                    {remoteGroup.map(renderConnectedRow)}
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </div>

            {/* 右半部分：个人素材库 */}
            <div className="flex min-w-0 flex-1">
                {/* 侧边栏：分类导航 */}
                <div className="flex w-28 shrink-0 flex-col border-r border-white/10">
                    <div className="shrink-0 border-b border-white/10 px-2 py-2 text-[11px] font-semibold text-white/60">
                        素材分类
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-1">
                        {foldersLoading ? (
                            <div className="px-2 py-3 text-center text-xs text-white/35">
                                加载中…
                            </div>
                        ) : folders.length === 0 ? (
                            <div className="px-2 py-3 text-center text-xs text-white/35">
                                {projectId ? "暂无分类" : "未绑定项目"}
                            </div>
                        ) : (
                            folders.map((folder) => {
                                const key = `folder:${folder.id}`;
                                const selected = key === selectedKey;
                                const active = folder.id === activeFolderId;
                                return (
                                    <button
                                        key={folder.id}
                                        type="button"
                                        className={cn(
                                            "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left",
                                            active
                                                ? "bg-[#B43FEB]/20 text-white"
                                                : selected
                                                    ? "bg-white/12"
                                                    : "text-white/70 hover:bg-white/6",
                                        )}
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            activate(folderOptions.find((option) => option.kind === "folder" && option.folder.id === folder.id));
                                        }}
                                        onMouseEnter={() =>
                                            setSelectedIndex(
                                                flatOptions.findIndex((option) => option.key === key),
                                            )
                                        }
                                    >
                                        <IconFolder size={14} stroke={1.8} className="shrink-0" />
                                        <span className="min-w-0 flex-1 truncate text-[12px]">
                                            {folder.name}
                                        </span>
                                        <span className="shrink-0 text-[10px] text-white/40">
                                            {folder.assetCount}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 内容区：素材资源 */}
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="shrink-0 border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-white/60">
                        {activeFolder?.name ?? "素材"}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {assetsLoading ? (
                            <div className="px-2 py-3 text-center text-xs text-white/35">
                                加载中…
                            </div>
                        ) : assets.length === 0 ? (
                            <div className="px-2 py-3 text-center text-xs text-white/35">
                                暂无素材
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-1.5">
                                {assets.map((asset) => {
                                    const key = `asset:${asset.id}`;
                                    const selected = key === selectedKey;
                                    const thumb = getThumb(asset);
                                    return (
                                        <button
                                            key={asset.id}
                                            type="button"
                                            className={cn(
                                                "group relative aspect-square overflow-hidden rounded-lg border bg-[#1a1a20]",
                                                selected
                                                    ? "border-[#B43FEB] ring-1 ring-[#B43FEB]/50"
                                                    : "border-white/10 hover:border-[#B43FEB]/60",
                                            )}
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                activate(assetOptions.find((option) => option.kind === "asset" && option.asset.id === asset.id));
                                            }}
                                            onMouseEnter={() =>
                                                setSelectedIndex(
                                                    flatOptions.findIndex((option) => option.key === key),
                                                )
                                            }
                                        >
                                            {thumb ? (
                                                <img
                                                    src={thumb}
                                                    alt={asset.name}
                                                    className="size-full object-cover"
                                                    draggable={false}
                                                />
                                            ) : (
                                                <div className="flex size-full items-center justify-center text-white/35">
                                                    <MediaIcon mediaType={asset.mediaType} />
                                                </div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/40 to-transparent px-1.5 pb-1 pt-4">
                                                <div className="truncate text-left text-[10px] leading-4 text-white/92">
                                                    {asset.name}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

VideoAssetMentionMenu.displayName = "VideoAssetMentionMenu";
