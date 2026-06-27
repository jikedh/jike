import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createProject, updateProject } from "@/api/projects";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUserStore } from "@/stores/useUserStore";
import type { ProjectListItem, ProjectType } from "shared/types/api/projects";

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
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType>("video");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
      setType(project.type);
      setCoverUrl(project.cover_url || project.coverUrl || "");
    } else {
      resetFormState();
    }
  }, [project, isOpen]);

  const resetFormState = () => {
    setName("");
    setCoverUrl("");
    setDescription("");
    setType("video");
    setIsProcessing(false);
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
              封面图 URL
            </label>
            {coverUrl && (
              <img
                src={coverUrl}
                alt="封面预览"
                className="mb-3 h-32 w-full rounded-lg border border-white/10 object-cover"
              />
            )}
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="输入远程封面图地址"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#B43FEB] focus:ring-1 focus:ring-[#B43FEB] outline-none transition-all"
            />
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
