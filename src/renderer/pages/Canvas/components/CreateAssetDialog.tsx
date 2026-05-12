import { IconMusic, IconPhoto, IconVideo, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import {
  type AssetFolder,
  type AssetCategory,
  type AssetMediaRef,
  type AssetMediaType,
  DEFAULT_ASSET_FOLDER_ID,
  DEFAULT_ASSET_FOLDER_NAME,
  createAssetFromMediaRef,
  getAssetFileUrl,
  readAssetIndex,
} from "service/assetStorage";
import { cn } from "shared/utils/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type CreateAssetRequest = {
  nodeId: string;
  projectId?: string | null;
  name: string;
  mediaType: AssetMediaType;
  mediaRef: AssetMediaRef;
};

type CreateAssetDialogProps = {
  open: boolean;
  basePath: string;
  request: CreateAssetRequest | null;
  onClose: () => void;
  onCreated: () => void;
};

const categoryOptions: Array<{ id: AssetCategory; label: string }> = [
  { id: "role", label: "角色" },
  { id: "scene", label: "场景" },
  { id: "prop", label: "道具" },
  { id: "audio", label: "音效" },
];

const getDefaultCategory = (mediaType?: AssetMediaType): AssetCategory =>
  mediaType === "audio" ? "audio" : "role";

const getMediaIcon = (mediaType?: AssetMediaType) => {
  if (mediaType === "video") return <IconVideo size={18} />;
  if (mediaType === "audio") return <IconMusic size={18} />;
  return <IconPhoto size={18} />;
};

export const CreateAssetDialog = ({
  open,
  basePath,
  request,
  onClose,
  onCreated,
}: CreateAssetDialogProps) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AssetCategory>("image");
  const [folderId, setFolderId] = useState(DEFAULT_ASSET_FOLDER_ID);
  const [assetFolders, setAssetFolders] = useState<AssetFolder[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !request) return;
    setName(request.name || "未命名资产");
    setCategory(getDefaultCategory(request.mediaType));
  }, [open, request]);

  useEffect(() => {
    if (!open || !basePath) return;

    let cancelled = false;
    const loadFolders = async () => {
      try {
        const index = await readAssetIndex(basePath);
        const folders =
          index.folders.length > 0
            ? index.folders
            : [
                {
                  id: DEFAULT_ASSET_FOLDER_ID,
                  name: DEFAULT_ASSET_FOLDER_NAME,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ];
        if (cancelled) return;
        setAssetFolders(folders);
        setFolderId((current) =>
          folders.some((folder) => folder.id === current)
            ? current
            : folders[0]?.id || DEFAULT_ASSET_FOLDER_ID,
        );
      } catch (error) {
        console.error("[CreateAssetDialog] load folders failed", error);
        if (!cancelled) {
          setAssetFolders([
            {
              id: DEFAULT_ASSET_FOLDER_ID,
              name: DEFAULT_ASSET_FOLDER_NAME,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]);
          setFolderId(DEFAULT_ASSET_FOLDER_ID);
        }
      }
    };

    void loadFolders();
    return () => {
      cancelled = true;
    };
  }, [basePath, open]);

  const previewUrl = useMemo(() => {
    if (!request) return "";
    const localAssetPath = request.mediaRef.localPath?.startsWith("assets/")
      ? request.mediaRef.localPath
      : "";
    return (
      request.mediaRef.displayUrl ||
      request.mediaRef.remoteUrl ||
      request.mediaRef.url ||
      (localAssetPath && basePath
        ? getAssetFileUrl(basePath, localAssetPath)
        : "")
    );
  }, [basePath, request]);

  const handleCreate = async () => {
    if (!request || !basePath || saving) return;
    if (!name.trim()) {
      toast.warning("请输入资产名称");
      return;
    }
    const selectedFolder = assetFolders.find((folder) => folder.id === folderId);
    if (!selectedFolder) {
      toast.warning("请选择资产文件夹");
      return;
    }

    try {
      setSaving(true);
      await createAssetFromMediaRef({
        basePath,
        name: name.trim(),
        scope: "project",
        category,
        mediaType: request.mediaType,
        mediaRef: request.mediaRef,
        projectId: request.projectId || undefined,
        folderId: selectedFolder.id,
        folderName: selectedFolder.name,
        nodeId: request.nodeId,
      });
      toast.success("资产已创建");
      onCreated();
      onClose();
    } catch (error) {
      console.error("[CreateAssetDialog] create failed", error);
      toast.error("创建资产失败");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm">
      <div className="noflow nodrag nopan nowheel w-[min(640px,92vw)] overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-white shadow-2xl">
        <div className="flex h-13 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            {getMediaIcon(request.mediaType)}
            创建项目资产
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[300px_minmax(0,1fr)]">
          <div>
            <div className="mb-2 text-xs text-white/50">封面</div>
            <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md bg-[#2b2b2b]">
              {request.mediaType === "image" && previewUrl ? (
                <img
                  src={previewUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : request.mediaType === "video" && previewUrl ? (
                <video
                  src={previewUrl}
                  className="h-full w-full object-cover"
                  muted
                />
              ) : (
                <div className="flex flex-col items-center text-white/50">
                  {getMediaIcon(request.mediaType)}
                  <span className="mt-2 text-xs">
                    {request.mediaType === "audio" ? "音频资产" : "资产"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <label className="block">
              <div className="mb-2 text-xs text-white/50">
                名称 <span className="text-red-400">*</span>
              </div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-[#B43FEB]/70"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-xs text-white/50">
                资产文件夹 <span className="text-red-400">*</span>
              </div>
              <select
                value={folderId}
                onChange={(event) => setFolderId(event.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-[#B43FEB]/70"
              >
                {assetFolders.map((folder) => (
                  <option
                    key={folder.id}
                    value={folder.id}
                    className="bg-[#171717] text-white"
                  >
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-2 text-xs text-white/50">
                分类 <span className="text-red-400">*</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {categoryOptions.map((option) => {
                  const disabled =
                    request.mediaType === "audio"
                      ? option.id !== "audio"
                      : option.id === "audio";
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setCategory(option.id)}
                      className={cn(
                        "h-9 rounded-md border text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                        category === option.id
                          ? "border-[#B43FEB] bg-[#B43FEB]/18 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/65 hover:text-white",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </label>
          </div>
        </div>

        <div className="flex h-14 items-center justify-end gap-2 border-t border-white/10 px-5">
          <Button size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            size="sm"
            variant="blue"
            loading={saving}
            onClick={handleCreate}
          >
            创建
          </Button>
        </div>
      </div>
    </div>
  );
};
