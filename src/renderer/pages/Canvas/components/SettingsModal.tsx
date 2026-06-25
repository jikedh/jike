import {
  IconBell,
  IconBolt,
  IconBook,
  IconDownload,
  IconExternalLink,
  IconFolder,
  IconPin,
  IconRefresh,
  IconRestore,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultPresets,
  type PresetItem,
  type PresetsMap,
  presetsService,
} from "service/localStorageService";
import { clearProjectList } from "service/projectStorage";
import { CANVAS_CHAT_MODELS } from "shared/constants/ai-models";
import {
  CANVAS_CHAT_PERSONAS,
  NO_CHAT_PERSONA_ID,
} from "shared/constants/chat-personas";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
} from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ModelSelector } from "@/components/ModelSelector";
import { UpdateDialog } from "@/components/ui/update-dialog";
import useMessage from "@/hooks/useMessage";
import { useUpdater } from "@/hooks/useUpdater";
import { useAnnouncementStore } from "@/stores/announcementStore";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  isFirstLogin?: boolean;
};

const settingSections = [
  { id: "general", label: "通用设置" },
  { id: "canvas", label: "画布设置" },
  { id: "interaction", label: "节点交互" },
  { id: "ai", label: "AI 助手" },
  { id: "presets", label: "预设提示词库" },
  { id: "collab", label: "协作通知" },
  { id: "announcements", label: "通知中心" },
  { id: "data", label: "数据与版本" },
  { id: "shortcuts", label: "快捷键" },
  { id: "labs", label: "实验功能", devOnly: true },
  { id: "about", label: "关于支持" },
];

const sectionPlaceholderMap = {
  general: [{ label: "自动保存", type: "toggle" }],
  canvas: [
    { label: "网格显示", type: "toggle" },
    { label: "吸附网格", type: "toggle" },
  ],
  interaction: [{ label: "拖拽辅助线", type: "toggle" }],
  ai: [],
  presets: [],
  collab: [{ label: "@我提醒", type: "toggle" }],
  announcements: [],
  data: [{ label: "自动备份", type: "toggle" }],
  shortcuts: [
    { label: "开启单键模式", type: "toggle" },
    { label: "冲突提示", type: "toggle" },
  ],
  labs: [
    { label: "Beta 功能总开关", type: "toggle" },
    { label: "轻量渲染模式", type: "toggle" },
  ],
  about: [],
};

const sectionIdSet = new Set(settingSections.map((item) => item.id));

export const SettingsModal = ({
  open,
  onClose,
  isFirstLogin = false,
}: SettingsModalProps) => {
  const [activeSection, setActiveSection] = useState(
    isFirstLogin ? "data" : settingSections[0].id,
  );
  const [isDev, setIsDev] = useState(false);
  const {
    defaultModel,
    defaultPersonaId,
    autoSaveEnabled,
    nodeSearchVisible,
    devToolsVisible,
    gridVisible,
    snapToGrid,
    edgeAnimationEnabled,
    storagePath,
    assetStoragePath,
    jianyingDraftsPath,
    updateUrl,
    setDefaultModel,
    setDefaultPersonaId,
    setAutoSaveEnabled,
    setNodeSearchVisible,
    setDevToolsVisible,
    setGridVisible,
    setSnapToGrid,
    setEdgeAnimationEnabled,
    setStoragePath,
    setAssetStoragePath,
    setJianyingDraftsPath,
    resetToDefault,
  } = useChatSettingsStore();
  const { success, error } = useMessage();
  const exportCanvasData = useCanvasFlowStore(
    (state) => state.exportCanvasData,
  );

  // 自动更新：默认走 Tauri updater，开发态自动模拟
  const {
    state: updateState,
    progress: updateProgress,
    updateInfo,
    error: updateError,
    checkForUpdates,
    startUpdate,
    restartApp,
    resetState: resetUpdateState,
  } = useUpdater();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const importCanvasData = useCanvasFlowStore(
    (state) => state.importCanvasData,
  );

  // 导入确认弹窗状态
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 预设提示词库状态 — 按类型分组
  // 懒初始化：优先读取已保存的预设，避免组件首次挂载时把空值写回 localStorage。
  const [presets, setPresets] = useState<PresetsMap>(
    () => presetsService.load() ?? defaultPresets,
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    type: "general" as "general" | "image" | "video",
  });
  const [appVersion, setAppVersion] = useState("");

  const announcements = useAnnouncementStore((state) => state.announcements);
  const announcementsLoading = useAnnouncementStore(
    (state) => state.announcementsLoading,
  );
  const hasUnreadAnnouncements = useAnnouncementStore(
    (state) => state.hasUnreadAnnouncements,
  );
  const fetchAnnouncements = useAnnouncementStore(
    (state) => state.fetchAnnouncements,
  );
  const enterAnnouncementCenter = useAnnouncementStore(
    (state) => state.enterAnnouncementCenter,
  );
  const clearNewAnnouncementMarks = useAnnouncementStore(
    (state) => state.clearNewAnnouncementMarks,
  );
  const newAnnouncementIds = useAnnouncementStore(
    (state) => state.newAnnouncementIds,
  );

  // 切换到通知中心时自动请求公告，并认为当前公告已读
  useEffect(() => {
    if (!open || activeSection !== "announcements") return;
    enterAnnouncementCenter();
    void fetchAnnouncements().then(() => {
      enterAnnouncementCenter();
    });
  }, [open, activeSection, enterAnnouncementCenter, fetchAnnouncements]);

  useEffect(() => {
    if (open) return;
    clearNewAnnouncementMarks();
  }, [open, clearNewAnnouncementMarks]);

  // 弹窗打开时从 localStorage 加载预设，首次无数据则写入默认预设
  useEffect(() => {
    if (!open) return;
    const saved = presetsService.load();
    setPresets(saved ?? defaultPresets);
  }, [open]);

  // presets 变化时自动持久化
  // 仅在弹窗打开期间持久化，避免页面初始化/项目切换时出现无意义覆盖。
  useEffect(() => {
    if (!open) return;
    presetsService.save(presets);
  }, [open, presets]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    window.debug
      ?.getAppVersion()
      .then((version) => {
        if (!cancelled) setAppVersion(version || "");
      })
      .catch(() => {
        if (!cancelled) setAppVersion("");
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // 确认对话框状态
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogAction, setConfirmDialogAction] = useState<
    "add" | "delete" | null
  >(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteType, setPendingDeleteType] = useState<string | null>(
    null,
  );

  const handleAddPreset = () => {
    if (!formData.name.trim()) {
      error("请输入预设名称");
      return;
    }
    setConfirmDialogAction("add");
    setConfirmDialogOpen(true);
  };

  const resetPresetForm = () => {
    setFormData({ name: "", content: "", type: "general" });
  };

  const confirmAddPreset = () => {
    const newPreset = {
      name: formData.name.trim(),
      content: formData.content,
      enabled: true,
      id: Math.random().toString(36).substring(2, 11),
    };
    setPresets((prev) => {
      const updated = {
        ...prev,
        [formData.type]: [newPreset, ...(prev[formData.type] ?? [])],
      };
      presetsService.save(updated);
      return updated;
    });
    setIsAdding(false);
    resetPresetForm();
    setConfirmDialogOpen(false);
    setConfirmDialogAction(null);
    success("预设创建成功");
  };

  const handleUpdatePreset = () => {
    if (!editingId) return;
    if (!formData.name.trim()) {
      error("请输入预设名称");
      return;
    }
    setPresets((prev) => {
      const updated = {
        ...prev,
        [formData.type]: prev[formData.type].map((p) =>
          p.id === editingId
            ? {
              name: formData.name.trim(),
              content: formData.content,
              enabled: p.enabled,
              id: editingId,
            }
            : p,
        ),
      };
      presetsService.save(updated);
      return updated;
    });
    setEditingId(null);
    resetPresetForm();
    success("预设更新成功");
  };

  const handleDeletePreset = (type: string, id: string) => {
    setPendingDeleteId(id);
    setPendingDeleteType(type);
    setConfirmDialogAction("delete");
    setConfirmDialogOpen(true);
  };

  const confirmDeletePreset = () => {
    if (pendingDeleteId && pendingDeleteType) {
      setPresets((prev) => {
        const updated = {
          ...prev,
          [pendingDeleteType]: prev[pendingDeleteType].filter(
            (p: PresetItem) => p.id !== pendingDeleteId,
          ),
        };
        presetsService.save(updated);
        return updated;
      });
      success("预设删除成功");
    }
    setConfirmDialogOpen(false);
    setConfirmDialogAction(null);
    setPendingDeleteId(null);
    setPendingDeleteType(null);
  };

  const togglePresetEnabled = (type: string, id: string) => {
    setPresets((prev) => {
      const updated = {
        ...prev,
        [type]: prev[type].map((p: PresetItem) =>
          p.id === id ? { ...p, enabled: !p.enabled } : p,
        ),
      };
      presetsService.save(updated);
      return updated;
    });
  };

  const startEditPreset = (
    preset: { id: string; name: string; content: string; enabled: boolean },
    type: "general" | "image" | "video",
  ) => {
    setEditingId(preset.id);
    setFormData({ name: preset.name, content: preset.content, type });
    setIsAdding(false);
  };

  useEffect(() => {
    const checkDevEnvironment = async () => {
      try {
        const debugApi = window.debug;
        if (debugApi?.isDev) {
          const isDevEnv = await debugApi.isDev();
          setIsDev(isDevEnv);
        } else {
          setIsDev(false);
        }
      } catch {
        setIsDev(false);
      }
    };
    checkDevEnvironment();
  }, []);

  useEffect(() => {
    if (open && !storagePath && window.storage) {
      window.storage.getDefaultPath().then((defaultPath) => {
        if (defaultPath) {
          setStoragePath(defaultPath);
        }
      });
    }
  }, [open, storagePath, setStoragePath]);

  const handleSelectStoragePath = async () => {
    if (!window.storage) {
      error("存储功能不可用");
      return;
    }

    const selectedPath = await window.storage.selectDirectory();

    if (selectedPath && selectedPath !== storagePath) {
      setStoragePath(selectedPath);
      clearProjectList();
      success("存储路径已更新（旧路径数据不会自动迁移）");
    }
  };

  const handleSelectAssetStoragePath = async () => {
    if (!window.storage) {
      error("存储功能不可用");
      return;
    }

    const selectedPath = await window.storage.selectDirectory();

    if (selectedPath && selectedPath !== assetStoragePath) {
      setAssetStoragePath(selectedPath);
      success("资产存储路径已更新");
    }
  };

  const handleSelectJianyingDraftsPath = async () => {
    if (!window.storage) {
      error("存储功能不可用");
      return;
    }

    const selectedPath = await window.storage.selectDirectory();

    if (selectedPath && selectedPath !== jianyingDraftsPath) {
      setJianyingDraftsPath(selectedPath);
      success("剪映草稿路径已更新");
    }
  };

  const handleCheckUpdate = async () => {
    // 打开弹窗后再异步检查，便于用户立即看到 loading 状态
    setUpdateDialogOpen(true);
    resetUpdateState();
    const hasUpdate = await checkForUpdates();
    if (!hasUpdate && updateState !== "available") {
      // 已是最新 / 检查失败：弹窗保持打开，由 UpdateDialog 渲染对应状态
    }
  };

  const handleRetryUpdate = async () => {
    const hasUpdate = await checkForUpdates();
    return hasUpdate;
  };

  // 检测/下载全部失败时，让用户可以手动打开浏览器去下载页面（兜底）
  const handleOpenUpdateUrlManually = () => {
    const nextUrl = updateUrl.trim();
    if (!nextUrl) {
      error("未配置更新地址，无法打开下载页面");
      return;
    }
    window.open(nextUrl, "_blank", "noopener,noreferrer");
  };

  const currentSectionItems = useMemo(() => {
    if (!sectionIdSet.has(activeSection)) {
      return [];
    }

    return (
      sectionPlaceholderMap[
      activeSection as keyof typeof sectionPlaceholderMap
      ] ?? []
    );
  }, [activeSection]);

  // 导出画布数据
  const handleExport = () => {
    const data = exportCanvasData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `canvas-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    success("导出成功");
  };

  // 触发文件选择
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // 读取文件并弹出确认框
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setPendingImportData(data);
        setImportConfirmOpen(true);
      } catch {
        error("JSON 文件格式错误");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // 确认导入
  const handleConfirmImport = () => {
    if (pendingImportData) {
      importCanvasData(pendingImportData);
      success("导入成功");
    }
    setImportConfirmOpen(false);
    setPendingImportData(null);
  };

  // 切换 Tauri 开发者工具
  const handleToggleTauriDevTools = async () => {
    const debugApi = (window as any).debug;

    if (!debugApi?.toggleDevTools) {
      error("当前环境不支持打开开发者工具");
      return;
    }

    const result = await debugApi.toggleDevTools();
    if (result.success) {
      success("已切换开发者工具");
      return;
    }

    error(result.error || "切换开发者工具失败");
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(nextOpen) => !nextOpen && !isFirstLogin && onClose()}
      >
        <ModalContent
          aria-label="设置弹窗"
          className={undefined}
        >
          <div
            className={cn(
              "flex flex-col",
              "h-[min(76vh,720px)]",
            )}
          >
            <header className="flex items-start justify-between border-b border-white/5 px-6 py-5">
              <div>
                <ModalTitle>
                  {isFirstLogin ? "欢迎使用即刻" : "画布设置中心"}
                </ModalTitle>
                <ModalDescription>
                  {isFirstLogin
                    ? "请先设置项目存储路径，以便保存您的创作内容"
                    : "当前均为占位配置，后续可逐项接入真实能力。"}
                </ModalDescription>
              </div>
              {!isFirstLogin && (
                <button
                  type="button"
                  title="关闭"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                  onClick={onClose}
                >
                  <IconX size={18} />
                </button>
              )}
            </header>

            <div
              className={`grid min-h-0 flex-1 ${isFirstLogin ? "" : "grid-cols-[220px_1fr]"}`}
            >
              {!isFirstLogin && (
                <aside className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain border-r border-white/5 bg-black/20 p-3">
                  <div className="space-y-1">
                    {settingSections
                      .filter(
                        (section) => !((section as any).devOnly && !isDev),
                      )
                      .map((section) => {
                        const getIcon = () => {
                          if (section.id === "data")
                            return <IconDownload size={14} />;
                          if (section.id === "about")
                            return <IconBolt size={14} />;
                          if (section.id === "presets")
                            return <IconBook size={14} />;
                          if (section.id === "announcements")
                            return <IconBell size={14} />;
                          return <IconBolt size={14} />;
                        };

                        return (
                          <button
                            key={section.id}
                            type="button"
                            className={cn(
                              "relative flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                              activeSection === section.id
                                ? "bg-[#B43FEB]/10 text-[#B43FEB]"
                                : "text-white/60 hover:bg-white/5 hover:text-white/80",
                            )}
                            onClick={() => {
                              setActiveSection(section.id);
                              if (section.id === "announcements") {
                                enterAnnouncementCenter();
                              }
                            }}
                          >
                            {getIcon()}
                            <span>{section.label}</span>
                            {section.id === "announcements" &&
                              hasUnreadAnnouncements && (
                                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#09090d]" />
                              )}
                          </button>
                        );
                      })}
                  </div>
                </aside>
              )}

              <main className="no-scrollbar min-h-0 overflow-auto px-6 py-5">
                <div className="space-y-3">
                  {/* AI 助手 - 真实配置 */}
                  {activeSection === "ai" && (
                    <>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="mb-3 text-sm font-medium text-white/80">
                          默认模型
                        </div>
                        <ModelSelector
                          value={defaultModel}
                          onChange={setDefaultModel}
                          models={CANVAS_CHAT_MODELS}
                        />
                      </section>

                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="mb-3 text-sm font-medium text-white/80">
                          默认人设
                        </div>
                        <Select
                          value={defaultPersonaId}
                          onValueChange={(v) =>
                            setDefaultPersonaId(v as typeof defaultPersonaId)
                          }
                        >
                          <SelectTrigger className="h-9 w-full border-white/10 bg-black/50 text-sm text-white">
                            <SelectValue placeholder="请选择人设" />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value={NO_CHAT_PERSONA_ID}>
                              无（默认）
                            </SelectItem>
                            {CANVAS_CHAT_PERSONAS.map((persona) => (
                              <SelectItem key={persona.id} value={persona.id}>
                                {persona.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </section>
                    </>
                  )}

                  {/* 预设提示词库 */}
                  {activeSection === "presets" && (
                    <>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-sm font-medium text-white/80">
                              预设提示词库
                            </div>
                            <div className="text-xs text-white/40 mt-1">
                              管理您的个性化提示词预设
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="blue"
                            onClick={() => {
                              setIsAdding(true);
                              setEditingId(null);
                              resetPresetForm();
                            }}
                          >
                            新增预设
                          </Button>
                        </div>

                        {(isAdding || editingId) && (
                          <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-4">
                            <div className="text-sm font-medium text-white/80 mb-4">
                              {editingId ? "编辑预设" : "创建新预设"}
                            </div>
                            <div className="space-y-4">
                              <div>
                                <label className="text-xs text-white/40 mb-1 block">
                                  预设名称
                                </label>
                                <input
                                  type="text"
                                  value={formData.name}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      name: e.target.value,
                                    })
                                  }
                                  placeholder="例如：赛博朋克风格"
                                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B43FEB] focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-white/40 mb-1 block">
                                  适用范围
                                </label>
                                <div className="flex gap-2">
                                  {["general", "image", "video"].map((t) => (
                                    <button
                                      type="button"
                                      key={t}
                                      onClick={() =>
                                        setFormData({
                                          ...formData,
                                          type: t as
                                            | "general"
                                            | "image"
                                            | "video",
                                        })
                                      }
                                      className={cn(
                                        "flex-1 py-2 rounded-lg text-xs font-medium border transition-all",
                                        formData.type === t
                                          ? "bg-[#B43FEB]/20 border-[#B43FEB] text-[#B43FEB]"
                                          : "bg-black/50 border-white/10 text-white/40 hover:border-white/20",
                                      )}
                                    >
                                      {t === "general"
                                        ? "通用"
                                        : t === "image"
                                          ? "生图"
                                          : "视频"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-white/40 mb-1 block">
                                  提示词正文
                                </label>
                                <textarea
                                  value={formData.content}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      content: e.target.value,
                                    })
                                  }
                                  placeholder="输入您的提示词内容..."
                                  rows={3}
                                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B43FEB] focus:outline-none resize-none"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                                  onClick={() => {
                                    setIsAdding(false);
                                    setEditingId(null);
                                  }}
                                >
                                  取消
                                </Button>
                                <Button
                                  size="sm"
                                  variant="blue"
                                  onClick={
                                    editingId
                                      ? handleUpdatePreset
                                      : handleAddPreset
                                  }
                                >
                                  {editingId ? "保存" : "创建"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {(["general", "image", "video"] as const).map(
                          (type) => {
                            const items = presets[type] ?? [];
                            return (
                              <div key={type} className="mb-5 last:mb-0">
                                <div className="text-xs font-medium uppercase text-white/30 mb-2 px-1">
                                  {type === "general"
                                    ? "通用"
                                    : type === "image"
                                      ? "生图"
                                      : "视频"}
                                </div>
                                {items.length === 0 ? (
                                  <div className="text-center py-5 bg-black/30 border border-dashed border-white/10 rounded-lg">
                                    <p className="text-xs text-white/30">
                                      暂无预设
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {items.map((preset) => (
                                      <div
                                        key={preset.id}
                                        className={cn(
                                          "bg-black/30 border rounded-lg p-3 flex items-start justify-between transition-all",
                                          preset.enabled
                                            ? "border-white/5"
                                            : "border-white/5 opacity-50",
                                        )}
                                      >
                                        <div className="flex gap-3 flex-1">
                                          <div
                                            className={cn(
                                              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                                              type === "image"
                                                ? "bg-blue-500/20 text-blue-400"
                                                : type === "video"
                                                  ? "bg-purple-500/20 text-purple-400"
                                                  : "bg-green-500/20 text-green-400",
                                            )}
                                          >
                                            {type === "image"
                                              ? "图"
                                              : type === "video"
                                                ? "视"
                                                : "通"}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-sm font-medium text-white/90 truncate">
                                                {preset.name}
                                              </span>
                                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/5 text-white/30">
                                                {type}
                                              </span>
                                            </div>
                                            <p className="text-xs text-white/40 line-clamp-1">
                                              {preset.content}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 ml-3">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              togglePresetEnabled(
                                                type,
                                                preset.id,
                                              )
                                            }
                                            className={cn(
                                              "p-1.5 rounded-lg transition-all",
                                              preset.enabled
                                                ? "bg-[#B43FEB]/10 text-[#B43FEB]"
                                                : "bg-white/5 text-white/20",
                                            )}
                                            title={
                                              preset.enabled
                                                ? "点击禁用"
                                                : "点击启用"
                                            }
                                          >
                                            <IconBolt size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              startEditPreset(preset, type)
                                            }
                                            title="编辑预设"
                                            className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                          >
                                            <IconRestore size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDeletePreset(
                                                type,
                                                preset.id,
                                              )
                                            }
                                            title="删除预设"
                                            className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-red-500/10 hover:text-red-500 transition-all"
                                          >
                                            <IconX size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          },
                        )}
                      </section>
                    </>
                  )}

                  {/* 通用设置 - 自动保存开关 */}
                  {activeSection === "general" && (
                    <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-white/80">
                            自动保存
                          </div>
                          <div className="text-xs text-white/40 mt-1">
                            新建或删除节点时自动保存画布
                          </div>
                        </div>
                        <Switch
                          checked={autoSaveEnabled}
                          onCheckedChange={setAutoSaveEnabled}
                        />
                      </div>
                    </section>
                  )}

                  {/* 画布设置 - 网格显示开关 */}
                  {activeSection === "canvas" && (
                    <>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white/80">
                              网格点显示
                            </div>
                            <div className="text-xs text-white/40 mt-1">
                              在画布背景显示参考网格点
                            </div>
                          </div>
                          <Switch
                            checked={gridVisible}
                            onCheckedChange={setGridVisible}
                          />
                        </div>
                      </section>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white/80">
                              吸附网格
                            </div>
                            <div className="text-xs text-white/40 mt-1">
                              拖拽节点时自动吸附到网格点
                            </div>
                          </div>
                          <Switch
                            checked={snapToGrid}
                            onCheckedChange={setSnapToGrid}
                          />
                        </div>
                      </section>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white/80">
                              连接线动效
                            </div>
                            <div className="text-xs text-white/40 mt-1">
                              选中节点时显示连接线上的流光提示
                            </div>
                          </div>
                          <Switch
                            checked={edgeAnimationEnabled}
                            onCheckedChange={setEdgeAnimationEnabled}
                          />
                        </div>
                      </section>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white/80">
                              节点搜索栏显示
                            </div>
                            <div className="text-xs text-white/40 mt-1">
                              控制画布右上角节点搜索栏的显示
                            </div>
                          </div>
                          <Switch
                            checked={nodeSearchVisible}
                            onCheckedChange={setNodeSearchVisible}
                          />
                        </div>
                      </section>
                      {/* 调试工具面板开关 */}
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white/80">
                              调试工具面板
                            </div>
                            <div className="text-xs text-white/40 mt-1">
                              控制 ReactFlow 调试工具面板的显示
                            </div>
                          </div>
                          <Switch
                            checked={devToolsVisible}
                            onCheckedChange={setDevToolsVisible}
                          />
                        </div>
                      </section>
                    </>
                  )}

                  {/* 通知中心 - 公告列表 */}
                  {activeSection === "announcements" && (
                    <>
                      <section className="rounded-xl px-4 py-4">
                        <div className="mb-3 text-sm font-medium text-white/80">
                          公告列表
                        </div>
                        {announcementsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B43FEB] border-t-transparent" />
                          </div>
                        ) : announcements.length === 0 ? (
                          <div className="py-8 text-center text-sm text-white/40">
                            暂无公告
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {[...announcements]
                              .sort((a, b) => {
                                // 置顶优先
                                if (a.is_pinned && !b.is_pinned) return -1;
                                if (!a.is_pinned && b.is_pinned) return 1;
                                return 0;
                              })
                              .map((item) => {
                                const isNewAnnouncement =
                                  newAnnouncementIds.includes(item.id);

                                return (
                                  <div
                                    key={item.id}
                                    className="relative rounded-xl px-4 py-3 pr-8"
                                    style={
                                      item.is_pinned || isNewAnnouncement
                                        ? {
                                          border:
                                            "1px solid rgba(180, 63, 235, 0.25)",
                                          background:
                                            "linear-gradient(135deg, rgba(180, 63, 235, 0.08), rgba(180, 63, 235, 0.02))",
                                        }
                                        : {
                                          border:
                                            "1px solid rgba(255, 255, 255, 0.05)",
                                          background: "rgba(0, 0, 0, 0.2)",
                                        }
                                    }
                                  >
                                    {isNewAnnouncement && (
                                      <span className="absolute right-4 top-3 text-xs font-medium text-red-400">
                                        新
                                      </span>
                                    )}
                                    <div className="flex items-center gap-2 mb-1.5">
                                      {item.is_pinned && (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-[#B43FEB]/15 px-1.5 py-0.5 text-[11px] text-[#B43FEB]">
                                          <IconPin size={11} />
                                          置顶
                                        </span>
                                      )}
                                      <span className="text-sm font-medium text-white/85">
                                        {item.title}
                                      </span>
                                    </div>
                                    <div className="mb-2 text-[11px] text-white/35">
                                      {item.created_time
                                        ? new Date(
                                          item.created_time,
                                        ).toLocaleString("zh-CN", {
                                          year: "numeric",
                                          month: "2-digit",
                                          day: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                        : ""}
                                    </div>
                                    <div className="text-[13px] leading-relaxed text-white/60 whitespace-pre-wrap">
                                      {item.content}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </section>
                    </>
                  )}

                  {/* 数据与版本 - 导入导出 */}
                  {activeSection === "data" && (
                    <>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="mb-3 text-sm font-medium text-white/80">
                          版本更新
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-white/40">
                            当前版本：{appVersion || "读取中"}
                          </div>
                          <Button
                            size="sm"
                            variant="blue"
                            onClick={() => void handleCheckUpdate()}
                          >
                            <IconRefresh size={14} />
                            检查更新
                          </Button>
                        </div>
                        <div className="mt-3 text-[11px] text-white/30 leading-relaxed">
                          检测到新版本后会自动下载并安装；安装完成后重启应用即可生效。
                        </div>
                      </section>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="mb-3 text-sm font-medium text-white/80">
                          项目存储路径
                        </div>
                        <div className="text-xs text-white/40 mb-3">
                          项目文件将存储在此路径下，包括画布数据、图片、视频和音频文件
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white/60 truncate">
                            {storagePath || "未设置"}
                          </div>
                          <Button
                            size="sm"
                            variant="blue"
                            onClick={handleSelectStoragePath}
                          >
                            <IconFolder size={14} />
                            选择路径
                          </Button>
                        </div>
                      </section>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="mb-3 text-sm font-medium text-white/80">
                          资产存储路径
                        </div>
                        <div className="text-xs text-white/40 mb-3">
                          资产库文件将存储在此路径下，包括项目资产、按项目隔离的画布资产和资产索引
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white/60 truncate">
                            {assetStoragePath || "未设置"}
                          </div>
                          <Button
                            size="sm"
                            variant="blue"
                            onClick={handleSelectAssetStoragePath}
                          >
                            <IconFolder size={14} />
                            选择路径
                          </Button>
                        </div>
                      </section>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="mb-3 text-sm font-medium text-white/80">
                          剪映草稿路径
                        </div>
                        <div className="text-xs text-white/40 mb-3">
                          导出到剪映时会在此目录下创建剪映草稿工程
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white/60 truncate">
                            {jianyingDraftsPath || "未设置"}
                          </div>
                          <Button
                            size="sm"
                            variant="blue"
                            onClick={handleSelectJianyingDraftsPath}
                          >
                            <IconFolder size={14} />
                            选择路径
                          </Button>
                        </div>
                      </section>
                      <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                        <div className="mb-3 text-sm font-medium text-white/80">
                          画布数据
                        </div>
                        <div className="text-xs text-white/40 mb-3">
                          导出或导入画布的 JSON 数据
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="blue"
                            onClick={handleExport}
                          >
                            <IconDownload size={14} />
                            导出
                          </Button>
                          <Button size="sm" onClick={handleImportClick}>
                            <IconUpload size={14} />
                            导入
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            title="导入预设文件"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </div>
                      </section>
                    </>
                  )}

                  {/* 实验功能 - Tauri 开发者工具 */}
                  {activeSection === "labs" && isDev && (
                    <section className="rounded-xl border border-white/5 bg-black/20 px-4 py-4">
                      <div className="mb-3 text-sm font-medium text-white/80">
                        Tauri 开发者工具
                      </div>
                      <div className="text-xs text-white/40 mb-3">
                        点击后可打开或关闭 Tauri WebView 控制台（DevTools）
                      </div>
                      <Button
                        size="sm"
                        variant="blue"
                        onClick={handleToggleTauriDevTools}
                      >
                        <IconBolt size={14} />
                        切换开发者工具
                      </Button>
                    </section>
                  )}

                  {currentSectionItems
                    .filter((item) => {
                      // 已接入真实功能的项不再走占位渲染
                      if (
                        activeSection === "general" &&
                        item.label === "自动保存"
                      )
                        return false;
                      if (
                        activeSection === "canvas" &&
                        (item.label === "网格显示" || item.label === "吸附网格")
                      )
                        return false;
                      return true;
                    })
                    .map((item) => (
                      <section
                        key={item.label}
                        className="rounded-xl border border-white/5 bg-black/20 px-4 py-4"
                      >
                        <div className="mb-3 text-sm font-medium text-white/80">
                          {item.label}
                        </div>

                        {item.type === "toggle" && (
                          <div className="flex items-center justify-between rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-white/40">
                            <span>占位开关（暂不生效）</span>
                            <span className="rounded-md bg-white/5 px-2 py-1">
                              OFF
                            </span>
                          </div>
                        )}
                      </section>
                    ))}
                </div>
              </main>
            </div>

            <footer className="flex items-center justify-between border-t border-white/5 px-6 py-4">
              {!isFirstLogin && (
                <Button variant="blue" size="sm" onClick={resetToDefault}>
                  <IconRestore size={14} />
                  恢复默认
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {!isFirstLogin && (
                  <Button size="sm" onClick={onClose}>
                    取消
                  </Button>
                )}
                <Button size="sm" variant="blue" onClick={onClose}>
                  {isFirstLogin ? "确认" : "保存"}
                </Button>
              </div>
            </footer>
          </div>
        </ModalContent>
      </Modal>

      {/* 导入确认弹窗 */}
      <Dialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认导入</DialogTitle>
            <DialogDescription>
              导入将覆盖当前画布的所有内容，此操作不可撤销。是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => setImportConfirmOpen(false)}>
              取消
            </Button>
            <Button size="sm" variant="blue" onClick={handleConfirmImport}>
              确认导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 预设提示词库确认对话框 */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {confirmDialogAction === "add" ? "确认创建预设" : "确认删除预设"}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {confirmDialogAction === "add"
                ? `确定要创建预设"${formData.name}"吗？`
                : "确定要删除这个预设吗？此操作不可撤销。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              size="sm"
              className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => setConfirmDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              variant="blue"
              onClick={
                confirmDialogAction === "add"
                  ? confirmAddPreset
                  : confirmDeletePreset
              }
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 自动更新弹窗 */}
      <UpdateDialog
        open={updateDialogOpen}
        onOpenChange={(nextOpen) => {
          setUpdateDialogOpen(nextOpen);
          if (!nextOpen) resetUpdateState();
        }}
        state={updateState}
        progress={updateProgress}
        updateInfo={updateInfo}
        error={updateError}
        currentVersion={appVersion}
        onCheckForUpdates={checkForUpdates}
        onStartUpdate={startUpdate}
        onRestartApp={restartApp}
        onRetry={handleRetryUpdate}
        fallbackOpenUrl={updateUrl}
        onFallbackOpen={handleOpenUpdateUrlManually}
      />
    </>
  );
};
