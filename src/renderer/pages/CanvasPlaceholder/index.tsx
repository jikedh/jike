/**
 * Canvas 页面占位组件
 * 用于 /canvas 路由的简单占位页面
 * 样式与 ProjectList 页面保持一致
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  SquareDashedMousePointer,
  Plus,
  Play,
  Upload,
  Download,
  Network,
  Clock,
  X,
  Pencil,
  Trash2,
  FileText,
  Loader2,
  Share2,
} from "lucide-react";
import {
  deleteProject,
  exportProject,
  getProjectList,
  importProject,
  shareProject,
} from "@/api/projects";
import { toast } from "sonner";
import ProjectDialog from "@/components/ProjectDialog";
import type { ProjectListItem } from "shared/types/api/projects";

const SHARE_UUID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export default function CanvasPlaceholderPage() {
  const navigate = useNavigate();
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectListItem | null>(
    null,
  );
  const [projectToEdit, setProjectToEdit] = useState<ProjectListItem | null>(null);
  const [projectToShare, setProjectToShare] = useState<ProjectListItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [targetUuid, setTargetUuid] = useState("");
  const [shareError, setShareError] = useState("");
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(
    null,
  );

  const refreshProjects = async () => {
    const result = await getProjectList({ page: 1, page_size: 100 });
    setProjects(result.data.list);
  };

  const handleProjectSuccess = (projectId: string) => {
    if (projectToEdit) {
      refreshProjects();
    } else {
      navigate(`/canvas/${projectId}`);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  // 处理项目卡片点击
  const handleProjectClick = (project: ProjectListItem) => {
    navigate(`/canvas/${project.id}`);
  };

  // 打开创建项目弹窗
  const openCreateDialog = () => {
    setProjectToEdit(null);
    setIsProjectDialogOpen(true);
  };

  // 打开编辑弹窗
  const openEditDialog = (e: React.MouseEvent, project: ProjectListItem) => {
    e.stopPropagation();
    setProjectToEdit(project);
    setIsProjectDialogOpen(true);
  };

  // 打开删除确认弹窗
  const openDeleteDialog = (e: React.MouseEvent, project: ProjectListItem) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setIsDeleteDialogOpen(true);
  };

  const openShareDialog = (e: React.MouseEvent, project: ProjectListItem) => {
    e.stopPropagation();
    setProjectToShare(project);
    setTargetUuid("");
    setShareError("");
  };

  const closeShareDialog = () => {
    if (isSharing) return;
    setProjectToShare(null);
    setTargetUuid("");
    setShareError("");
  };

  const handleConfirmShare = async () => {
    if (!projectToShare) return;

    const uuid = targetUuid.trim();
    if (!uuid) {
      setShareError("请输入要分享的用户 UUID");
      return;
    }
    if (!SHARE_UUID_PATTERN.test(uuid)) {
      setShareError("UUID 仅支持 1-64 位字母、数字、下划线或短横线");
      return;
    }

    setIsSharing(true);
    setShareError("");
    try {
      const result = await shareProject(projectToShare.id, {
        target_uuid: uuid,
      });
      toast.success("分享成功", {
        description: `已为目标用户创建项目「${result.data.name}」`,
      });
      setProjectToShare(null);
      setTargetUuid("");
    } catch (error: any) {
      console.error("Failed to share project:", error);
      setShareError(error?.response?.data?.msg || "分享项目失败，请稍后重试");
      toast.error("分享项目失败");
    } finally {
      setIsSharing(false);
    }
  };

  // 确认删除项目
  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      await refreshProjects();
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleImportProject = () => {
    importFileInputRef.current?.click();
  };

  const handleImportProjectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }

    setIsImporting(true);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const sourceProject = parsed.project || {};
      const sourceCanvas = parsed.canvas || parsed;

      const result = await importProject({
        name: sourceProject.name || file.name.replace(/\.json$/i, "") || "导入项目",
        description: sourceProject.description || "",
        type: sourceProject.type || "video",
        cover_url: sourceProject.cover_url || sourceProject.coverUrl || "",
        data: sourceCanvas.data || sourceCanvas,
      });

      await refreshProjects();
      toast.success("导入成功", {
        description: `已导入项目「${result.data.name}」`,
      });
    } catch (error) {
      console.error("Failed to import project:", error);
      toast.error("导入项目失败");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportProject = async (
    e: React.MouseEvent,
    project: ProjectListItem,
  ) => {
    e.stopPropagation();
    setExportingProjectId(String(project.id));
    try {
      const result = await exportProject(project.id);
      const projectName =
        (project.name || "project").replace(/[<>:"/\\|?*]+/g, "_").trim() ||
        "project";
      const bytes = new TextEncoder().encode(
        JSON.stringify(result.data, null, 2),
      );
      const saveResult = await window.storage.saveBufferToFile(
        `${projectName}.json`,
        bytes.buffer,
      );

      if (saveResult.canceled) {
        return;
      }

      if (!saveResult.success) {
        throw new Error(saveResult.error || "保存文件失败");
      }

      toast.success("导出成功", {
        description: `已导出项目「${project.name}」`,
      });
    } catch (error) {
      console.error("Failed to export project:", error);
      toast.error("导出项目失败");
    } finally {
      setExportingProjectId(null);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="flex-1 bg-[#09090b] text-white flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center">
          <SquareDashedMousePointer className="w-5 h-5 mr-3 text-[#B43FEB]" />
          <h1 className="text-lg font-medium">项目管理</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleImportProject}
            disabled={isImporting}
            className="bg-black/30 border border-white/10 text-white/80 hover:bg-white/5 hover:text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {isImporting ? "导入中..." : "导入"}
          </button>
          <button
            onClick={openCreateDialog}
            className="bg-[#B43FEB] text-white hover:bg-[#9d35ce] px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(180,63,235,0.3)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            新建项目
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">我的项目</h2>
          <p className="text-sm text-white/50">
            管理和编辑您的项目，点击可进入项目。
          </p>
        </div>

        {/* 空状态提示 */}
        {projects.length === 0 && (
          <div className="text-center text-white/40 py-20">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">还没有任何项目</p>
            <p className="text-sm">
              点击右上角的「新建项目」按钮创建第一个项目
            </p>
          </div>
        )}

        {/* 项目网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className="bg-[#121214] border border-white/5 rounded-xl overflow-hidden group hover:border-[#B43FEB]/40 hover:shadow-[0_0_30px_rgba(180,63,235,0.15)] transition-all duration-300 cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden bg-white/5">
                {(() => {
                  const coverSrc = project.cover_url || project.coverUrl;

                  return coverSrc ? (
                    <img
                      src={coverSrc}
                      alt={project.name}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-white/5 to-white/2">
                      <FileText className="w-12 h-12 text-white/20 group-hover:text-[#B43FEB]/50 transition-colors" />
                    </div>
                  );
                })()}

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProjectClick(project);
                    }}
                    className="w-10 h-10 rounded-full bg-[#B43FEB] text-white flex items-center justify-center hover:bg-[#9d35ce] transition-colors shadow-lg cursor-pointer"
                  >
                    <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                  </button>
                </div>

                {/* More options button */}
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => openEditDialog(e, project)}
                    className="w-8 h-8 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 flex items-center justify-center backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => openDeleteDialog(e, project)}
                    className="w-8 h-8 rounded-lg bg-black/50 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 flex items-center justify-center backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Type tag */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-medium text-[#B43FEB] border border-white/10 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#B43FEB]"></div>
                  画布工程
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-medium text-white/90 mb-3 truncate group-hover:text-white transition-colors">
                  {project.name}
                </h3>
                <div className="flex items-center justify-between text-xs text-white/50">
                  <div className="flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5" />
                    <span>节点工作流</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {formatTime(project.updated_at || project.updateTime || project.created_at || project.createTime || Date.now())}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={(e) => openShareDialog(e, project)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-[#B43FEB]/40 hover:text-[#d8b6ff] hover:bg-[#B43FEB]/10 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    分享
                  </button>
                  <button
                    onClick={(e) => handleExportProject(e, project)}
                    disabled={exportingProjectId === String(project.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-[#B43FEB]/40 hover:text-[#d8b6ff] hover:bg-[#B43FEB]/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportingProjectId === String(project.id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {exportingProjectId === String(project.id) ? "导出中..." : "导出"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 项目弹窗（创建/编辑） */}
      <ProjectDialog
        isOpen={isProjectDialogOpen}
        onClose={() => setIsProjectDialogOpen(false)}
        project={projectToEdit}
        onSuccess={handleProjectSuccess}
      />

      <input
        ref={importFileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportProjectFile}
        className="hidden"
      />

      {/* 分享项目弹窗 */}
      {projectToShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <h2 className="text-lg font-semibold text-white/90">分享项目</h2>
                <p className="mt-1 text-xs text-white/45">
                  将为目标用户复制一份独立的项目和画布数据。
                </p>
              </div>
              <button
                onClick={closeShareDialog}
                disabled={isSharing}
                className="text-white/50 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-[#B43FEB]/20 bg-[#B43FEB]/10 px-4 py-3">
                <p className="text-sm text-white/70">
                  当前项目：
                  <span className="font-medium text-white">
                    「{projectToShare.name}」
                  </span>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-white/70 block mb-2">
                  目标用户 UUID
                </label>
                <input
                  type="text"
                  value={targetUuid}
                  onChange={(e) => {
                    setTargetUuid(e.target.value);
                    if (shareError) setShareError("");
                  }}
                  placeholder="输入要分享给的用户 UUID"
                  disabled={isSharing}
                  className={`w-full bg-black/50 border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:ring-1 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${shareError
                    ? "border-red-500/60 focus:border-red-500 focus:ring-red-500"
                    : "border-white/10 focus:border-[#B43FEB] focus:ring-[#B43FEB]"
                    }`}
                />
                {shareError ? (
                  <p className="mt-2 text-xs text-red-400">{shareError}</p>
                ) : (
                  <p className="mt-2 text-xs text-white/40">
                    UUID 为目标用户个人中心头像点击之后出现的12 位字符串。
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/5 bg-black/20">
              <button
                onClick={closeShareDialog}
                disabled={isSharing}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleConfirmShare}
                disabled={isSharing}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#B43FEB] text-white hover:bg-[#9d35ce] shadow-[0_0_15px_rgba(180,63,235,0.3)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSharing && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSharing ? "分享中..." : "确认分享"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white/90">删除项目</h2>
              <button
                onClick={() => !isDeleting && setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="text-white/50 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5">
              <p className="text-white/60 text-sm">
                确定要删除项目{" "}
                <span className="font-medium text-white">
                  「{projectToDelete?.name}」
                </span>{" "}
                吗？删除后无法恢复。
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/5 bg-black/20">
              <button
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isDeleting ? "删除中..." : "删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
