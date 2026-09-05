/**
 * 视频节点 @ 选择器
 *
 * 分组：
 * - 已连接节点（来自节点已有参考项的媒体）
 * - 个人素材库（当前项目的文件夹 → 项目专属素材）
 *
 * 键盘：上下选择、Enter 激活、Esc/左方向返回上一级。
 */

import {
    IconChevronLeft,
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

type View = "root" | "folders" | "assets";

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

interface RemoteOption {
    asset: AssetListItem;
}

type MenuOption =
    | { kind: "connected"; item: ConnectedOption }
    | { kind: "folder-entry" }
    | { kind: "folder"; folder: AssetFolder }
    | { kind: "asset"; asset: AssetListItem };

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

export const VideoAssetMentionMenu = forwardRef<
    VideoAssetMentionMenuHandle,
    VideoAssetMentionMenuProps
>(({ items, projectId, command, onSelectRemoteAsset }, ref) => {
    const [view, setView] = useState<View>("root");
    const [folders, setFolders] = useState<AssetFolder[]>([]);
    const [activeFolder, setActiveFolder] = useState<AssetFolder | null>(null);
    const [assets, setAssets] = useState<AssetListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const connectedOptions = useMemo<MenuOption[]>(
        () => items.map((item) => ({ kind: "connected", item })),
        [items],
    );

    const folderOptions = useMemo<MenuOption[]>(
        () => folders.map((folder) => ({ kind: "folder", folder })),
        [folders],
    );

    const assetOptions = useMemo<MenuOption[]>(
        () => assets.map((asset) => ({ kind: "asset", asset })),
        [assets],
    );

    const options = useMemo<MenuOption[]>(() => {
        if (view === "folders") return folderOptions;
        if (view === "assets") return assetOptions;
        return [...connectedOptions, { kind: "folder-entry" }];
    }, [assetOptions, connectedOptions, folderOptions, view]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [options.length]);

    const loadFolders = useCallback(async () => {
        if (!projectId) {
            toast.warning("当前画布未绑定项目");
            return;
        }
        setLoading(true);
        try {
            const envelope = await getProjectFolders(projectId);
            if (!envelope || (envelope.code !== 0 && envelope.code !== 200)) {
                throw new Error(envelope?.msg || envelope?.message || "加载文件夹失败");
            }
            setFolders(Array.isArray(envelope.data) ? envelope.data : []);
            setView("folders");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "加载文件夹失败");
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    const openFolder = useCallback(
        async (folder: AssetFolder) => {
            if (!projectId) return;
            setActiveFolder(folder);
            setLoading(true);
            try {
                const envelope = await getAssetList({
                    scope: "project",
                    projectId,
                    folderId: folder.id,
                    page: 1,
                    pageSize: 50,
                    sortBy: "createTime",
                    sortOrder: "desc",
                });
                if (!envelope || (envelope.code !== 0 && envelope.code !== 200)) {
                    throw new Error(envelope?.msg || envelope?.message || "加载素材失败");
                }
                setAssets(Array.isArray(envelope.data?.list) ? envelope.data.list : []);
                setView("assets");
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "加载素材失败");
            } finally {
                setLoading(false);
            }
        },
        [projectId],
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
                folderId: asset.folderId ?? activeFolder?.id,
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
                folderId: asset.folderId ?? activeFolder?.id,
                type: asset.mediaType,
                mediaType: asset.mediaType,
            });
        },
        [activeFolder, command, onSelectRemoteAsset],
    );

    const activate = useCallback(
        (option: MenuOption | undefined) => {
            if (!option) return;
            if (option.kind === "connected") {
                insertConnected(option.item);
                return;
            }
            if (option.kind === "folder-entry") {
                void loadFolders();
                return;
            }
            if (option.kind === "folder") {
                void openFolder(option.folder);
                return;
            }
            if (option.kind === "asset") {
                insertRemote(option.asset);
            }
        },
        [insertConnected, insertRemote, loadFolders, openFolder],
    );

    const goBack = useCallback(() => {
        if (view === "assets") {
            setAssets([]);
            setActiveFolder(null);
            setView("folders");
        } else if (view === "folders") {
            setFolders([]);
            setView("root");
        }
    }, [view]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
                return true;
            }
            if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % options.length);
                return true;
            }
            if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                activate(options[selectedIndex]);
                return true;
            }
            if (event.key === "Escape" || event.key === "ArrowLeft") {
                event.preventDefault();
                if (view === "root") {
                    return false;
                }
                goBack();
                return true;
            }
            return false;
        },
    }));

    const title = view === "root" ? "插入引用" : view === "folders" ? "个人素材库" : activeFolder?.name ?? "";

    return (
        <div className="max-h-80 w-80 overflow-y-auto rounded-xl border border-white/12 bg-[#111217]/95 text-white shadow-[0_14px_34px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-white/10 bg-[#111217]/95 px-2 py-1.5 text-[11px] font-semibold text-white/60 backdrop-blur-xl">
                {view !== "root" ? (
                    <button
                        type="button"
                        className="rounded p-0.5 text-white/65 hover:bg-white/10 hover:text-white"
                        onMouseDown={(event) => {
                            event.preventDefault();
                            goBack();
                        }}
                    >
                        <IconChevronLeft size={14} />
                    </button>
                ) : null}
                <span>{title}</span>
            </div>

            {loading ? (
                <div className="px-3 py-4 text-center text-xs text-white/40">加载中…</div>
            ) : options.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-white/40">
                    {view === "root" ? "暂无可用素材" : "暂无内容"}
                </div>
            ) : (
                options.map((option, index) => {
                    const selected = index === selectedIndex;
                    if (option.kind === "folder-entry") {
                        return (
                            <button
                                key="folder-entry"
                                type="button"
                                className={cn(
                                    "flex w-full items-center gap-3 border-b border-white/6 px-3 py-2 text-left last:border-b-0",
                                    selected ? "bg-white/12" : "hover:bg-white/6",
                                )}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    activate(option);
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#B43FEB]/18 text-[#B43FEB]">
                                    <IconFolder size={16} />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm">个人素材库</span>
                                    <span className="truncate text-xs text-white/45">
                                        当前项目的角色、场景、道具、风格等素材
                                    </span>
                                </div>
                            </button>
                        );
                    }

                    if (option.kind === "folder") {
                        return (
                            <button
                                key={option.folder.id}
                                type="button"
                                className={cn(
                                    "flex w-full items-center gap-3 border-b border-white/6 px-3 py-2 text-left last:border-b-0",
                                    selected ? "bg-white/12" : "hover:bg-white/6",
                                )}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    activate(option);
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#B43FEB]/18 text-[#B43FEB]">
                                    <IconFolder size={16} />
                                </div>
                                <div className="flex min-w-0 flex-1 items-center justify-between">
                                    <span className="truncate text-sm">{option.folder.name}</span>
                                    <span className="shrink-0 text-xs text-white/40">
                                        {option.folder.assetCount}
                                    </span>
                                </div>
                            </button>
                        );
                    }

                    if (option.kind === "asset") {
                        const thumb = getThumb(option.asset);
                        const Icon = mediaIconMap[option.asset.mediaType];
                        return (
                            <button
                                key={option.asset.id}
                                type="button"
                                className={cn(
                                    "flex w-full items-center gap-3 border-b border-white/6 px-3 py-2 text-left last:border-b-0",
                                    selected ? "bg-white/12" : "hover:bg-white/6",
                                )}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    activate(option);
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                {thumb ? (
                                    <img
                                        src={thumb}
                                        alt={option.asset.name}
                                        className="h-8 w-8 shrink-0 rounded-md object-cover"
                                        draggable={false}
                                    />
                                ) : (
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#B43FEB]/18 text-[#B43FEB]">
                                        <Icon size={16} />
                                    </div>
                                )}
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm">{option.asset.name}</span>
                                    <span className="truncate text-xs text-white/45">
                                        {option.asset.mediaType}
                                    </span>
                                </div>
                            </button>
                        );
                    }

                    const item = option.item;
                    const connectedThumb = getConnectedThumb(item);
                    const Icon = mediaIconMap[item.mediaType ?? item.type];
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={cn(
                                "flex w-full items-center gap-3 border-b border-white/6 px-3 py-2 text-left last:border-b-0",
                                selected ? "bg-white/12" : "hover:bg-white/6",
                            )}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                activate(option);
                            }}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            {connectedThumb && item.type !== "audio" ? (
                                <img
                                    src={connectedThumb}
                                    alt={item.label}
                                    className="h-8 w-8 shrink-0 rounded-md object-cover"
                                    draggable={false}
                                />
                            ) : (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#B43FEB]/18 text-[#B43FEB]">
                                    <Icon size={16} />
                                </div>
                            )}
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm">
                                    {item.originalLabel || item.label}
                                </span>
                                {item.label && item.label !== (item.originalLabel || item.label) ? (
                                    <span className="truncate text-xs text-white/45">
                                        {item.label}
                                    </span>
                                ) : null}
                            </div>
                        </button>
                    );
                })
            )}
        </div>
    );
});

VideoAssetMentionMenu.displayName = "VideoAssetMentionMenu";
