/**
 * Agnes-Video-V2.0 接入 Demo 页面
 *
 * 演示通过 jike-go 桌面代理调用 https://apihub.agnes-ai.com 视频生成能力的完整闭环：
 * 1. 选择生成模式（文生 / 图生 / 多图 / 关键帧）并填入参数
 * 2. 调用 POST /desktop/v1/ai/generation/proxy 创建任务 + 预扣积分
 * 3. 轮询 POST /desktop/v1/ai/task/query 获取最终视频
 * 4. 完成时调用 /score/confirm，失败/超时调用 /score/refund
 */
import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Layers,
  Loader2,
  Sparkles,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AGNES_VIDEO_MODEL,
  AgnesCreateVideoRequest,
  AgnesCreateVideoResponse,
  AgnesQueryVideoResponse,
  AgnesVideoMode,
  confirmAgnesScore,
  createAgnesVideoTask,
  estimateAgnesScoreCost,
  estimateAgnesSeconds,
  queryAgnesVideoTask,
  refundAgnesScore,
} from "@/api/agnes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** 轮询间隔（ms）：参考接入指南建议 5s */
const POLL_INTERVAL_MS = 5000;
/** 单任务最长轮询时长，避免无限等待 */
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

/** 帧数预设：必须满足 8n + 1 且 ≤ 441 */
const FRAME_PRESETS: Array<{ label: string; numFrames: number }> = [
  { label: "约 3 秒", numFrames: 81 },
  { label: "约 5 秒", numFrames: 121 },
  { label: "约 10 秒", numFrames: 241 },
  { label: "约 18 秒", numFrames: 441 },
];

/** 分辨率预设（width x height） */
const RESOLUTION_PRESETS: Array<{
  label: string;
  width: number;
  height: number;
  ratio: string;
}> = [
  { label: "横屏 720p", width: 1152, height: 768, ratio: "16:9" },
  { label: "竖屏 720p", width: 768, height: 1152, ratio: "9:16" },
  { label: "方形 720p", width: 960, height: 960, ratio: "1:1" },
];

/** 模式可视化配置 */
const MODE_OPTIONS: Array<{
  value: AgnesVideoMode;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "text", label: "文生视频", desc: "纯文本生成", icon: Type },
  { value: "image", label: "图生视频", desc: "单张图片动画化", icon: ImageIcon },
  { value: "multi", label: "多图视频", desc: "多张参考图引导", icon: Layers },
  { value: "keyframes", label: "关键帧动画", desc: "图片之间过渡", icon: Sparkles },
];

type UiTaskStatus =
  | "idle"
  | "creating"
  | "polling"
  | "completed"
  | "failed"
  | "refunded";

type TaskRuntime = {
  /** 推荐使用的视频 ID */
  videoId: string;
  /** 兼容字段：上游任务 ID */
  taskId: string;
  /** 积分预扣凭证 */
  ledgerBizId?: string;
  /** 预计时长（秒） */
  seconds: string;
  /** 分辨率 */
  size: string;
};

export default function VideoPage() {
  // ============ 业务参数 ============
  const [mode, setMode] = useState<AgnesVideoMode>("text");
  const [prompt, setPrompt] = useState(
    "A cinematic shot of a cat walking on the beach at sunset, soft ocean waves, warm golden lighting, realistic motion",
  );
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [extraImageInput, setExtraImageInput] = useState("");
  const [resolutionIdx, setResolutionIdx] = useState(0);
  const [numFrames, setNumFrames] = useState(121);
  const [frameRate, setFrameRate] = useState(24);
  const [seed, setSeed] = useState<string>("");

  // ============ 任务状态 ============
  const [status, setStatus] = useState<UiTaskStatus>("idle");
  const [runtime, setRuntime] = useState<TaskRuntime | null>(null);
  const [queryResult, setQueryResult] = useState<AgnesQueryVideoResponse | null>(
    null,
  );
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  // 轮询控制
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartAtRef = useRef(0);

  const resolution = RESOLUTION_PRESETS[resolutionIdx];
  const seconds = estimateAgnesSeconds(numFrames, frameRate);
  const scoreCost = estimateAgnesScoreCost(seconds);

  const extraImages = useMemo(
    () =>
      extraImageInput
        .split(/\s|,|;|\n/)
        .map((url) => url.trim())
        .filter(Boolean),
    [extraImageInput],
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  // 表单校验
  const validateForm = useCallback((): string | null => {
    if (!prompt.trim()) return "请填写视频提示词 prompt";
    if (numFrames > 441) return "num_frames 必须 ≤ 441";
    if ((numFrames - 1) % 8 !== 0) return "num_frames 必须满足 8n + 1";
    if (frameRate < 1 || frameRate > 60) return "frame_rate 取值范围为 1-60";

    if (mode === "image" && !imageUrl.trim()) {
      return "图生视频模式需要填写图片 URL";
    }
    if (
      (mode === "multi" || mode === "keyframes") &&
      extraImages.length < 2
    ) {
      return "多图 / 关键帧模式至少需要 2 张图片 URL";
    }
    return null;
  }, [prompt, numFrames, frameRate, mode, imageUrl, extraImages]);

  // 重置状态
  const resetState = useCallback(() => {
    stopPolling();
    setStatus("idle");
    setRuntime(null);
    setQueryResult(null);
    setProgress(0);
    setErrorMsg("");
    setVideoUrl("");
  }, [stopPolling]);

  // 轮询 video 结果
  const pollOnce = useCallback(
    async (current: TaskRuntime) => {
      try {
        const result = await queryAgnesVideoTask(current.videoId);
        setQueryResult(result);
        if (typeof result.progress === "number") {
          setProgress(result.progress);
        }

        if (result.status === "completed") {
          stopPolling();
          const url = result.remixed_from_video_id || "";
          setVideoUrl(url);
          setStatus("completed");

          // 确认积分扣减
          if (current.ledgerBizId) {
            try {
              await confirmAgnesScore(current.ledgerBizId, current.taskId);
              toast.success("视频生成成功，积分已确认扣减");
            } catch (err: any) {
              toast.error(`积分确认失败：${err?.message || "未知错误"}`);
            }
          } else {
            toast.success("视频生成成功");
          }
          return;
        }

        if (result.status === "failed") {
          stopPolling();
          const reason =
            result.error?.message ||
            (typeof result.error === "string" ? result.error : "") ||
            "上游任务失败";
          setErrorMsg(reason);
          setStatus("failed");

          if (current.ledgerBizId) {
            try {
              await refundAgnesScore(
                current.ledgerBizId,
                reason,
                current.taskId,
              );
              setStatus("refunded");
              toast.error(`生成失败，已退还积分：${reason}`);
            } catch (err: any) {
              toast.error(`生成失败，退款异常：${err?.message || "未知错误"}`);
            }
          } else {
            toast.error(`生成失败：${reason}`);
          }
          return;
        }

        // 超时退款
        if (Date.now() - pollStartAtRef.current > POLL_TIMEOUT_MS) {
          stopPolling();
          const reason = "轮询超时";
          setErrorMsg(reason);
          setStatus("failed");
          if (current.ledgerBizId) {
            try {
              await refundAgnesScore(
                current.ledgerBizId,
                reason,
                current.taskId,
              );
              setStatus("refunded");
              toast.error("轮询超时，已退还积分");
            } catch (err: any) {
              toast.error(`轮询超时，退款异常：${err?.message || "未知错误"}`);
            }
          }
          return;
        }

        // 继续轮询
        pollTimerRef.current = setTimeout(
          () => pollOnce(current),
          POLL_INTERVAL_MS,
        );
      } catch (err: any) {
        stopPolling();
        const reason = err?.message || "查询任务失败";
        setErrorMsg(reason);
        setStatus("failed");
        toast.error(`查询任务失败：${reason}`);
      }
    },
    [stopPolling],
  );

  // 创建任务
  const handleCreate = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    resetState();
    setStatus("creating");

    const req: AgnesCreateVideoRequest = {
      prompt: prompt.trim(),
      negative_prompt: negativePrompt.trim() || undefined,
      width: resolution.width,
      height: resolution.height,
      num_frames: numFrames,
      frame_rate: frameRate,
      seed: seed.trim() ? Number(seed.trim()) : undefined,
      mode,
    };

    if (mode === "image") req.image = imageUrl.trim();
    if (mode === "multi" || mode === "keyframes") req.extra_images = extraImages;

    try {
      const resp: AgnesCreateVideoResponse = await createAgnesVideoTask(
        req,
        scoreCost,
      );
      const current: TaskRuntime = {
        videoId: resp.video_id || resp.id,
        taskId: resp.task_id || resp.id,
        ledgerBizId: resp.ledgerBizId,
        seconds: resp.seconds || `${seconds}`,
        size: resp.size || `${resolution.width}x${resolution.height}`,
      };
      setRuntime(current);
      setStatus("polling");
      setProgress(resp.progress || 0);
      pollStartAtRef.current = Date.now();
      toast.success(`任务已创建，video_id=${current.videoId}`);

      // 启动轮询
      pollTimerRef.current = setTimeout(
        () => pollOnce(current),
        POLL_INTERVAL_MS,
      );
    } catch (err: any) {
      const reason = err?.message || "创建任务失败";
      setErrorMsg(reason);
      setStatus("failed");
      toast.error(reason);
    }
  }, [
    validateForm,
    resetState,
    prompt,
    negativePrompt,
    resolution,
    numFrames,
    frameRate,
    seed,
    mode,
    imageUrl,
    extraImages,
    scoreCost,
    seconds,
    pollOnce,
  ]);

  const isBusy = status === "creating" || status === "polling";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* 顶部标题区 */}
      <header className="border-b border-white/5 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-[#B43FEB] to-[#5C2EBE]">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Agnes-Video-V2.0 接入 Demo</h1>
            <p className="text-xs text-white/50">
              模型：{AGNES_VIDEO_MODEL} · 通过桌面代理调用 apihub.agnes-ai.com
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 px-8 py-6 lg:grid-cols-[420px_1fr]">
        {/* 左侧：参数表单 */}
        <section className="space-y-5 rounded-2xl border border-white/5 bg-white/2 p-5">
          {/* 模式选择 */}
          <div>
            <div className="mb-2 text-xs text-white/60">生成模式</div>
            <div className="grid grid-cols-2 gap-2">
              {MODE_OPTIONS.map(({ value, label, desc, icon: Icon }) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setMode(value)}
                    className={[
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-[#B43FEB] bg-[#B43FEB]/10"
                        : "border-white/10 bg-white/2 hover:border-white/20",
                      isBusy ? "cursor-not-allowed opacity-60" : "",
                    ].join(" ")}
                  >
                    <Icon className="size-4 text-white/80" />
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-[10px] text-white/45">{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-white/60">提示词 (prompt)</span>
              <span className="text-white/30">{prompt.length}</span>
            </div>
            <Textarea
              rows={4}
              disabled={isBusy}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述主体、动作、场景、镜头、光照与风格..."
            />
          </div>

          {/* Negative Prompt */}
          <div>
            <div className="mb-2 text-xs text-white/60">
              负向提示词 (negative_prompt) · 可选
            </div>
            <Input
              disabled={isBusy}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="例：blurry, low quality, distorted face"
            />
          </div>

          {/* 图片输入 */}
          {mode === "image" && (
            <div>
              <div className="mb-2 text-xs text-white/60">参考图片 URL</div>
              <Input
                disabled={isBusy}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
              />
            </div>
          )}
          {(mode === "multi" || mode === "keyframes") && (
            <div>
              <div className="mb-2 text-xs text-white/60">
                {mode === "keyframes" ? "关键帧 URL" : "参考图片 URL"}（每行一个）
              </div>
              <Textarea
                rows={3}
                disabled={isBusy}
                value={extraImageInput}
                onChange={(e) => setExtraImageInput(e.target.value)}
                placeholder={"https://example.com/img1.png\nhttps://example.com/img2.png"}
              />
              <div className="mt-1 text-[10px] text-white/40">
                已识别 {extraImages.length} 张图片
              </div>
            </div>
          )}

          {/* 分辨率 */}
          <div>
            <div className="mb-2 text-xs text-white/60">分辨率</div>
            <div className="flex flex-wrap gap-2">
              {RESOLUTION_PRESETS.map((preset, idx) => {
                const active = idx === resolutionIdx;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setResolutionIdx(idx)}
                    className={[
                      "rounded-md border px-3 py-1.5 text-xs transition-colors",
                      active
                        ? "border-[#B43FEB] bg-[#B43FEB]/10 text-white"
                        : "border-white/10 bg-white/2 text-white/60 hover:border-white/20",
                      isBusy ? "cursor-not-allowed opacity-60" : "",
                    ].join(" ")}
                  >
                    {preset.label} · {preset.ratio}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 text-[10px] text-white/40">
              {resolution.width} × {resolution.height}
            </div>
          </div>

          {/* 帧数预设 */}
          <div>
            <div className="mb-2 text-xs text-white/60">时长（num_frames）</div>
            <div className="flex flex-wrap gap-2">
              {FRAME_PRESETS.map((preset) => {
                const active = numFrames === preset.numFrames;
                return (
                  <button
                    key={preset.numFrames}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setNumFrames(preset.numFrames)}
                    className={[
                      "rounded-md border px-3 py-1.5 text-xs transition-colors",
                      active
                        ? "border-[#B43FEB] bg-[#B43FEB]/10 text-white"
                        : "border-white/10 bg-white/2 text-white/60 hover:border-white/20",
                      isBusy ? "cursor-not-allowed opacity-60" : "",
                    ].join(" ")}
                  >
                    {preset.label} · {preset.numFrames} 帧
                  </button>
                );
              })}
            </div>
          </div>

          {/* 帧率 / 种子 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-2 text-xs text-white/60">frame_rate</div>
              <Input
                type="number"
                min={1}
                max={60}
                disabled={isBusy}
                value={frameRate}
                onChange={(e) => setFrameRate(Number(e.target.value) || 24)}
              />
            </div>
            <div>
              <div className="mb-2 text-xs text-white/60">seed · 可选</div>
              <Input
                disabled={isBusy}
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="留空使用随机种子"
              />
            </div>
          </div>

          {/* 计费提示 */}
          <div className="rounded-lg border border-white/5 bg-white/2 p-3 text-xs leading-relaxed">
            <div className="flex justify-between text-white/60">
              <span>预计时长</span>
              <span className="text-white">{seconds.toFixed(1)} 秒</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>预扣积分</span>
              <span className="text-[#B43FEB]">{scoreCost} 分</span>
            </div>
            <div className="mt-1 text-[10px] text-white/35">
              任务完成后扣减确认；失败 / 超时自动退款。
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex gap-2">
            <Button
              variant="blue"
              className="flex-1"
              disabled={isBusy}
              onClick={handleCreate}
            >
              {isBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {status === "creating" ? "提交中..." : "生成中..."}
                </>
              ) : (
                "开始生成"
              )}
            </Button>
            <Button
              variant="ghost"
              disabled={isBusy || status === "idle"}
              onClick={resetState}
            >
              重置
            </Button>
          </div>
        </section>

        {/* 右侧：结果展示 */}
        <section className="space-y-4">
          <ResultPanel
            status={status}
            runtime={runtime}
            progress={progress}
            queryResult={queryResult}
            videoUrl={videoUrl}
            errorMsg={errorMsg}
          />

          {/* 原始响应 JSON */}
          {queryResult && (
            <details className="rounded-2xl border border-white/5 bg-white/2 p-4 text-xs">
              <summary className="cursor-pointer text-white/60">
                查看上游原始响应
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-black/40 p-3 text-[11px] text-white/80">
                {JSON.stringify(queryResult, null, 2)}
              </pre>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

type ResultPanelProps = {
  status: UiTaskStatus;
  runtime: TaskRuntime | null;
  progress: number;
  queryResult: AgnesQueryVideoResponse | null;
  videoUrl: string;
  errorMsg: string;
};

function ResultPanel({
  status,
  runtime,
  progress,
  queryResult,
  videoUrl,
  errorMsg,
}: ResultPanelProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/2 p-5">
      {/* 状态条 */}
      <StatusBar status={status} progress={progress} />

      {/* 任务信息 */}
      {runtime && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Info label="video_id" value={runtime.videoId} mono />
          <Info label="task_id" value={runtime.taskId} mono />
          <Info label="预计时长" value={`${runtime.seconds} s`} />
          <Info label="分辨率" value={runtime.size} />
          {runtime.ledgerBizId && (
            <Info
              label="ledgerBizId"
              value={runtime.ledgerBizId}
              mono
              full
            />
          )}
          {queryResult?.status && (
            <Info label="上游状态" value={queryResult.status} />
          )}
        </div>
      )}

      {/* 视频播放 */}
      <div className="mt-5 aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <EmptyVideoPlaceholder status={status} errorMsg={errorMsg} />
        )}
      </div>

      {/* 视频地址 */}
      {videoUrl && (
        <div className="mt-3 break-all rounded-md bg-black/40 p-3 text-[11px] text-white/70">
          {videoUrl}
        </div>
      )}
    </div>
  );
}

function StatusBar({
  status,
  progress,
}: {
  status: UiTaskStatus;
  progress: number;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <Icon
          className={`size-4 ${config.iconClass} ${
            status === "creating" || status === "polling"
              ? "animate-spin"
              : ""
          }`}
        />
        <span className={config.textClass}>{config.label}</span>
        {(status === "polling" || status === "completed") && (
          <span className="ml-auto text-xs text-white/45">{progress}%</span>
        )}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full transition-all ${config.barClass}`}
          style={{
            width: `${
              status === "completed"
                ? 100
                : status === "polling"
                  ? Math.max(progress, 4)
                  : status === "creating"
                    ? 8
                    : 0
            }%`,
          }}
        />
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<
  UiTaskStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    textClass: string;
    barClass: string;
  }
> = {
  idle: {
    label: "等待提交",
    icon: Sparkles,
    iconClass: "text-white/50",
    textClass: "text-white/60",
    barClass: "bg-white/10",
  },
  creating: {
    label: "正在创建任务...",
    icon: Loader2,
    iconClass: "text-[#B43FEB]",
    textClass: "text-white",
    barClass: "bg-[#B43FEB]",
  },
  polling: {
    label: "上游生成中...",
    icon: Loader2,
    iconClass: "text-[#B43FEB]",
    textClass: "text-white",
    barClass: "bg-[#B43FEB]",
  },
  completed: {
    label: "已完成",
    icon: CheckCircle2,
    iconClass: "text-emerald-400",
    textClass: "text-emerald-400",
    barClass: "bg-emerald-400",
  },
  failed: {
    label: "生成失败",
    icon: AlertCircle,
    iconClass: "text-red-400",
    textClass: "text-red-400",
    barClass: "bg-red-400",
  },
  refunded: {
    label: "已退还积分",
    icon: AlertCircle,
    iconClass: "text-amber-400",
    textClass: "text-amber-400",
    barClass: "bg-amber-400",
  },
};

function Info({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-white/5 bg-black/20 p-2.5 ${
        full ? "col-span-2" : ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div
        className={`mt-1 break-all text-white/85 ${
          mono ? "font-mono text-[11px]" : "text-xs"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyVideoPlaceholder({
  status,
  errorMsg,
}: {
  status: UiTaskStatus;
  errorMsg: string;
}) {
  if (status === "failed" || status === "refunded") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <AlertCircle className="size-8 text-red-400/80" />
        <div className="text-sm text-red-400">生成失败</div>
        <div className="max-w-md text-xs text-white/50">
          {errorMsg || "未知错误"}
        </div>
      </div>
    );
  }
  if (status === "polling" || status === "creating") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-white/60">
        <Loader2 className="size-8 animate-spin text-[#B43FEB]" />
        <div className="text-sm">视频生成中，请稍候</div>
        <div className="text-[11px] text-white/35">
          每 5 秒自动查询一次任务状态
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-white/40">
      <Sparkles className="size-8" />
      <div className="text-sm">尚未生成视频</div>
      <div className="text-[11px] text-white/30">
        在左侧填写参数后点击「开始生成」
      </div>
    </div>
  );
}
