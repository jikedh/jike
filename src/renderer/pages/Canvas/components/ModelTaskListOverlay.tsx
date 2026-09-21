import {
    IconArrowLeft,
    IconChevronLeft,
    IconChevronRight,
    IconRefresh,
    IconVideo,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "shared/utils/utils";
import {
    getImageModelTaskList,
    getVideoModelTaskList,
    type ImageModelTask,
    type ModelTaskPage,
    type VideoModelTask,
} from "@/api/jikeGo";

type ModelTaskListType = "video" | "image";
type TaskItem = ImageModelTask | VideoModelTask;

type ModelTaskListOverlayProps = {
    open: boolean;
    projectId: string | null;
    type: ModelTaskListType;
    onClose: () => void;
};

const PAGE_SIZE = 20;
const SUCCESS_CODES = new Set([0, 200]);

const STATUS_TEXT: Record<string, string> = {
    PENDING: "处理中",
    RUNNING: "处理中",
    PROCESSING: "处理中",
    SUCCESS: "成功",
    SUCCEEDED: "成功",
    COMPLETED: "成功",
    FAIL: "失败",
    FAILED: "失败",
};

const STATUS_CLASS: Record<string, string> = {
    PENDING: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    RUNNING: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    PROCESSING: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    SUCCESS: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    SUCCEEDED: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    COMPLETED: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    FAIL: "border-red-300/20 bg-red-300/10 text-red-200",
    FAILED: "border-red-300/20 bg-red-300/10 text-red-200",
};

const TASK_TYPE_TEXT: Record<string, string> = {
    text_to_image: "文生图",
    image_to_image: "图生图",
    edit: "图片编辑",
};

const isImageTask = (task: TaskItem): task is ImageModelTask =>
    "taskType" in task;

const ModelTaskListOverlay = ({
    open,
    projectId,
    type,
    onClose,
}: ModelTaskListOverlayProps) => {
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("");
    const [data, setData] = useState<ModelTaskPage<TaskItem>>({
        list: [],
        total: 0,
        page: 1,
        pageSize: PAGE_SIZE,
    });
    const [loading, setLoading] = useState(false);
    const [errorText, setErrorText] = useState("");
    const [refreshIndex, setRefreshIndex] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        setPage(1);
        setStatus("");
    }, [projectId, type]);

    useEffect(() => {
        if (!open || !projectId) return;

        let cancelled = false;
        const loadTasks = async () => {
            setLoading(true);
            setErrorText("");
            try {
                const params = {
                    projectId,
                    page,
                    pageSize: PAGE_SIZE,
                    status: status || undefined,
                };
                const envelope = type === "image"
                    ? await getImageModelTaskList(params)
                    : await getVideoModelTaskList(params);
                if (!SUCCESS_CODES.has(envelope.code) || !envelope.data) {
                    throw new Error(envelope.msg || "加载任务列表失败");
                }
                if (!cancelled) {
                    setData(envelope.data);
                }
            } catch (error: any) {
                if (!cancelled) {
                    setData({ list: [], total: 0, page, pageSize: PAGE_SIZE });
                    setErrorText(error?.message || "加载任务列表失败");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadTasks();
        return () => {
            cancelled = true;
        };
    }, [open, page, projectId, refreshIndex, status, type]);

    const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    const title = type === "image" ? "图片模型任务列表" : "视频模型任务列表";

    const refresh = useCallback(() => {
        setRefreshIndex((current) => current + 1);
    }, []);

    if (!open) return null;

    return (
        <div className="noflow nodrag nopan nowheel fixed inset-0 z-90 flex bg-[#0d0d12] text-white">
            <div className="flex min-h-0 w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(180,63,235,0.14),transparent_36%),#0d0d12]">
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
                    <div className="flex min-w-0 items-center gap-4">
                        <button
                            type="button"
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white"
                            onClick={onClose}
                        >
                            <IconArrowLeft size={17} />
                            返回画布
                        </button>
                        <div className="min-w-0">
                            <h1 className="truncate text-base font-semibold">{title}</h1>
                            <p className="mt-0.5 text-xs text-white/40">项目 ID：{projectId || "-"}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={loading}
                        onClick={refresh}
                    >
                        <IconRefresh size={16} className={loading ? "animate-spin" : ""} />
                        刷新
                    </button>
                </header>

                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/8 px-6 py-3">
                    <span className="text-sm text-white/50">共 {data.total} 条任务</span>
                    <select
                        value={status}
                        className="h-9 rounded-lg border border-white/10 bg-[#17171d] px-3 text-sm text-white/80 outline-none"
                        onChange={(event) => {
                            setPage(1);
                            setStatus(event.target.value);
                        }}
                    >
                        <option value="">全部状态</option>
                        <option value="PENDING">处理中</option>
                        <option value="SUCCESS">成功</option>
                        <option value="FAIL">失败</option>
                    </select>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
                    {errorText ? (
                        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/5 text-sm text-red-200">
                            {errorText}
                        </div>
                    ) : (
                        <TaskTable
                            tasks={data.list}
                            type={type}
                            loading={loading}
                            onPreviewImage={setPreviewUrl}
                        />
                    )}
                </div>

                <footer className="flex h-16 shrink-0 items-center justify-between border-t border-white/10 px-6">
                    <span className="text-xs text-white/40">第 {page} / {totalPages} 页</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={loading || page <= 1}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                            <IconChevronLeft size={16} />
                            上一页
                        </button>
                        <button
                            type="button"
                            className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={loading || page >= totalPages}
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        >
                            下一页
                            <IconChevronRight size={16} />
                        </button>
                    </div>
                </footer>
            </div>

            {previewUrl ? (
                <button
                    type="button"
                    className="fixed inset-0 z-91 flex items-center justify-center bg-black/85 p-8"
                    onClick={() => setPreviewUrl(null)}
                >
                    <img
                        src={previewUrl}
                        alt="任务图片预览"
                        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                    />
                </button>
            ) : null}
        </div>
    );
};

const TaskTable = ({
    tasks,
    type,
    loading,
    onPreviewImage,
}: {
    tasks: TaskItem[];
    type: ModelTaskListType;
    loading: boolean;
    onPreviewImage: (url: string) => void;
}) => {
    if (loading && tasks.length === 0) {
        return <div className="flex min-h-64 items-center justify-center text-sm text-white/45">正在加载任务…</div>;
    }
    if (tasks.length === 0) {
        return <div className="flex min-h-64 flex-col items-center justify-center text-sm text-white/45">当前项目暂无{type === "image" ? "图片" : "视频"}模型任务</div>;
    }

    return (
        <div className="min-w-260 overflow-hidden rounded-2xl border border-white/10 bg-white/2.5">
            <div className="grid grid-cols-[130px_180px_minmax(260px,1fr)_180px_160px_120px_150px] border-b border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-medium text-white/48">
                <span>状态</span>
                <span>模型 / 服务商</span>
                <span>提示词</span>
                <span>参考图</span>
                <span>{type === "image" ? "结果图片" : "生成视频"}</span>
                <span>积分消耗</span>
                <span>创建时间</span>
            </div>
            {tasks.map((task) => (
                <div
                    key={task.id}
                    className="grid grid-cols-[130px_180px_minmax(260px,1fr)_180px_160px_120px_150px] items-center border-b border-white/6 px-4 py-3.5 text-sm last:border-b-0"
                >
                    <div className="space-y-1.5">
                        <TaskStatus status={task.status} />
                        {task.errorMessage ? <p className="line-clamp-1 text-xs text-red-300/80">{task.errorMessage}</p> : null}
                    </div>
                    <div className="min-w-0 pr-3">
                        <p className="truncate text-sm text-white/85">{task.model || "未标注模型"}</p>
                        <p className="mt-1 truncate text-xs text-white/42">{task.provider || "未知服务商"}</p>
                        {isImageTask(task) ? <p className="mt-1 text-xs text-violet-200/70">{TASK_TYPE_TEXT[task.taskType] || task.taskType}</p> : null}
                    </div>
                    <p className="line-clamp-2 pr-4 text-sm leading-5 text-white/65">{task.prompt || "-"}</p>
                    <ImageStrip urls={task.referenceImageUrls} onPreviewImage={onPreviewImage} />
                    {isImageTask(task) ? (
                        <ImageStrip urls={task.resultImageUrls} onPreviewImage={onPreviewImage} />
                    ) : (
                        <VideoResult url={task.generatedVideoUrl} />
                    )}
                    <span className="text-sm text-white/70">{task.score > 0 ? task.score : "-"}</span>
                    <span className="text-xs leading-5 text-white/48">{task.createTime || "-"}</span>
                </div>
            ))}
        </div>
    );
};

const TaskStatus = ({ status }: { status: string }) => {
    const key = status.toUpperCase();
    return (
        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs", STATUS_CLASS[key] || "border-white/10 bg-white/5 text-white/60")}>
            {STATUS_TEXT[key] || status || "未知"}
        </span>
    );
};

const ImageStrip = ({
    urls,
    onPreviewImage,
}: {
    urls: string[];
    onPreviewImage: (url: string) => void;
}) => {
    if (urls.length === 0) {
        return <span className="text-xs text-white/35">-</span>;
    }
    return (
        <div className="flex items-center gap-1.5">
            {urls.slice(0, 3).map((url) => (
                <button
                    key={url}
                    type="button"
                    className="h-10 w-10 overflow-hidden rounded-md border border-white/10 bg-white/5"
                    onClick={() => onPreviewImage(url)}
                >
                    <img src={url} alt="任务图片" className="size-full object-cover" loading="lazy" />
                </button>
            ))}
            {urls.length > 3 ? <span className="text-xs text-white/50">+{urls.length - 3}</span> : null}
        </div>
    );
};

const VideoResult = ({ url }: { url: string }) => {
    if (!url) {
        return <span className="text-xs text-white/35">-</span>;
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-violet-200/80">
            <IconVideo size={16} />
            已生成
        </span>
    );
};

export default ModelTaskListOverlay;