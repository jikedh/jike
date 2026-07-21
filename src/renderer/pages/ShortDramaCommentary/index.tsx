import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Film,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJikeingUserId } from "shared/utils/utils";
import type {
  LocalNarratorTask,
  NarratorMaterial,
  NarratorModelOptions,
  NarratorOptionItem,
  NarratorTaskStatus,
} from "shared/types/api/narrator";
import {
  createNarratorTask,
  getNarratorMaterials,
  getNarratorModelOptions,
  getNarratorTask,
  isNarratorApiConfigured,
} from "@/api/narrator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useMessage from "@/hooks/useMessage";
import {
  loadLocalNarratorTasks,
  removeLocalNarratorTask,
  saveLocalNarratorTasks,
  upsertLocalNarratorTask,
} from "service/shortDramaCommentaryStorage";

const TASK_PAGE_SIZE = 10;
const POLLING_INTERVAL_MS = 10_000;
const ACTIVE_STATUSES = new Set<NarratorTaskStatus>([1, 2, 10]);

const STATUS_META: Record<
  NarratorTaskStatus,
  { label: string; className: string }
> = {
  1: {
    label: "处理中",
    className: "border-blue-400/25 bg-blue-400/10 text-blue-300",
  },
  2: {
    label: "等待结果",
    className: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  },
  9: {
    label: "已完成",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  },
  [-1]: {
    label: "出错",
    className: "border-red-400/25 bg-red-400/10 text-red-300",
  },
  [-9]: {
    label: "失败",
    className: "border-red-400/25 bg-red-400/10 text-red-300",
  },
  10: {
    label: "合并中",
    className: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  },
};

const formatTime = (value?: string | number) => {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", { hour12: false });
};

const getPageNumbers = (page: number, totalPages: number) => {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);
};

const OptionSelect = ({
  label,
  value,
  options,
  onValueChange,
  valueMode = "value",
}: {
  label: string;
  value: string;
  options: NarratorOptionItem[];
  onValueChange: (value: string) => void;
  valueMode?: "name" | "value";
}) => (
  <label className="min-w-0 space-y-1.5">
    <span className="block text-xs text-white/45">{label}</span>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 w-full border-white/10 bg-black/25 text-white/80">
        <SelectValue placeholder={`选择${label}`} />
      </SelectTrigger>
      <SelectContent className="border-white/10 bg-[#17171b] text-white">
        {options.map((item) => {
          const optionValue = valueMode === "name" ? item.name : item.value;
          return (
            <SelectItem key={`${item.name}-${item.value}`} value={optionValue}>
              {item.name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  </label>
);

export default function ShortDramaCommentaryPage() {
  const message = useMessage();
  const userId = getJikeingUserId();
  const tasksRef = useRef<LocalNarratorTask[]>([]);
  const pollingRef = useRef(false);

  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [materials, setMaterials] = useState<NarratorMaterial[]>([]);
  const [selectedMaterial, setSelectedMaterial] =
    useState<NarratorMaterial | null>(null);
  const [modelOptions, setModelOptions] = useState<NarratorModelOptions[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [dubbing, setDubbing] = useState("");
  const [fontSize, setFontSize] = useState("");
  const [fontStyle, setFontStyle] = useState("");
  const [coverStyle, setCoverStyle] = useState("");
  const [bgm, setBgm] = useState("NO_BGM");
  const [creating, setCreating] = useState(false);

  const [tasks, setTasks] = useState<LocalNarratorTask[]>(() =>
    loadLocalNarratorTasks(userId),
  );
  const [taskPage, setTaskPage] = useState(1);
  const [refreshingTasks, setRefreshingTasks] = useState(false);

  const selectedModel = useMemo(
    () => modelOptions.find((item) => item.id === selectedModelId) || null,
    [modelOptions, selectedModelId],
  );

  const totalTaskPages = Math.max(1, Math.ceil(tasks.length / TASK_PAGE_SIZE));
  const visibleTasks = useMemo(() => {
    const start = (taskPage - 1) * TASK_PAGE_SIZE;
    return tasks.slice(start, start + TASK_PAGE_SIZE);
  }, [taskPage, tasks]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    setTasks(loadLocalNarratorTasks(userId));
    setTaskPage(1);
  }, [userId]);

  useEffect(() => {
    if (taskPage > totalTaskPages) {
      setTaskPage(totalTaskPages);
    }
  }, [taskPage, totalTaskPages]);

  const applyDefaultOptions = (model: NarratorModelOptions) => {
    setDubbing(model.dubbing[0]?.value || "");
    setFontSize(model.fontSize[0]?.name || "");
    setFontStyle(model.fontStyle[0]?.name || "");
    setCoverStyle(model.cover[0]?.value || "");
    setBgm("NO_BGM");
  };

  const loadEditingOptions = async () => {
    if (modelOptions.length > 0) return modelOptions;

    setLoadingOptions(true);
    try {
      const options = await getNarratorModelOptions();
      setModelOptions(options);
      if (options[0]) {
        setSelectedModelId(options[0].id);
        applyDefaultOptions(options[0]);
      }
      return options;
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "获取剪辑参数失败",
      );
      return [];
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSearch = async () => {
    if (!isNarratorApiConfigured()) {
      message.error("未配置 VITE_NARRATOR_API_KEY");
      return;
    }

    setSearching(true);
    try {
      const result = await getNarratorMaterials({
        name: keyword.trim(),
        page: 1,
        limit: 20,
      });
      setMaterials(result.items);
      setSelectedMaterial(null);
      if (result.items.length === 0) {
        message.info("没有搜索到可解说资源");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMaterial = async (material: NarratorMaterial) => {
    setSelectedMaterial(material);
    await loadEditingOptions();
  };

  const refreshActiveTasks = async (showResult = false) => {
    if (pollingRef.current || !isNarratorApiConfigured()) return;

    const activeTasks = tasksRef.current.filter((task) =>
      ACTIVE_STATUSES.has(task.status),
    );
    if (activeTasks.length === 0) {
      if (showResult) message.info("暂无进行中的任务");
      return;
    }

    pollingRef.current = true;
    if (showResult) setRefreshingTasks(true);

    try {
      const settled = await Promise.allSettled(
        activeTasks.map((task) => getNarratorTask(task.task_num)),
      );
      const details = new Map(
        settled.flatMap((result) =>
          result.status === "fulfilled"
            ? [[result.value.task_num, result.value] as const]
            : [],
        ),
      );

      if (details.size > 0) {
        const next = tasksRef.current.map((task) => {
          const detail = details.get(task.task_num);
          if (!detail) return task;
          return {
            ...task,
            ...detail,
            cover: detail.cover || task.cover,
            playlet_name: detail.playlet_name || task.playlet_name,
          };
        });
        tasksRef.current = next;
        setTasks(next);
        saveLocalNarratorTasks(userId, next);
      }

      if (showResult) message.success("任务状态已更新");
    } finally {
      pollingRef.current = false;
      if (showResult) setRefreshingTasks(false);
    }
  };

  useEffect(() => {
    void refreshActiveTasks();
    const timer = window.setInterval(() => {
      void refreshActiveTasks();
    }, POLLING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [userId]);

  const handleCreateTask = async () => {
    if (!selectedMaterial || !selectedModel) {
      message.error("请先选择短剧资源和解说模型");
      return;
    }
    if (!dubbing || !fontSize || !fontStyle || !coverStyle || !bgm) {
      message.error("请完整选择剪辑参数");
      return;
    }

    setCreating(true);
    try {
      const response = await createNarratorTask({
        model: selectedModel.label,
        title: selectedMaterial.name,
        dubbing,
        font_size: fontSize,
        font_style: fontStyle,
        cover: coverStyle,
        bgm,
      });

      const task: LocalNarratorTask = {
        task_num: response.task_num,
        playlet_name: selectedMaterial.name,
        cover: selectedMaterial.cover,
        status: 1,
        created_at: new Date().toISOString(),
        local_created_at: Date.now(),
        model: selectedModel.label,
        dubbing,
        font_size: fontSize,
        font_style: fontStyle,
        cover_style: coverStyle,
        bgm,
      };
      const next = upsertLocalNarratorTask(userId, task);
      tasksRef.current = next;
      setTasks(next);
      setTaskPage(1);
      message.success("解说任务已创建");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建任务失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTask = (taskNum: string) => {
    const next = removeLocalNarratorTask(userId, taskNum);
    tasksRef.current = next;
    setTasks(next);
    message.success("已删除本地任务记录");
  };

  return (
    <main className="min-h-full bg-[#101014] text-white">
      <header className="border-b border-white/8 px-6 py-5 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#B43FEB]/15 text-[#D999F5]">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">短剧解说</h1>
            <p className="mt-0.5 text-xs text-white/35">
              当前任务记录保存在本机
            </p>
          </div>
        </div>
      </header>

      <section className="border-b border-white/8">
        <div className="mx-auto max-w-[1500px] px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSearch();
              }}
              placeholder="搜索短剧名称"
              className="h-10 flex-1 border-white/10 bg-black/25 text-white placeholder:text-white/25"
            />
            <Button
              variant="blue"
              className="h-10 shrink-0"
              loading={searching}
              onClick={() => void handleSearch()}
            >
              <Search />
              搜索
            </Button>
          </div>

          {!isNarratorApiConfigured() && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-300/80">
              <CircleAlert className="h-4 w-4" />
              未配置 VITE_NARRATOR_API_KEY
            </div>
          )}

          {materials.length > 0 && (
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-w-0">
                <h2 className="mb-3 text-sm font-medium text-white/75">
                  搜索结果
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {materials.map((material) => {
                    const selected =
                      selectedMaterial?.unique_code === material.unique_code;
                    return (
                      <button
                        key={material.unique_code}
                        type="button"
                        onClick={() => void handleSelectMaterial(material)}
                        className={`grid min-h-28 grid-cols-[72px_1fr] gap-3 rounded-md border p-3 text-left transition-colors ${
                          selected
                            ? "border-[#B43FEB]/70 bg-[#B43FEB]/10"
                            : "border-white/8 bg-black/20 hover:border-white/18 hover:bg-white/[0.035]"
                        }`}
                      >
                        <div className="h-24 overflow-hidden rounded-sm bg-white/5">
                          {material.cover ? (
                            <img
                              src={material.cover}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-white/15">
                              <Film className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 py-1">
                          <div className="line-clamp-2 text-sm font-medium text-white/85">
                            {material.name}
                          </div>
                          <div className="mt-2 line-clamp-2 text-xs text-white/30">
                            {material.models?.join("、") || "短剧资源"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-l border-white/8 pl-6 max-xl:border-l-0 max-xl:border-t max-xl:pt-6 max-xl:pl-0">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-white/75">
                    剪辑参数
                  </h2>
                  {loadingOptions && (
                    <Loader2 className="h-4 w-4 animate-spin text-white/35" />
                  )}
                </div>
                {selectedMaterial && selectedModel ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <label className="space-y-1.5">
                      <span className="block text-xs text-white/45">
                        解说模型
                      </span>
                      <Select
                        value={selectedModelId}
                        onValueChange={(value) => {
                          setSelectedModelId(value);
                          const nextModel = modelOptions.find(
                            (item) => item.id === value,
                          );
                          if (nextModel) applyDefaultOptions(nextModel);
                        }}
                      >
                        <SelectTrigger className="h-10 w-full border-white/10 bg-black/25 text-white/80">
                          <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#17171b] text-white">
                          {modelOptions.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <OptionSelect
                      label="配音"
                      value={dubbing}
                      options={selectedModel.dubbing}
                      onValueChange={setDubbing}
                    />
                    <OptionSelect
                      label="字幕大小"
                      value={fontSize}
                      options={selectedModel.fontSize}
                      valueMode="name"
                      onValueChange={setFontSize}
                    />
                    <OptionSelect
                      label="字幕样式"
                      value={fontStyle}
                      options={selectedModel.fontStyle}
                      valueMode="name"
                      onValueChange={setFontStyle}
                    />
                    <OptionSelect
                      label="封面样式"
                      value={coverStyle}
                      options={selectedModel.cover}
                      onValueChange={setCoverStyle}
                    />
                    <label className="space-y-1.5">
                      <span className="block text-xs text-white/45">
                        背景音乐
                      </span>
                      <Select value={bgm} onValueChange={setBgm}>
                        <SelectTrigger className="h-10 w-full border-white/10 bg-black/25 text-white/80">
                          <SelectValue placeholder="选择背景音乐" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#17171b] text-white">
                          <SelectItem value="NO_BGM">不使用背景音乐</SelectItem>
                          {selectedModel.bgm.map((item) => (
                            <SelectItem
                              key={`${item.name}-${item.value}`}
                              value={item.value}
                            >
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <Button
                      variant="blue"
                      className="mt-2 h-10 sm:col-span-2 xl:col-span-1"
                      loading={creating}
                      onClick={() => void handleCreateTask()}
                    >
                      <Film />
                      创建解说任务
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-36 items-center justify-center border border-dashed border-white/10 text-sm text-white/30">
                    请选择短剧资源
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-6 py-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">任务列表</h2>
            <p className="mt-1 text-xs text-white/30">共 {tasks.length} 条</p>
          </div>
          <Button
            size="sm"
            loading={refreshingTasks}
            onClick={() => void refreshActiveTasks(true)}
            title="刷新任务状态"
          >
            <RefreshCw />
            刷新
          </Button>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center border-y border-white/8 text-white/25">
            <Clock3 className="mb-3 h-7 w-7" />
            <span className="text-sm">暂无本地任务</span>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTasks.map((task) => {
              const statusMeta = STATUS_META[task.status] || STATUS_META[-1];
              const isActive = ACTIVE_STATUSES.has(task.status);

              return (
                <article
                  key={task.task_num}
                  className="grid min-h-24 gap-4 rounded-md border border-white/8 bg-black/20 p-4 md:grid-cols-[64px_minmax(0,1fr)_auto]"
                >
                  <div className="h-20 overflow-hidden rounded-sm bg-white/5">
                    {task.cover ? (
                      <img
                        src={task.cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/15">
                        <Film className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-medium text-white/85">
                        {task.playlet_name || "短剧解说任务"}
                      </h3>
                      <span
                        className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] ${statusMeta.className}`}
                      >
                        {isActive ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : task.status === 9 ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <CircleAlert className="h-3 w-3" />
                        )}
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-x-5 gap-y-1 text-xs text-white/35 sm:grid-cols-2 xl:grid-cols-4">
                      <span className="truncate">模型：{task.model}</span>
                      <span className="truncate">配音：{task.dubbing}</span>
                      <span className="truncate">
                        创建：
                        {formatTime(task.created_at || task.local_created_at)}
                      </span>
                      <span className="truncate" title={task.task_num}>
                        编号：{task.task_num}
                      </span>
                    </div>
                    {task.error && (
                      <p className="mt-2 line-clamp-2 text-xs text-red-300/75">
                        {task.error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 md:flex-col md:items-end md:justify-center">
                    {task.video_url && (
                      <Button size="sm" asChild>
                        <a
                          href={task.video_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink />
                          查看结果
                        </a>
                      </Button>
                    )}
                    <Button
                      unstyled
                      className="flex h-8 w-8 items-center justify-center rounded-md text-white/25 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => handleDeleteTask(task.task_num)}
                      title="删除本地记录"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalTaskPages > 1 && (
          <nav
            className="mt-5 flex items-center justify-center gap-1.5"
            aria-label="任务分页"
          >
            <Button
              unstyled
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/8 text-white/45 hover:bg-white/5 disabled:opacity-30"
              disabled={taskPage <= 1}
              onClick={() => setTaskPage((page) => page - 1)}
              title="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {getPageNumbers(taskPage, totalTaskPages).map(
              (page, index, list) => (
                <div key={page} className="flex items-center gap-1.5">
                  {index > 0 && page - list[index - 1] > 1 && (
                    <span className="px-1 text-xs text-white/20">...</span>
                  )}
                  <Button
                    unstyled
                    className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs ${
                      page === taskPage
                        ? "bg-[#B43FEB] text-white"
                        : "border border-white/8 text-white/45 hover:bg-white/5"
                    }`}
                    onClick={() => setTaskPage(page)}
                  >
                    {page}
                  </Button>
                </div>
              ),
            )}
            <Button
              unstyled
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/8 text-white/45 hover:bg-white/5 disabled:opacity-30"
              disabled={taskPage >= totalTaskPages}
              onClick={() => setTaskPage((page) => page + 1)}
              title="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        )}
      </section>
    </main>
  );
}
