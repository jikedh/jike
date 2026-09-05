/**
 * 项目个人素材库数据 Hook
 *
 * 数据来源：
 * - 文件夹：GET /v1/projects/:projectId/folders（后端幂等初始化 5 个默认目录）
 * - 素材：GET /v1/assets?scope=project&projectId=&folderId=&keyword=&page=
 * - 上传：uploadAndCreateAsset（scope=project + projectId + folderId）
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import {
    createProjectFolder,
    deleteProjectFolder,
    getAssetList,
    getAssetCategories,
    getProjectFolders,
    renameProjectFolder,
} from "@/api/assets";
import type {
    AssetCategory,
    AssetFolder,
    AssetListItem,
    MediaType,
    PrimaryCategory,
} from "shared/types/api/assets";
import {
    uploadAndCreateAsset,
    type UploadAndCreateInput,
} from "../../utils/remoteAssetUpload";

const PAGE_SIZE = 30;
const SUCCESS_CODES = new Set<number>([0, 200]);

const unwrapEnvelope = <T>(envelope: { code: number; msg?: string; message?: string; data: T } | undefined | null): T => {
    if (!envelope) throw new Error("请求无响应数据");
    if (!SUCCESS_CODES.has(envelope.code)) {
        throw new Error(envelope.msg || envelope.message || "请求失败");
    }
    return envelope.data;
};

/** 后端分类 code 可能为空，优先取 code，缺省回退分类 ID。 */
const categoryValue = (category: AssetCategory): PrimaryCategory =>
    (category.code || "").trim() || String(category.id);

/** 找到首个叶子分类值，用于上传时确定必填主分类。 */
const findDefaultLeafCategory = (categories: AssetCategory[]): PrimaryCategory => {
    const stack: AssetCategory[] = [...categories];
    while (stack.length > 0) {
        const node = stack.pop() as AssetCategory;
        if (node.children && node.children.length > 0) {
            stack.push(...node.children);
        } else {
            return categoryValue(node);
        }
    }
    return "";
};

export interface UseProjectAssetLibraryResult {
    folders: AssetFolder[];
    foldersLoading: boolean;
    activeFolderId: string | null;
    setActiveFolderId: (id: string | null) => void;
    assets: AssetListItem[];
    assetsLoading: boolean;
    keyword: string;
    setKeyword: (value: string) => void;
    page: number;
    setPage: Dispatch<SetStateAction<number>>;
    totalPages: number;
    total: number;
    refreshFolders: () => Promise<void>;
    refreshAssets: () => Promise<void>;
    createFolder: (name: string) => Promise<void>;
    renameFolder: (folderId: string, name: string) => Promise<void>;
    removeFolder: (folderId: string) => Promise<void>;
    uploadFiles: (
        files: File[],
        onProgress?: (current: number, total: number, percent: number) => void,
    ) => Promise<void>;
    defaultPrimaryCategory: PrimaryCategory;
}

export const useProjectAssetLibrary = (
    projectId: string | null,
): UseProjectAssetLibraryResult => {
    const [folders, setFolders] = useState<AssetFolder[]>([]);
    const [foldersLoading, setFoldersLoading] = useState(false);
    const [activeFolderId, setActiveFolderIdState] = useState<string | null>(null);
    const [assets, setAssets] = useState<AssetListItem[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [defaultPrimaryCategory, setDefaultPrimaryCategory] =
        useState<PrimaryCategory>("");

    const refreshFolders = useCallback(async () => {
        if (!projectId) return;
        setFoldersLoading(true);
        try {
            const list = unwrapEnvelope(await getProjectFolders(projectId));
            const folders = Array.isArray(list) ? list : [];
            setFolders(folders);
            setActiveFolderIdState((current) => {
                if (current && folders.some((folder) => folder.id === current)) {
                    return current;
                }
                return folders[0]?.id ?? null;
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "加载文件夹失败");
        } finally {
            setFoldersLoading(false);
        }
    }, [projectId]);

    const refreshAssets = useCallback(async () => {
        if (!projectId) return;
        setAssetsLoading(true);
        try {
            const data = unwrapEnvelope(
                await getAssetList({
                    scope: "project",
                    projectId,
                    folderId: activeFolderId ?? undefined,
                    keyword: keyword.trim() || undefined,
                    page,
                    pageSize: PAGE_SIZE,
                    sortBy: "createTime",
                    sortOrder: "desc",
                }),
            );
            setAssets(Array.isArray(data?.list) ? data.list : []);
            setTotal(data?.pagination?.total ?? 0);
            setTotalPages(Math.max(1, data?.pagination?.totalPages ?? 1));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "加载素材失败");
            setAssets([]);
            setTotal(0);
            setTotalPages(1);
        } finally {
            setAssetsLoading(false);
        }
    }, [activeFolderId, keyword, page, projectId]);

    // 分类树仅用于上传时确定必填主分类。
    useEffect(() => {
        if (!projectId) return;
        getAssetCategories()
            .then((envelope) => {
                const categories = unwrapEnvelope(envelope);
                setDefaultPrimaryCategory(
                    Array.isArray(categories) ? findDefaultLeafCategory(categories) : "",
                );
            })
            .catch(() => {
                setDefaultPrimaryCategory("");
            });
    }, [projectId]);

    useEffect(() => {
        void refreshFolders();
    }, [refreshFolders]);

    useEffect(() => {
        void refreshAssets();
    }, [refreshAssets]);

    useEffect(() => {
        setPage(1);
    }, [activeFolderId, keyword]);

    const setActiveFolderId = useCallback((id: string | null) => {
        setActiveFolderIdState(id);
    }, []);

    const createFolder = useCallback(
        async (name: string) => {
            if (!projectId) return;
            unwrapEnvelope(await createProjectFolder(projectId, { name }));
            await refreshFolders();
        },
        [projectId, refreshFolders],
    );

    const renameFolder = useCallback(
        async (folderId: string, name: string) => {
            if (!projectId) return;
            unwrapEnvelope(await renameProjectFolder(projectId, folderId, { name }));
            await refreshFolders();
        },
        [projectId, refreshFolders],
    );

    const removeFolder = useCallback(
        async (folderId: string) => {
            if (!projectId) return;
            unwrapEnvelope(await deleteProjectFolder(projectId, folderId));
            await refreshFolders();
            await refreshAssets();
        },
        [projectId, refreshAssets, refreshFolders],
    );

    const uploadFiles = useCallback(
        async (
            files: File[],
            onProgress?: (current: number, total: number, percent: number) => void,
        ) => {
            if (!projectId) {
                toast.error("当前画布未绑定项目");
                return;
            }
            if (!defaultPrimaryCategory) {
                toast.error("分类数据未就绪，请稍后重试");
                return;
            }
            let done = 0;
            for (const file of files) {
                const mediaType = inferMediaType(file);
                if (!mediaType) {
                    toast.warning(`已跳过不支持的文件：${file.name}`);
                    done += 1;
                    continue;
                }
                try {
                    const input: UploadAndCreateInput = {
                        blob: file,
                        fileName: file.name || `${Date.now()}`,
                        mediaType,
                        primaryCategory: defaultPrimaryCategory,
                        scope: "project",
                        projectId,
                        folderId: activeFolderId,
                        name: file.name.replace(/\.[^.]+$/, "") || "未命名素材",
                    };
                    await uploadAndCreateAsset(input);
                    done += 1;
                    onProgress?.(done, files.length, Math.round((done / files.length) * 100));
                } catch (error) {
                    toast.error(
                        error instanceof Error ? error.message : `上传失败：${file.name}`,
                    );
                    done += 1;
                    onProgress?.(done, files.length, Math.round((done / files.length) * 100));
                }
            }
            await refreshAssets();
            await refreshFolders();
        },
        [activeFolderId, defaultPrimaryCategory, projectId, refreshAssets, refreshFolders],
    );

    return {
        folders,
        foldersLoading,
        activeFolderId,
        setActiveFolderId,
        assets,
        assetsLoading,
        keyword,
        setKeyword,
        page,
        setPage,
        totalPages,
        total,
        refreshFolders,
        refreshAssets,
        createFolder,
        renameFolder,
        removeFolder,
        uploadFiles,
        defaultPrimaryCategory,
    };
};

const inferMediaType = (file: File): MediaType | null => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return null;
};
