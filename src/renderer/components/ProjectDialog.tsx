import { useState, useRef, useEffect } from "react";
import { X, Upload, X as CloseIcon } from "lucide-react";
import {
  createProject,
  updateProject,
  renameProject,
  saveCoverImageToLocal,
  getCoverImageUrl,
  type ProjectMeta,
} from "service/projectStorage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUserStore } from "@/store/useUserStore";
import { toast } from "sonner";

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectMeta | null;
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
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"video" | "script">("video");
  const [coverPreview, setCoverPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      const localCover = getCoverImageUrl(project.id);
      setCoverUrl(localCover || project.coverUrl || "");
      setDescription(project.description || "");
      setType(project.type);
      setCoverPreview("");
      setCoverFile(null);
    } else {
      resetFormState();
    }
  }, [project, isOpen]);

  const resetFormState = () => {
    setName("");
    setCoverUrl("");
    setDescription("");
    setType("video");
    setCoverPreview("");
    setCoverFile(null);
    setIsProcessing(false);
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = "";
    }
  };

  const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setCoverPreview(previewUrl);
      setCoverFile(file);
    }
  };

  const handleRemoveCover = () => {
    setCoverPreview("");
    setCoverFile(null);
    setCoverUrl("");
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = "";
    }
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
      let resultId = "";

      if (isEdit && project) {
        const nameChanged = name !== project.name && name.trim() !== "";

        if (nameChanged) {
          const renameSuccess = await renameProject(project.id, name.trim());
          if (!renameSuccess) {
            console.error("Failed to rename project folder");
            setIsProcessing(false);
            return;
          }
        }

        if (coverFile) {
          const arrayBuffer = await coverFile.arrayBuffer();
          await saveCoverImageToLocal(project.id, arrayBuffer);
        }

        updateProject(project.id, {
          name: name.trim(),
          description: description || undefined,
        });

        resultId = project.id;
      } else {
        const newProject = await createProject(
          name || undefined,
          undefined,
          description || undefined,
          type,
        );

        if (coverFile) {
          const arrayBuffer = await coverFile.arrayBuffer();
          await saveCoverImageToLocal(newProject.id, arrayBuffer);
        }

        resultId = newProject.id;
      }

      setIsProcessing(false);
      onSuccess?.(resultId);
      handleClose();
    } catch (error) {
      console.error("Failed to save project:", error);
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
              ref={coverFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverFileSelect}
              className="hidden"
            />

            {(coverPreview || coverUrl) && (
              <div className="relative group mb-3">
                <img
                  src={coverPreview || coverUrl}
                  alt="封面预览"
                  className="w-full h-32 object-cover rounded-lg border border-white/10"
                />
                <button
                  onClick={handleRemoveCover}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/80 hover:bg-black/80 flex items-center justify-center cursor-pointer"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            )}

            {!coverPreview && !coverUrl && (
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-white/10 rounded-lg bg-black/30 flex flex-col items-center justify-center text-white/40 hover:text-white/70 hover:border-[#B43FEB]/50 hover:bg-[#B43FEB]/5 transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover:bg-[#B43FEB]/20 group-hover:text-[#B43FEB] transition-colors">
                  <Upload size={20} />
                </div>
                <span className="text-xs">点击或拖拽上传封面图</span>
              </button>
            )}

            {(coverPreview || coverUrl) && (
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                className="w-full mt-2 px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white/60 hover:border-[#B43FEB] hover:text-[#B43FEB] transition-all text-sm cursor-pointer"
              >
                更换封面
              </button>
            )}
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
