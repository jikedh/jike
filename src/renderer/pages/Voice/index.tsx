import { useCallback, useState } from "react";
import type {
  CreateVideoEnhanceTaskRequest,
  VideoEnhanceResolution,
  VideoEnhanceScene,
  VideoEnhanceTaskResponse,
  VideoEnhanceToolVersion,
} from "@/api/jikeGo";
import { createVideoEnhanceTask, queryVideoEnhanceTask } from "@/api/jikeGo";
import { aiVideoEnhanceTrackingService } from "@/services/aiVideoEnhanceTracking";

type TaskResult = VideoEnhanceTaskResponse & { ok?: boolean; msg?: string };

export default function VoicePage() {
  // 画质增强 - 创建任务
  const [videoUrl, setVideoUrl] = useState("");
  const [scene, setScene] = useState<VideoEnhanceScene | "">("");
  const [toolVersion, setToolVersion] =
    useState<VideoEnhanceToolVersion>("standard");
  const [resolution, setResolution] = useState<VideoEnhanceResolution | "">("");
  const [resolutionLimit, setResolutionLimit] = useState("");
  const [fps, setFps] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<TaskResult | null>(null);

  // 画质增强 - 查询任务
  const [queryTaskId, setQueryTaskId] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<TaskResult | null>(null);

  // 轮询定时器
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const handleCreate = useCallback(async () => {
    if (!videoUrl.trim()) {
      setCreateResult({
        ok: false,
        msg: "请输入视频 URL",
        status: "running",
      } as TaskResult);
      return;
    }

    setCreateLoading(true);
    setCreateResult(null);
    try {
      const body: CreateVideoEnhanceTaskRequest = {
        video_url: videoUrl.trim(),
      };
      if (scene) body.scene = scene;
      body.tool_version = toolVersion;
      if (resolution) body.resolution = resolution;
      if (resolutionLimit) {
        const n = Number(resolutionLimit);
        if (!Number.isNaN(n)) body.resolution_limit = n;
      }
      if (fps) {
        const n = Number(fps);
        if (!Number.isNaN(n)) body.fps = n;
      }

      const res = await createVideoEnhanceTask(body);
      const taskId = res?.data?.task_id || res?.task_id || "";
      setCreateResult({
        ok: true,
        task_id: taskId,
        ...res?.data,
        msg: "任务创建成功",
      } as TaskResult);

      // 埋点：创建任务
      if (taskId) {
        aiVideoEnhanceTrackingService.track(
          aiVideoEnhanceTrackingService.buildTrackDataFromCreateRequest(
            taskId,
            taskId,
            body,
          ),
        );
      }
    } catch (e: any) {
      const errorMsg = e?.message || "请求失败";
      setCreateResult({
        ok: false,
        msg: errorMsg,
        status: "failed",
      } as TaskResult);

      // 埋点：创建失败
      aiVideoEnhanceTrackingService.track({
        apiName: "/v1/ai/video-enhance/create-task",
        model: toolVersion || "standard",
        taskId: "unknown",
        videoUrl: videoUrl.trim(),
        scene: scene || undefined,
        toolVersion,
        targetResolution: resolution || undefined,
        requestParams: {
          video_url: videoUrl.trim(),
          scene: scene || undefined,
          tool_version: toolVersion,
          resolution: resolution || undefined,
        },
        provider: "video_enhance",
        status: "FAIL",
        errorMessage: errorMsg,
      });
    } finally {
      setCreateLoading(false);
    }
  }, [videoUrl, scene, toolVersion, resolution, resolutionLimit, fps]);

  const handleQuery = useCallback(async () => {
    if (!queryTaskId.trim()) {
      setQueryResult({
        ok: false,
        msg: "请输入任务 ID",
        status: "running",
      } as TaskResult);
      return;
    }

    setQueryLoading(true);
    setQueryResult(null);
    try {
      const res = await queryVideoEnhanceTask({ task_id: queryTaskId.trim() });
      const data = res?.data ?? res;
      setQueryResult({ ok: true, ...data, msg: "" } as TaskResult);

      // 埋点：终态时更新状态
      if (data?.status === "succeeded" || data?.status === "failed") {
        const statusUpdate =
          aiVideoEnhanceTrackingService.buildStatusUpdateFromQueryResponse(
            queryTaskId.trim(),
            { task_id: queryTaskId.trim(), ...data },
          );
        aiVideoEnhanceTrackingService.updateStatus(
          queryTaskId.trim(),
          statusUpdate.status,
          statusUpdate.result,
        );
      }
    } catch (e: any) {
      const errorMsg = e?.message || "请求失败";
      setQueryResult({
        ok: false,
        msg: errorMsg,
        status: "failed",
      } as TaskResult);

      // 埋点：查询异常
      aiVideoEnhanceTrackingService.updateStatus(queryTaskId.trim(), "FAIL", {
        errorMessage: errorMsg,
      });
    } finally {
      setQueryLoading(false);
    }
  }, [queryTaskId]);

  // 开始轮询查询
  const startPolling = useCallback(() => {
    if (!queryTaskId.trim()) return;

    // 清除已有定时器
    if (pollInterval) clearInterval(pollInterval);

    setPollingTaskId(queryTaskId.trim());

    const timer = setInterval(async () => {
      try {
        const res = await queryVideoEnhanceTask({
          task_id: queryTaskId.trim(),
        });
        const data = res?.data ?? res;
        setQueryResult({ ok: true, ...data, msg: "" } as TaskResult);

        if (data?.status === "succeeded" || data?.status === "failed") {
          clearInterval(timer);
          setPollingTaskId(null);
          setPollInterval(null);

          // 埋点：轮询到终态
          const statusUpdate =
            aiVideoEnhanceTrackingService.buildStatusUpdateFromQueryResponse(
              queryTaskId.trim(),
              { task_id: queryTaskId.trim(), ...data },
            );
          aiVideoEnhanceTrackingService.updateStatus(
            queryTaskId.trim(),
            statusUpdate.status,
            statusUpdate.result,
          );
        }
      } catch (_e: any) {
        // 轮询中静默处理错误
      }
    }, 10000); // 每 10 秒轮询

    setPollInterval(timer);
  }, [queryTaskId, pollInterval]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
      setPollingTaskId(null);
    }
  }, [pollInterval]);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      running: "⏳ 运行中",
      succeeded: "✅ 已完成",
      failed: "❌ 失败",
    };
    return map[status] || status;
  };

  const statusColor = (status: string) => {
    if (status === "succeeded") return "text-green-400";
    if (status === "failed") return "text-red-400";
    return "text-yellow-400";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-10 space-y-8">
      {/* 发起画质增强任务 */}
      {/* <div className="p-6 rounded-lg bg-white/5 border border-white/10 max-w-2xl space-y-4">
        <h2 className="text-lg font-semibold">发起画质增强任务</h2>
        <p className="text-xs text-white/40">
          POST /v1/ai/video-enhance/create-task
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-white/60">视频 URL *</span>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm
                         focus:outline-none focus:border-blue-500 placeholder:text-white/30"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-white/60">场景预设 (scene)</span>
              <select
                value={scene}
                onChange={(e) =>
                  setScene(e.target.value as VideoEnhanceScene | "")
                }
                className="mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm
                           focus:outline-none focus:border-blue-500"
              >
                <option value="">自动判定</option>
                <option value="aigc">aigc - AI生成视频超分</option>
                <option value="short_series">short_series - 短剧增强</option>
                <option value="ugc">ugc - UGC失真修复</option>
                <option value="old_film">old_film - 老片修复</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-white/60">
                工具版本 (tool_version)
              </span>
              <select
                value={toolVersion}
                onChange={(e) =>
                  setToolVersion(e.target.value as VideoEnhanceToolVersion)
                }
                className="mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm
                           focus:outline-none focus:border-blue-500"
              >
                <option value="standard">standard - 性价比优先</option>
                <option value="professional">professional - 效果优先</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-white/60">
                输出分辨率 (resolution)
              </span>
              <select
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as VideoEnhanceResolution | "")
                }
                className="mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm
                           focus:outline-none focus:border-blue-500"
              >
                <option value="">与源视频一致</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="2k">2k</option>
                <option value="4k">4k</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-white/60">
                短边像素 (resolution_limit){" "}
                <span className="text-white/30">[64-2160]</span>
              </span>
              <input
                type="number"
                value={resolutionLimit}
                onChange={(e) => setResolutionLimit(e.target.value)}
                placeholder="与 resolution 互斥"
                className="mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm
                           focus:outline-none focus:border-blue-500 placeholder:text-white/30"
              />
            </label>

            <label className="block">
              <span className="text-sm text-white/60">
                输出帧率 (fps) <span className="text-white/30">[1-120]</span>
              </span>
              <input
                type="number"
                value={fps}
                onChange={(e) => setFps(e.target.value)}
                placeholder="与源视频一致"
                className="mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm
                           focus:outline-none focus:border-blue-500 placeholder:text-white/30"
              />
            </label>
          </div>

          <button
            onClick={handleCreate}
            disabled={createLoading}
            className="w-full py-2.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium
                       transition-colors"
          >
            {createLoading ? "提交中..." : "发起画质增强任务"}
          </button>
        </div>

        {createResult && (
          <div
            className={`p-3 rounded text-sm space-y-1 ${createResult.ok
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
          >
            {createResult.ok ? (
              <>
                <p>任务创建成功！</p>
                <p className="font-mono text-xs">
                  task_id: {createResult.task_id}
                </p>
              </>
            ) : (
              <p>{createResult.msg}</p>
            )}
          </div>
        )}
      </div> */}

      {/* 查询画质增强任务状态 */}
      {/* <div className="p-6 rounded-lg bg-white/5 border border-white/10 max-w-2xl space-y-4">
        <h2 className="text-lg font-semibold">查询画质增强任务状态</h2>
        <p className="text-xs text-white/40">
          POST /v1/ai/video-enhance/query-task
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={queryTaskId}
            onChange={(e) => setQueryTaskId(e.target.value)}
            placeholder="输入任务 task_id"
            className="flex-1 px-3 py-2 rounded bg-white/10 border border-white/20 text-white text-sm
                       focus:outline-none focus:border-blue-500 placeholder:text-white/30"
          />
          <button
            onClick={handleQuery}
            disabled={queryLoading}
            className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm
                       transition-colors whitespace-nowrap"
          >
            {queryLoading ? "查询中..." : "查询"}
          </button>
        </div>

        <div className="flex gap-2">
          {!pollingTaskId ? (
            <button
              onClick={startPolling}
              disabled={!queryTaskId.trim()}
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs
                         transition-colors"
            >
              开始轮询 (10s)
            </button>
          ) : (
            <button
              onClick={stopPolling}
              className="px-4 py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-xs
                         transition-colors"
            >
              停止轮询
            </button>
          )}
          {pollingTaskId && (
            <span className="text-xs text-yellow-400 self-center">
              正在轮询任务: {pollingTaskId}
            </span>
          )}
        </div>

        {queryResult && (
          <div className="p-3 rounded bg-white/5 border border-white/10 text-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-white/60">状态:</span>
              <span className={statusColor(queryResult.status)}>
                {statusLabel(queryResult.status)}
              </span>
            </div>
            <p className="text-white/60">
              task_id:{" "}
              <span className="font-mono text-white/80">
                {queryResult.task_id}
              </span>
            </p>
            {queryResult.video_url && (
              <p className="text-white/60 break-all">
                输出视频:{" "}
                <a
                  href={queryResult.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 underline"
                >
                  {queryResult.video_url}
                </a>
              </p>
            )}
            {queryResult.error && (
              <p className="text-red-400">错误: {queryResult.error}</p>
            )}
            {queryResult.duration_ms != null && (
              <p className="text-white/60">
                时长: {(queryResult.duration_ms / 1000).toFixed(1)}s
              </p>
            )}
            {queryResult.output_resolution && (
              <p className="text-white/60">
                输出分辨率: {queryResult.output_resolution}
              </p>
            )}
            {queryResult.output_fps != null && (
              <p className="text-white/60">
                输出帧率: {queryResult.output_fps} fps
              </p>
            )}
            {queryResult.tool_version && (
              <p className="text-white/60">
                工具版本: {queryResult.tool_version}
              </p>
            )}
            {queryResult.msg && (
              <p className="text-red-400">{queryResult.msg}</p>
            )}
          </div>
        )}
      </div> */}

      {/* <div className="text-xs text-white/20">
        接口文档:{" "}
        <a
          href="https://aiopenapi.kuaizi.cn"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-white/40"
        >
          aiopenapi.kuaizi.cn
        </a>
      </div> */}
    </div>
  );
}
