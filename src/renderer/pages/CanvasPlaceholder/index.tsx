/**
 * Canvas 页面占位组件
 * 用于 /canvas 路由的简单占位页面
 * 样式与 ProjectList 页面保持一致
 */
import { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  getProjectListAsync,
  deleteProject,
  exportProjectDraft,
  importProjectDraft,
  loadProjectCoverObjectUrl,
  type ProjectMeta,
} from "service/projectStorage";
import { toast } from "sonner";
import ProjectDialog from "@/components/ProjectDialog";

export default function CanvasPlaceholderPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectMeta | null>(
    null,
  );
  const [projectToEdit, setProjectToEdit] = useState<ProjectMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(
    null,
  );
  const [projectCoverUrls, setProjectCoverUrls] = useState<
    Record<string, string>
  >({});

  const refreshProjects = async () => {
    const list = await getProjectListAsync();
    setProjects(list);
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

  useEffect(() => {
    let isMounted = true;
    const objectUrls: string[] = [];

    const loadCovers = async () => {
      const entries = await Promise.all(
        projects.map(async (project) => {
          const coverUrl = await loadProjectCoverObjectUrl(project);
          if (coverUrl?.startsWith("blob:")) {
            objectUrls.push(coverUrl);
          }
          return [project.id, coverUrl] as const;
        }),
      );

      if (!isMounted) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setProjectCoverUrls(
        Object.fromEntries(entries.filter(([, url]) => Boolean(url))),
      );
    };

    loadCovers();

    return () => {
      isMounted = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [projects]);

  // 处理项目卡片点击
  const handleProjectClick = (projectId: string) => {
    navigate(`/canvas/${projectId}`);
  };

  // 打开创建项目弹窗
  const openCreateDialog = () => {
    setProjectToEdit(null);
    setIsProjectDialogOpen(true);
  };

  // 打开编辑弹窗
  const openEditDialog = (e: React.MouseEvent, project: ProjectMeta) => {
    e.stopPropagation();
    setProjectToEdit(project);
    setIsProjectDialogOpen(true);
  };

  // 打开删除确认弹窗
  const openDeleteDialog = (e: React.MouseEvent, project: ProjectMeta) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setIsDeleteDialogOpen(true);
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

  const handleImportProject = async () => {
    setIsImporting(true);
    try {
      const result = await importProjectDraft();
      if (result.canceled) {
        return;
      }

      if (!result.success) {
        toast.error(result.error || "导入项目失败");
        return;
      }

      await refreshProjects();
      toast.success("导入成功", {
        description: result.projectName
          ? `已导入项目「${result.projectName}」`
          : "项目草稿已导入",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportProject = async (
    e: React.MouseEvent,
    project: ProjectMeta,
  ) => {
    e.stopPropagation();
    setExportingProjectId(project.id);
    try {
      const result = await exportProjectDraft(project.id);
      if (result.canceled) {
        return;
      }

      if (!result.success) {
        toast.error(result.error || "导出项目失败");
        return;
      }

      toast.success("导出成功", {
        description: result.path
          ? `已导出到 ${result.path}`
          : `已导出项目「${project.name}」`,
      });
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
          <h1 className="text-lg font-medium">无限画布项目管理</h1>
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
          <h2 className="text-xl font-semibold mb-2">我的画布项目</h2>
          <p className="text-sm text-white/50">
            管理和编辑您的节点工作流，点击播放按钮可预览生成结果。
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
              onClick={() => handleProjectClick(project.id)}
              className="bg-[#121214] border border-white/5 rounded-xl overflow-hidden group hover:border-[#B43FEB]/40 hover:shadow-[0_0_30px_rgba(180,63,235,0.15)] transition-all duration-300 cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden bg-white/5">
                {(() => {
                  const coverSrc =
                    projectCoverUrls[project.id] || project.coverUrl;

                  return coverSrc ? (
                    <img
                      src={coverSrc}
                      alt={project.name}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/[0.02]">
                      <FileText className="w-12 h-12 text-white/20 group-hover:text-[#B43FEB]/50 transition-colors" />
                    </div>
                  );
                })()}

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                  <button
                    onClick={() => handleProjectClick(project.id)}
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
                  {project.type === "video" ? "视频创作" : "剧本创作"}
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
                      {formatTime(project.updatedAt || project.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={(e) => handleExportProject(e, project)}
                    disabled={exportingProjectId === project.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-[#B43FEB]/40 hover:text-[#d8b6ff] hover:bg-[#B43FEB]/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportingProjectId === project.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {exportingProjectId === project.id ? "导出中..." : "导出"}
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
