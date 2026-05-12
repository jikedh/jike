import {
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconFolder,
  IconMusic,
  IconPhoto,
  IconPlus,
  IconTrash,
  IconUpload,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AssetFolder,
  type AssetCategory,
  type AssetMediaType,
  type AssetRecord,
  type AssetScope,
  createAssetFolderId,
  createAssetFromBuffer,
  deleteAssetFolderById,
  deleteAssetsById,
  readAssetIndex,
  getAssetCategoryLabel,
  getAssetDisplayUrl,
  renameAsset,
  renameAssetFolder,
  upsertAssetFolder,
} from "service/assetStorage";
import {
  CANVAS_ASSET_DRAG_MIME,
  CANVAS_ASSET_DRAG_TYPE,
  type CanvasAssetDragPayload,
} from "shared/constants/canvasDrag";
import {
  SUPPORTED_ASSET_AUDIO_EXTENSIONS,
  SUPPORTED_ASSET_IMAGE_EXTENSIONS,
  SUPPORTED_ASSET_VIDEO_EXTENSIONS,
  getAssetMediaType,
} from "shared/constants/mediaTypes";
import type { AllNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { downloadAssets } from "../utils/assetDownload";
import {
  buildCanvasMediaAssets,
  renameCanvasMediaAssetInNodes,
  removeCanvasMediaAssetsFromNodes,
} from "../utils/canvasMediaAssets";

type AssetLibraryDialogProps = {
  open: boolean;
  basePath: string;
  projectId?: string | null;
  nodes: AllNodeType[];
  refreshKey?: number;
  onClose: () => void;
  onUse?: (asset: AssetRecord) => void;
  onUseMany?: (assets: AssetRecord[]) => void;
  onDropAsset?: (
    asset: AssetRecord,
    clientPosition: { x: number; y: number },
  ) => void;
  variant?: "dialog" | "page";
  hidePreviewPane?: boolean;
};

type AssetNameDialogMode = "create-folder" | "rename-folder" | "rename-asset";

const scopes: Array<{ id: AssetScope; label: string }> = [
  { id: "project", label: "项目资产" },
  { id: "canvas", label: "画布资产" },
  { id: "public", label: "公共资产" },
];

const projectCategories: Array<{ id: AssetCategory; label: string }> = [
  { id: "role", label: "角色" },
  { id: "scene", label: "场景" },
  { id: "prop", label: "道具" },
  { id: "audio", label: "音效" },
];

const canvasCategories: Array<{ id: AssetCategory; label: string }> = [
  { id: "image", label: "图片" },
  { id: "video", label: "视频" },
  { id: "audio", label: "音频" },
];

const PAGE_SIZE = 24;

const categoryAliases: Record<string, AssetCategory> = {
  role: "role",
  roles: "role",
  character: "role",
  characters: "role",
  person: "role",
  people: "role",
  "人物": "role",
  "角色": "role",
  scene: "scene",
  scenes: "scene",
  "场景": "scene",
  prop: "prop",
  props: "prop",
  object: "prop",
  objects: "prop",
  "道具": "prop",
  audio: "audio",
  audios: "audio",
  sound: "audio",
  sounds: "audio",
  sfx: "audio",
  "音频": "audio",
  "音效": "audio",
};

const normalizeImportPath = (value: string) => value.replace(/\\/g, "/");

const getFileRelativePath = (file: File) =>
  normalizeImportPath(
    ((file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name),
  );

const getImportCategory = (file: File): AssetCategory | null => {
  const parts = getFileRelativePath(file).split("/").filter(Boolean);
  const folderParts = parts.slice(1, -1);

  for (const part of folderParts) {
    const normalized = part.trim().toLowerCase();
    const category = categoryAliases[part.trim()] || categoryAliases[normalized];
    if (category) return category;
  }

  return null;
};

const isCategoryMediaAllowed = (
  category: AssetCategory,
  mediaType: AssetMediaType,
) => {
  if (category === "audio") return mediaType === "audio";
  if (category === "role" || category === "scene" || category === "prop") {
    return mediaType === "image" || mediaType === "video";
  }
  return category === mediaType;
};

const getCategoryUploadAccept = (category: AssetCategory) =>
  category === "audio"
    ? SUPPORTED_ASSET_AUDIO_EXTENSIONS.join(",")
    : [
        ...SUPPORTED_ASSET_IMAGE_EXTENSIONS,
        ...SUPPORTED_ASSET_VIDEO_EXTENSIONS,
      ].join(",");

const getCategoryUploadHint = (category: AssetCategory) =>
  category === "audio"
    ? "支持 mp3/wav/m4a/aac/ogg"
    : "支持 jpg/jpeg/png/webp/gif/mp4/webm/mov";

const getAssetIcon = (mediaType: AssetMediaType) => {
  if (mediaType === "video") return <IconVideo size={16} />;
  if (mediaType === "audio") return <IconMusic size={16} />;
  return <IconPhoto size={16} />;
};

const getMediaTypeLabel = (mediaType: AssetMediaType) => {
  if (mediaType === "image") return "图片";
  if (mediaType === "video") return "视频";
  return "音频";
};

const createDragPayload = (asset: AssetRecord): CanvasAssetDragPayload => ({
  type: CANVAS_ASSET_DRAG_TYPE,
  asset: {
    id: asset.id,
    name: asset.name,
    scope: asset.scope,
    mediaType: asset.mediaType,
    category: asset.category,
    fileUrl: asset.fileUrl,
    originalFile: asset.originalFile,
    coverUrl: asset.coverUrl,
    localName: (asset.originalFile || asset.fileUrl).split("/").pop(),
    projectId: asset.projectId,
  },
});

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
  onUseMany,
  onDropAsset,
  variant = "dialog",
  hidePreviewPane = false,
}: AssetLibraryDialogProps) => {
  const [activeScope, setActiveScope] = useState<AssetScope>("project");
  const [activeCategory, setActiveCategory] = useState<AssetCategory>("image");
  const [projectAssets, setProjectAssets] = useState<AssetRecord[]>([]);
  const [assetFolders, setAssetFolders] = useState<AssetFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [contextMenu, setContextMenu] = useState<{
    asset: AssetRecord;
    x: number;
    y: number;
  } | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{
    folder: AssetFolder;
    x: number;
    y: number;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    assets: AssetRecord[];
    folder?: AssetFolder;
    message: string;
  } | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectName, setCreateProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [assetNameDialogMode, setAssetNameDialogMode] =
    useState<AssetNameDialogMode>("create-folder");
  const [renamingFolder, setRenamingFolder] = useState<AssetFolder | null>(null);
  const [renamingAsset, setRenamingAsset] = useState<AssetRecord | null>(null);
  const [previewAsset, setPreviewAsset] = useState<AssetRecord | null>(null);
  const [activeProjectAssetId, setActiveProjectAssetId] = useState<
    string | null
  >(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const assetUploadInputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isPageVariant = variant === "page";
  const allowInsert = !isPageVariant && Boolean(onUse);
  const visibleScopes = useMemo(
    () =>
      isPageVariant ? scopes.filter((scope) => scope.id !== "canvas") : scopes,
    [isPageVariant],
  );
  const canvasAssets = useMemo(
    () => buildCanvasMediaAssets(nodes, projectId),
    [nodes, projectId],
  );
  const projectOptions = useMemo(() => {
    const folderMap = new Map(assetFolders.map((folder) => [folder.id, folder]));
    for (const asset of projectAssets) {
      if (asset.scope !== "project" || !asset.folderId) continue;
      if (folderMap.has(asset.folderId)) continue;
      folderMap.set(asset.folderId, {
        id: asset.folderId,
        name: asset.folderName || "未命名文件夹",
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      });
    }
    return Array.from(folderMap.values());
  }, [assetFolders, projectAssets]);
  const activeProjectOption = projectOptions.find(
    (folder) => folder.id === activeProjectAssetId,
  );
  const isProjectRoot = activeScope === "project" && !activeProjectAssetId;
  const activeCategories =
    activeScope === "project" ? projectCategories : canvasCategories;
  const canUploadToProjectCategory =
    activeScope === "project" && Boolean(activeProjectAssetId);
  const listedAssets =
    activeScope === "canvas"
      ? canvasAssets
      : activeScope === "project"
        ? projectAssets
        : [];
  const isCanvasScope = activeScope === "canvas";
  const allowBatchOperations = activeScope !== "public";

  const reloadAssets = useCallback(async () => {
    if (!basePath || !open) return;
    setLoading(true);
    try {
      const index = await readAssetIndex(basePath);
      setAssetFolders(index.folders);
      setProjectAssets(index.assets.filter((asset) => asset.scope === "project"));
    } catch (error) {
      console.error("[AssetLibrary] load failed", error);
      toast.error("读取项目资产失败");
    } finally {
      setLoading(false);
    }
  }, [basePath, open]);

  useEffect(() => {
    void reloadAssets();
  }, [reloadAssets, refreshKey]);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIds([]);
    setPage(1);
    setPreviewAsset(null);
    if (activeScope !== "project") {
      setActiveProjectAssetId(null);
    }
    if (
      activeScope === "project" &&
      !projectCategories.some((category) => category.id === activeCategory)
    ) {
      setActiveCategory("role");
    }
    if (
      activeScope === "canvas" &&
      !canvasCategories.some((category) => category.id === activeCategory)
    ) {
      setActiveCategory("image");
    }
  }, [activeScope, activeCategory]);

  useEffect(() => {
    setSelectedIds([]);
    setPage(1);
    setPreviewAsset(null);
    if (activeProjectAssetId) {
      setActiveCategory("role");
    }
  }, [activeProjectAssetId]);

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, [open]);

  useEffect(() => {
    if (!visibleScopes.some((scope) => scope.id === activeScope)) {
      setActiveScope(visibleScopes[0]?.id ?? "project");
    }
  }, [activeScope, visibleScopes]);

  useEffect(() => {
    if (!contextMenu && !folderContextMenu) return;

    const closeMenu = () => {
      setContextMenu(null);
      setFolderContextMenu(null);
    };
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, [contextMenu, folderContextMenu]);

  const filteredAssets = useMemo(() => {
    if (activeScope === "public") return [];
    return listedAssets.filter((asset) => {
      if (asset.scope !== activeScope || asset.category !== activeCategory) {
        return false;
      }
      if (activeScope === "project") {
        return asset.folderId === activeProjectAssetId;
      }
      if (activeScope === "canvas") {
        return (asset.projectId || null) === (projectId || null);
      }
      return true;
    });
  }, [
    activeCategory,
    activeProjectAssetId,
    activeScope,
    listedAssets,
    projectId,
  ]);

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
    () => listedAssets.filter((asset) => selectedIds.includes(asset.id)),
    [listedAssets, selectedIds],
  );
  const getProjectAssetCount = useCallback(
    (targetFolderId: string) =>
      projectAssets.filter(
        (asset) =>
          asset.scope === "project" && asset.folderId === targetFolderId,
      ).length,
    [projectAssets],
  );
  const isCurrentPageAllSelected =
    pageAssets.length > 0 &&
    pageAssets.every((asset) => selectedIds.includes(asset.id));

  const toggleCurrentPageSelected = useCallback(() => {
    const pageAssetIds = pageAssets.map((asset) => asset.id);
    if (pageAssetIds.length === 0) return;

    setSelectedIds((current) => {
      if (pageAssetIds.every((id) => current.includes(id))) {
        return current.filter((id) => !pageAssetIds.includes(id));
      }
      return Array.from(new Set([...current, ...pageAssetIds]));
    });
  }, [pageAssets]);

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

  const handleImportFolder = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0 || !basePath) return;

      const firstRelativePath = getFileRelativePath(files[0]);
      const folderName =
        firstRelativePath.split("/").filter(Boolean)[0] || "未命名资产项目";
      const folderId = createAssetFolderId();
      const now = new Date().toISOString();
      let importedCount = 0;
      let skippedCount = 0;

      setLoading(true);
      try {
        for (const file of files) {
          const mediaType = getAssetMediaType(file);
          const category = getImportCategory(file);

          if (!mediaType || !category || !isCategoryMediaAllowed(category, mediaType)) {
            skippedCount += 1;
            continue;
          }

          await createAssetFromBuffer({
            basePath,
            name: file.name.replace(/\.[^.]+$/, ""),
            scope: "project",
            category,
            mediaType,
            fileName: file.name,
            buffer: await file.arrayBuffer(),
            folderId,
            folderName,
            source: { type: "upload" },
          });
          importedCount += 1;
        }

        if (importedCount === 0) {
          toast.warning(
            "未导入资产。请确认文件夹内包含角色、场景、道具、音效子文件夹，并放入支持的媒体文件。",
          );
          return;
        }

        setAssetFolders((current) => [
          {
            id: folderId,
            name: folderName,
            sourceName: folderName,
            createdAt: now,
            updatedAt: now,
          },
          ...current.filter((folder) => folder.id !== folderId),
        ]);
        setActiveProjectAssetId(folderId);
        toast.success(
          skippedCount > 0
            ? `已导入 ${importedCount} 个资产，跳过 ${skippedCount} 个文件`
            : `已导入 ${importedCount} 个资产`,
        );
        await reloadAssets();
      } catch (error) {
        console.error("[AssetLibrary] import folder failed", error);
        toast.error(error instanceof Error ? error.message : "导入资产文件夹失败");
      } finally {
        setLoading(false);
      }
    },
    [basePath, reloadAssets],
  );

  const handleUploadProjectAssets = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (
        files.length === 0 ||
        !basePath ||
        activeScope !== "project" ||
        !activeProjectAssetId ||
        !activeProjectOption
      ) {
        return;
      }

      let importedCount = 0;
      let skippedCount = 0;

      setLoading(true);
      try {
        for (const file of files) {
          const mediaType = getAssetMediaType(file);
          if (!mediaType || !isCategoryMediaAllowed(activeCategory, mediaType)) {
            skippedCount += 1;
            continue;
          }

          await createAssetFromBuffer({
            basePath,
            name: file.name.replace(/\.[^.]+$/, ""),
            scope: "project",
            category: activeCategory,
            mediaType,
            fileName: file.name,
            buffer: await file.arrayBuffer(),
            folderId: activeProjectAssetId,
            folderName: activeProjectOption.name,
            source: { type: "upload" },
          });
          importedCount += 1;
        }

        if (importedCount === 0) {
          toast.warning(
            `未上传资产。${getAssetCategoryLabel(activeCategory)}${getCategoryUploadHint(activeCategory)}`,
          );
          return;
        }

        await reloadAssets();
        toast.success(
          skippedCount > 0
            ? `已上传 ${importedCount} 个资产，跳过 ${skippedCount} 个文件`
            : `已上传 ${importedCount} 个资产`,
        );
      } catch (error) {
        console.error("[AssetLibrary] upload project assets failed", error);
        toast.error(error instanceof Error ? error.message : "上传项目资产失败");
      } finally {
        setLoading(false);
      }
    },
    [
      activeCategory,
      activeProjectAssetId,
      activeProjectOption,
      activeScope,
      basePath,
      reloadAssets,
    ],
  );

  const handleCreateAssetProject = useCallback(async () => {
    if (!basePath || creatingProject) return;
    const name = createProjectName.trim();
    if (!name) {
      toast.warning(
        assetNameDialogMode === "rename-asset"
          ? "请输入资产名称"
          : "请输入资产项目名称",
      );
      return;
    }

    setCreatingProject(true);
    try {
      if (assetNameDialogMode === "create-folder") {
        const now = new Date().toISOString();
        const folder: AssetFolder = {
          id: createAssetFolderId(),
          name,
          sourceName: name,
          createdAt: now,
          updatedAt: now,
        };

        await upsertAssetFolder(basePath, folder);
        setAssetFolders((current) => [
          folder,
          ...current.filter((item) => item.id !== folder.id),
        ]);
        setActiveProjectAssetId(folder.id);
        toast.success("资产项目已创建");
        await reloadAssets();
      } else if (assetNameDialogMode === "rename-folder" && renamingFolder) {
        const folder = await renameAssetFolder(basePath, renamingFolder.id, name);
        setAssetFolders((current) =>
          current.map((item) => (item.id === folder.id ? folder : item)),
        );
        setProjectAssets((current) =>
          current.map((asset) =>
            asset.scope === "project" && asset.folderId === folder.id
              ? { ...asset, folderName: folder.name, updatedAt: folder.updatedAt }
              : asset,
          ),
        );
        toast.success("资产项目已重命名");
        await reloadAssets();
      } else if (assetNameDialogMode === "rename-asset" && renamingAsset) {
        if (renamingAsset.scope === "canvas") {
          const store = useCanvasFlowStore.getState();
          const result = renameCanvasMediaAssetInNodes(
            store.nodes,
            renamingAsset,
            name,
          );
          if (result.renamedCount === 0) {
            throw new Error("未找到可重命名的画布资产");
          }
          store.setNodes(result.nodes);
          store.requestHistorySave();
          store.saveGraph();
          setPreviewAsset((current) =>
            current?.id === renamingAsset.id ? { ...current, name } : current,
          );
        } else {
          const asset = await renameAsset(basePath, renamingAsset.id, name);
          setProjectAssets((current) =>
            current.map((item) => (item.id === asset.id ? asset : item)),
          );
          setPreviewAsset((current) =>
            current?.id === asset.id ? asset : current,
          );
          await reloadAssets();
        }
        toast.success("资产已重命名");
      }

      setCreateProjectName("");
      setCreateProjectOpen(false);
      setRenamingFolder(null);
      setRenamingAsset(null);
    } catch (error) {
      console.error("[AssetLibrary] submit asset name failed", error);
      toast.error(
        error instanceof Error
          ? error.message
          : assetNameDialogMode === "create-folder"
            ? "创建资产项目失败"
            : "重命名失败",
      );
    } finally {
      setCreatingProject(false);
    }
  }, [
    assetNameDialogMode,
    basePath,
    createProjectName,
    creatingProject,
    reloadAssets,
    renamingAsset,
    renamingFolder,
  ]);

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

      const isCanvasAssetDelete = targetAssets.every(
        (asset) => asset.scope === "canvas",
      );
      const message =
        targetAssets.length === 1
          ? isCanvasAssetDelete
            ? "确定从当前画布资产中删除该媒体吗？相关节点中的该媒体引用会被移除。"
            : "确定删除该项目资产吗？删除后会移除复制到资产库中的文件。"
          : isCanvasAssetDelete
            ? `确定从当前画布资产中删除选中的 ${targetAssets.length} 个媒体吗？相关节点中的这些媒体引用会被移除。`
            : `确定删除选中的 ${targetAssets.length} 个项目资产吗？删除后会移除复制到资产库中的文件。`;

      setDeleteConfirm({ assets: targetAssets, message });
    },
    [],
  );

  const handleDeleteFolder = useCallback(
    (folder: AssetFolder) => {
      const count = getProjectAssetCount(folder.id);
      setDeleteConfirm({
        assets: [],
        folder,
        message: `确定删除资产文件夹“${folder.name}”吗？该文件夹内 ${count} 个资产和复制到资产库中的文件都会被删除。`,
      });
    },
    [getProjectAssetCount],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    try {
      if (deleteConfirm.folder) {
        await deleteAssetFolderById(basePath, deleteConfirm.folder.id);
        if (activeProjectAssetId === deleteConfirm.folder.id) {
          setActiveProjectAssetId(null);
        }
      } else if (deleteConfirm.assets.every((asset) => asset.scope === "canvas")) {
        const store = useCanvasFlowStore.getState();
        const result = removeCanvasMediaAssetsFromNodes(
          store.nodes,
          deleteConfirm.assets,
        );
        if (result.removedCount > 0) {
          store.setNodes(result.nodes);
          store.requestHistorySave();
          store.saveGraph();
        }
      } else {
        await deleteAssetsById(
          basePath,
          deleteConfirm.assets.map((asset) => asset.id),
        );
      }

      setSelectedIds([]);
      setDeleteConfirm(null);
      toast.success(deleteConfirm.folder ? "资产文件夹已删除" : "资产已删除");
      await reloadAssets();
    } catch (error) {
      console.error("[AssetLibrary] delete failed", error);
      toast.error("删除资产失败");
    }
  }, [activeProjectAssetId, basePath, deleteConfirm, reloadAssets]);

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
        const asset = listedAssets.find((item) => item.id === payload.asset?.id);
        if (!asset) return;

        onDropAsset(asset, { x: event.clientX, y: event.clientY });
        onClose();
      } catch {
        toast.error("资产拖拽失败");
      }
    },
    [isPageVariant, listedAssets, onClose, onDropAsset],
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
      aria-label="asset library"
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
            {allowBatchOperations && !isProjectRoot ? (
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
                <Button
                  size="sm"
                  onClick={toggleCurrentPageSelected}
                >
                  {isCurrentPageAllSelected ? "全不选" : "全选"}
                </Button>
              </>
            ) : null}
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
            {activeScope === "project" && activeProjectAssetId ? (
              <button
                type="button"
                onClick={() => setActiveProjectAssetId(null)}
                className="flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white"
              >
                <IconArrowLeft size={14} />
                {activeProjectOption?.name || "返回文件夹"}
              </button>
            ) : null}
            {!isProjectRoot
              ? activeCategories.map((category) => (
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
                ))
              : null}
          </div>
          <div className="flex items-center gap-3">
            {canUploadToProjectCategory ? (
              <button
                type="button"
                onClick={() => assetUploadInputRef.current?.click()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white/72 transition-colors hover:border-[#B43FEB]/50 hover:bg-[#B43FEB]/10 hover:text-white"
              >
                <IconUpload size={14} />
                上传{getAssetCategoryLabel(activeCategory)}
              </button>
            ) : null}
            <div className="text-xs text-white/35">
              {activeScope === "public"
                ? "公共资产接口待接入"
                : isProjectRoot
                  ? String(projectOptions.length) + " 个项目"
                  : isCanvasScope
                    ? "当前画布媒体"
                    : String(filteredAssets.length) + " 个资产"}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 gap-5 overflow-hidden px-6 py-6">
          <div className="asset-library-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {isProjectRoot ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="group flex aspect-[4/3] flex-col justify-between rounded-md border border-dashed border-white/15 bg-white/[0.03] p-4 text-left text-white/55 transition-colors hover:border-[#B43FEB]/70 hover:bg-[#B43FEB]/10 hover:text-white"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#B43FEB]/15 text-[#d486ff]">
                    <IconUpload size={24} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white/88">
                      导入资产
                    </div>
                    <div className="mt-1 text-xs text-white/40">
                      角色 / 场景 / 道具 / 音效
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssetNameDialogMode("create-folder");
                    setRenamingFolder(null);
                    setRenamingAsset(null);
                    setCreateProjectName("");
                    setCreateProjectOpen(true);
                  }}
                  className="group flex aspect-[4/3] flex-col justify-between rounded-md border border-dashed border-white/15 bg-white/[0.03] p-4 text-left text-white/55 transition-colors hover:border-[#B43FEB]/70 hover:bg-[#B43FEB]/10 hover:text-white"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#B43FEB]/15 text-[#d486ff]">
                    <IconPlus size={24} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white/88">
                      新建资产项目
                    </div>
                    <div className="mt-1 text-xs text-white/40">
                      创建空资产项目
                    </div>
                  </div>
                </button>
                {projectOptions.map((project) => {
                  const count = getProjectAssetCount(project.id);
                  return (
                    <button
                      type="button"
                      key={project.id}
                      onClick={() => setActiveProjectAssetId(project.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setFolderContextMenu({
                          folder: project,
                          x: event.clientX,
                          y: event.clientY,
                        });
                      }}
                      className="group flex aspect-[4/3] flex-col justify-between rounded-md border border-white/8 bg-[#2a2a2a] p-4 text-left transition-colors hover:border-[#B43FEB]/60 hover:bg-[#303030]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#B43FEB]/15 text-[#d486ff]">
                        <IconFolder size={24} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white/88">
                          {project.name}
                        </div>
                        <div className="mt-1 text-xs text-white/40">
                          {count} 个资产
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : activeScope !== "public" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-5">
                {loading && !isCanvasScope ? (
                  <div className="col-span-full flex h-40 items-center justify-center text-sm text-white/45">
                    正在读取资产...
                  </div>
                ) : pageAssets.length === 0 ? (
                  <div className="col-span-full flex h-40 items-center justify-center rounded-md border border-dashed border-white/10 text-sm text-white/40">
                    {isCanvasScope
                      ? "当前画布暂无该类型媒体"
                      : "暂无资产"}
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
                            toggleSelected(asset.id);
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

                        <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded bg-black/70">
                          {selected ? <IconCheck size={14} /> : null}
                        </div>
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
          {isPageVariant && !hidePreviewPane ? (
            <AssetPreviewPane asset={activePreviewAsset} basePath={basePath} />
          ) : null}
        </div>

        <div className="flex h-14 shrink-0 items-center justify-between border-t border-white/10 px-6">
          {!isProjectRoot ? (
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
              <span className="ml-3">{PAGE_SIZE}{"\u6761/\u9875"}</span>
              <span>{getAssetCategoryLabel(activeCategory)}</span>
            </div>
          ) : (
            <div />
          )}
          {allowInsert && !isProjectRoot ? (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onClose}>
                取消
              </Button>
              <Button
                size="sm"
                variant="blue"
                onClick={() => onUseMany?.(selectedAssets)}
                disabled={selectedIds.length === 0}
                ignoreTitleCase
              >
                确定
              </Button>
            </div>
          ) : null}
        </div>

        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleImportFolder}
        />
        <input
          ref={assetUploadInputRef}
          type="file"
          multiple
          accept={getCategoryUploadAccept(activeCategory)}
          className="hidden"
          onChange={handleUploadProjectAssets}
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
              {"\u63d2\u5165\u753b\u5e03"}
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-white/80 hover:bg-[#B43FEB]/10 hover:text-white"
            onClick={() => {
              const asset = contextMenu.asset;
              setContextMenu(null);
              setAssetNameDialogMode("rename-asset");
              setRenamingAsset(asset);
              setRenamingFolder(null);
              setCreateProjectName(asset.name);
              setCreateProjectOpen(true);
            }}
          >
            {"\u91cd\u547d\u540d"}
          </button>
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
            {"\u4e0b\u8f7d"}
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
            {"\u5220\u9664"}
          </button>
        </div>
      ) : null}

      {folderContextMenu ? (
        <div
          className="fixed z-[90] w-32 overflow-hidden rounded-lg border border-white/10 bg-[#121214] p-1 text-sm text-white shadow-2xl"
          style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-white/80 hover:bg-[#B43FEB]/10 hover:text-white"
            onClick={() => {
              const folder = folderContextMenu.folder;
              setFolderContextMenu(null);
              setAssetNameDialogMode("rename-folder");
              setRenamingFolder(folder);
              setRenamingAsset(null);
              setCreateProjectName(folder.name);
              setCreateProjectOpen(true);
            }}
          >
            {"\u91cd\u547d\u540d"}
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-red-300 hover:bg-red-500/15 hover:text-red-200"
            onClick={() => {
              const folder = folderContextMenu.folder;
              setFolderContextMenu(null);
              handleDeleteFolder(folder);
            }}
          >
            {"\u5220\u9664"}
          </button>
        </div>
      ) : null}

      {createProjectOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40">
          <div className="w-[min(420px,90vw)] rounded-xl border border-white/10 bg-[#171717] p-5 text-white shadow-2xl">
            <div className="text-sm font-medium">
              {assetNameDialogMode === "create-folder"
                ? "\u65b0\u5efa\u8d44\u4ea7\u9879\u76ee"
                : assetNameDialogMode === "rename-folder"
                  ? "\u91cd\u547d\u540d\u8d44\u4ea7\u9879\u76ee"
                  : "\u91cd\u547d\u540d\u8d44\u4ea7"}
            </div>
            <input
              value={createProjectName}
              onChange={(event) => setCreateProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleCreateAssetProject();
                }
              }}
              placeholder={
                assetNameDialogMode === "create-folder"
                  ? "\u8d44\u4ea7\u9879\u76ee\u540d\u79f0"
                  : "\u8d44\u4ea7\u540d\u79f0"
              }
              className="mt-4 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#B43FEB]/70"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setCreateProjectOpen(false);
                  setCreateProjectName("");
                  setRenamingFolder(null);
                  setRenamingAsset(null);
                  setAssetNameDialogMode("create-folder");
                }}
              >
                {"\u53d6\u6d88"}
              </Button>
              <Button
                size="sm"
                variant="blue"
                loading={creatingProject}
                onClick={() => void handleCreateAssetProject()}
              >
                {assetNameDialogMode === "create-folder" ? "\u521b\u5efa" : "\u4fdd\u5b58"}
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