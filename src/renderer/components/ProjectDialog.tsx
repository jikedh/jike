import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createProject, updateProject } from "@/api/projects";
import { uploadOssFile } from "@/api/jikeGo";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUserStore } from "@/stores/useUserStore";
import type { ProjectListItem, ProjectType } from "shared/types/api/projects";

const COVER_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml";

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectListItem | null;
  onSuccess?: (projectId: string) => void;
}

export default function ProjectDialog({
  isOpen,
  onClose,
  project,
  onSuccess,
}: ProjectDialogProps) {
  const isEdit = !!project;

  const [name, setName] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType>("video");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
      setType(project.type);
      const existingCover = project.cover_url || project.coverUrl || "";
      setCoverUrl(existingCover);
      setCoverPreview(existingCover);
    } else {
      resetFormState();
    }
  }, [project, isOpen]);

  const resetFormState = () => {
    setName("");
    setCoverUrl("");
    setCoverPreview("");
    setIsUploadingCover(false);
    setDescription("");
    setType("video");
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 本地选择图片后，先本地预览，再异步上传 OSS，成功后用返回的 URL 覆盖
  const handleCoverFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // 允许清空选择：input 被 reset 时 value 为空
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      event.target.value = "";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("封面图片不能超过 50MB");
      event.target.value = "";
      return;
    }

    // 本地预览：使用 ObjectURL，选完立即展示给用户
    const localUrl = URL.createObjectURL(file);
    setCoverPreview(localUrl);
    setCoverUrl("");
    setIsUploadingCover(true);

    try {
      // 后端代理上传：POST /v1/oss/upload（multipart/form-data）
      // 响应 envelope 解包后字段：url / key / filename / size / content_type
      const envelope = (await uploadOssFile(file)) as {
        code?: number;
        msg?: string;
        message?: string;
        data?: { url?: string };
      };
      const successCode = envelope?.code === 0 || envelope?.code === 200;
      const uploadedUrl = envelope?.data?.url;
      if (!successCode || !uploadedUrl) {
        throw new Error(envelope?.msg || envelope?.message || "上传失败");
      }
      setCoverUrl(uploadedUrl);
      toast.success("封面上传成功");
    } catch (error) {
      console.error("Failed to upload cover:", error);
      toast.error("封面上传失败，请重试");
      // 上传失败时回滚到原封面
      const fallback = project?.cover_url || project?.coverUrl || "";
      setCoverPreview(fallback);
      setCoverUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      // 释放本地预览 URL
      URL.revokeObjectURL(localUrl);
      setIsUploadingCover(false);
    }
  };

  const handleRemoveCover = () => {
    setCoverUrl("");
    setCoverPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirm = async () => {
    if (!isEdit) {
      const canCreate = useUserStore.getState().canCreateProject();
      if (!canCreate) {
        const { loginStatus, vipLevel } = useUserStore.getState();
        if (loginStatus !== 1) {
          toast.error("请先登录");
          useUserStore.getState().setDialogLoginStatus(true);
        } else {
          toast.error("权限不够，请联系管理员开通会员", {
            description: `当前会员等级：LV${vipLevel}，需要会员等级：LV3`,
          });
        }
        return;
      }
    }

    setIsProcessing(true);

    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        toast.error("请输入项目名称");
        setIsProcessing(false);
        return;
      }

      // 上传未完成时禁止提交
      if (isUploadingCover) {
        toast.error("封面正在上传，请稍候");
        setIsProcessing(false);
        return;
      }

      if (isEdit && project) {
        const result = await updateProject(project.id, {
          name: trimmedName,
          description: description || undefined,
          type,
          cover_url: coverUrl || undefined,
          cover_source: coverUrl ? "manual" : undefined,
        });
        onSuccess?.(String(result.data.id));
      } else {
        const result = await createProject({
          name: trimmedName,
          description: description || undefined,
          type,
          cover_url: coverUrl || undefined,
        });
        onSuccess?.(String(result.data.id));
      }

      setIsProcessing(false);
      handleClose();
    } catch (error) {
      console.error("Failed to save project:", error);
      toast.error(isEdit ? "保存项目失败" : "创建项目失败");
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isEdit) resetFormState();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col p-0">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <DialogTitle className="text-lg font-semibold text-white/90">
            {isEdit ? "编辑项目" : "新建画布项目"}
          </DialogTitle>
          <button
            onClick={handleClose}
            className="text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-sm font-medium text-white/70 block mb-2">
              项目名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入项目名称"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#B43FEB] focus:ring-1 focus:ring-[#B43FEB] outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white/70 block mb-2">
              封面图
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={COVER_ACCEPT}
              onChange={handleCoverFileChange}
              className="hidden"
            />
            {coverPreview ? (
              <div className="relative mb-3 h-32 w-full rounded-lg border border-white/10 overflow-hidden bg-black/40">
                <img
                  src={coverPreview}
                  alt="封面预览"
                  className="h-full w-full object-cover"
                />
                {isUploadingCover && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 text-xs text-white/80">
                    <Loader2 size={16} className="animate-spin" />
                    上传中...
                  </div>
                )}
                {!isUploadingCover && (
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
                    aria-label="移除封面"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingCover}
              className="w-full flex items-center justify-center gap-2 bg-black/50 border border-dashed border-white/15 rounded-lg px-4 py-3 text-sm text-white/70 hover:text-white hover:border-[#B43FEB]/60 hover:bg-[#B43FEB]/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingCover ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <ImagePlus size={16} />
                  {coverPreview ? "更换封面图" : "选择封面图"}
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-white/40">
              支持 JPG / PNG / WebP / GIF / SVG，大小不超过 50MB
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-white/70 block mb-2">
              项目描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述这个工作流的用途..."
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#B43FEB] focus:ring-1 focus:ring-[#B43FEB] outline-none transition-all h-24 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 bg-black/20">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#B43FEB] text-white hover:bg-[#9d35ce] shadow-[0_0_15px_rgba(180,63,235,0.3)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing
              ? isEdit
                ? "保存中..."
                : "创建中..."
              : isEdit
                ? "保存"
                : "创建项目"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
