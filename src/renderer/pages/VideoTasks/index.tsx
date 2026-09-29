import { useEffect, useState, type FormEvent } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "shared/utils/utils";
import { getMyVideoTasks, type MyVideoTaskPage, type MyVideoTaskQuery } from "@/api/jikeGo";

const PAGE_SIZE = 20;
const STATUS_LABELS: Record<string, string> = {
    PENDING: "等待中",
    RUNNING: "处理中",
    PROCESSING: "处理中",
    SUCCESS: "成功",
    SUCCEEDED: "成功",
    COMPLETED: "成功",
    FAIL: "失败",
    FAILED: "失败",
};

const STATUS_TAG_CLASSES: Record<string, string> = {
    SUCCESS: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    SUCCEEDED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    COMPLETED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    FAIL: "border-red-400/30 bg-red-400/10 text-red-300",
    FAILED: "border-red-400/30 bg-red-400/10 text-red-300",
};

const TruncatedText = ({ value, className }: { value: string; className?: string }) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <span tabIndex={0} className={cn("block w-full truncate", className)}>{value || "-"}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-lg">
            <span className="block max-h-72 overflow-y-auto whitespace-pre-wrap wrap-break-word">{value || "-"}</span>
        </TooltipContent>
    </Tooltip>
);

const VideoTasksPage = () => {
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("");
    const [sortBy, setSortBy] = useState<NonNullable<MyVideoTaskQuery["sortBy"]>>("createTime");
    const [sortOrder, setSortOrder] = useState<NonNullable<MyVideoTaskQuery["sortOrder"]>>("desc");
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");
    const [videoId, setVideoId] = useState("");
    const [projectId, setProjectId] = useState("");
    const [filters, setFilters] = useState<Pick<MyVideoTaskQuery, "startTime" | "endTime" | "videoId" | "projectId">>({});
    const [filterError, setFilterError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [data, setData] = useState<MyVideoTaskPage>({ list: [], total: 0, totalDuration: 0, page: 1, pageSize: PAGE_SIZE });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        setData({ list: [], total: 0, totalDuration: 0, page, pageSize: PAGE_SIZE });
        getMyVideoTasks({ page, pageSize: PAGE_SIZE, status: status || undefined, sortBy, sortOrder, ...filters })
            .then((result) => {
                if (cancelled) return;
                if ((result.code !== 0 && result.code !== 200) || !result.data) {
                    throw new Error(result.msg || "加载任务失败");
                }
                setData(result.data);
            })
            .catch((reason: any) => {
                if (!cancelled) {
                    setError(reason?.message || "加载任务失败");
                    setData({ list: [], total: 0, totalDuration: 0, page, pageSize: PAGE_SIZE });
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [page, status, sortBy, sortOrder, filters, refresh]);

    const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    const selectClass = "h-10 rounded-lg border border-white/15 bg-[#17171d] px-3 text-sm text-white outline-none focus:border-white/40";
    const inputClass = "h-10 min-w-0 rounded-lg border border-white/15 bg-[#17171d] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40";
    const buttonClass = "rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

    const search = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const video = videoId.trim();
        const project = projectId.trim();
        if ((video && !/^[1-9]\d*$/.test(video)) || (project && !/^[1-9]\d*$/.test(project))) {
            setFilterError("视频 ID 和项目 ID 必须是正整数");
            return;
        }
        const startTime = startAt ? new Date(startAt).getTime() : undefined;
        const endTime = endAt ? new Date(endAt).getTime() + 59_999 : undefined;
        if ((startTime !== undefined && !Number.isFinite(startTime)) || (endTime !== undefined && !Number.isFinite(endTime))) {
            setFilterError("请输入有效的时间范围");
            return;
        }
        if (startTime !== undefined && endTime !== undefined && startTime > endTime) {
            setFilterError("开始时间不能晚于结束时间");
            return;
        }
        setFilterError("");
        setPage(1);
        setFilters({ videoId: video || undefined, projectId: project || undefined, startTime, endTime });
    };

    const reset = () => {
        setStartAt("");
        setEndAt("");
        setVideoId("");
        setProjectId("");
        setStatus("");
        setSortBy("createTime");
        setSortOrder("desc");
        setFilterError("");
        setPage(1);
        setFilters({});
    };

    return (
        <main className="min-h-full bg-[#0d0d12] p-6 text-white">
            <div className="flex w-full flex-col gap-6">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">视频模型任务列表</h1>
                        <p className="mt-2 text-sm text-white/50">共 {data.total} 条任务</p>
                    </div>
                    <button type="button" className={buttonClass} disabled={loading} onClick={() => setRefresh((value) => value + 1)}>刷新</button>
                </header>

                <form onSubmit={search} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/3 p-5">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex flex-col gap-2 text-sm text-white/65">
                            <span>创建时间范围</span>
                            <div className="flex flex-wrap items-center gap-2">
                                <input aria-label="开始时间" className={`${inputClass} scheme-dark`} type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
                                <span>至</span>
                                <input aria-label="结束时间" className={`${inputClass} scheme-dark`} type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
                            </div>
                        </div>
                        <label className="flex flex-col gap-2 text-sm text-white/65">视频 ID
                            <input className={inputClass} inputMode="numeric" placeholder="输入视频记录 ID" value={videoId} onChange={(event) => setVideoId(event.target.value)} />
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-white/65">项目 ID
                            <input className={inputClass} inputMode="numeric" placeholder="输入项目 ID" value={projectId} onChange={(event) => setProjectId(event.target.value)} />
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-white/65">状态
                            <select className={selectClass} value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
                                <option value="">全部</option><option value="PENDING">等待中</option><option value="RUNNING">处理中</option><option value="SUCCESS">成功</option><option value="FAIL">失败</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-white/65">排序字段
                            <select className={selectClass} value={sortBy} onChange={(event) => { setPage(1); setSortBy(event.target.value as NonNullable<MyVideoTaskQuery["sortBy"]>); }}>
                                <option value="createTime">创建时间</option><option value="score">积分消耗</option><option value="duration">视频时长</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm text-white/65">顺序
                            <select className={selectClass} value={sortOrder} onChange={(event) => { setPage(1); setSortOrder(event.target.value as NonNullable<MyVideoTaskQuery["sortOrder"]>); }}>
                                <option value="desc">降序</option><option value="asc">升序</option>
                            </select>
                        </label>
                        <button type="submit" className="h-10 rounded-lg bg-[#B43FEB] px-5 text-sm text-white hover:bg-[#9d32d0]">查询</button>
                        <button type="button" className={buttonClass} onClick={reset}>重置</button>
                        <span className="pb-2 text-sm text-white/60">总时长：{data.totalDuration} 秒</span>
                    </div>
                    {filterError ? <p className="text-sm text-red-300" role="alert">{filterError}</p> : null}
                </form>

                <TooltipProvider delayDuration={300}>
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/3">
                        <table className="w-full min-w-260 table-fixed border-collapse text-left text-sm">
                            <colgroup>
                                <col className="w-[18%]" /><col className="w-[14%]" /><col className="w-[16%]" /><col className="w-[10%]" />
                                <col className="w-[10%]" /><col className="w-[6%]" /><col className="w-[16%]" /><col className="w-[10%]" />
                            </colgroup>
                            <caption className="sr-only">我的视频生成任务</caption>
                            <thead className="border-b border-white/10 bg-white/5 text-xs text-white/55">
                                <tr>
                                    <th className="p-4 font-medium">视频 ID / 任务 ID</th>
                                    <th className="p-4 font-medium">项目 ID</th>
                                    <th className="p-4 font-medium">模型 / 服务商</th>
                                    <th className="p-4 font-medium">状态</th>
                                    <th className="p-4 font-medium">规格</th>
                                    <th className="p-4 font-medium">积分</th>
                                    <th className="p-4 font-medium">提示词</th>
                                    <th className="p-4 font-medium">创建时间</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/8">
                                {data.list.map((task) => (
                                    <tr key={task.id} className="h-20 hover:bg-white/3">
                                        <td className="px-4 py-3"><TruncatedText value={task.id} /><TruncatedText value={task.taskId} className="mt-1 text-xs text-white/45" /></td>
                                        <td className="px-4 py-3"><TruncatedText value={task.projectId === "0" ? "-" : task.projectId} /></td>
                                        <td className="px-4 py-3"><TruncatedText value={task.model || "未知模型"} /><TruncatedText value={[task.provider, task.modelVersion].filter(Boolean).join(" · ")} className="mt-1 text-xs text-white/45" /></td>
                                        <td className="px-4 py-3"><TruncatedText value={STATUS_LABELS[task.status.toUpperCase()] || task.status} className={cn("inline-block w-fit max-w-full rounded-full border border-white/15 px-2 py-1 text-xs", STATUS_TAG_CLASSES[task.status.toUpperCase()])} />{task.errorMessage ? <TruncatedText value={task.errorMessage} className="mt-1 text-xs text-red-300" /> : null}</td>
                                        <td className="px-4 py-3 text-xs text-white/65"><TruncatedText value={[task.resolution, task.ratio].filter(Boolean).join(" · ")} /><TruncatedText value={task.duration ? `${task.duration} 秒` : "-"} className="mt-1" /></td>
                                        <td className="p-4">{task.score ?? "-"}</td>
                                        <td className="px-4 py-3 text-white/75"><TruncatedText value={task.prompt} /></td>
                                        <td className="px-4 py-3 text-xs text-white/60"><TruncatedText value={task.createTime ? new Date(task.createTime).toLocaleString("zh-CN") : "-"} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {error ? <p className="p-10 text-center text-red-300" role="alert">{error}</p> : null}
                        {loading ? <p className="p-10 text-center text-white/50">正在加载任务…</p> : null}
                        {!loading && !error && data.list.length === 0 ? <p className="p-10 text-center text-white/50">暂无符合条件的视频任务</p> : null}
                    </div>
                </TooltipProvider>

                <footer className="flex items-center justify-between gap-4 text-sm text-white/60">
                    <span>共 {data.total} 条 · 第 {page} / {totalPages} 页</span>
                    <div className="flex gap-2">
                        <button type="button" className={buttonClass} disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
                        <button type="button" className={buttonClass} disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button>
                    </div>
                </footer>
            </div>
        </main>
    );
};

export default VideoTasksPage;
