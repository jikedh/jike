import { IconBolt } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { cn } from "shared/utils/utils";
import type {
  VideoEnhanceResolution,
  VideoEnhanceScene,
  VideoEnhanceToolVersion,
} from "@/api/jikeGo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type VideoEnhanceParams = {
  scene: VideoEnhanceScene | undefined;
  tool_version: VideoEnhanceToolVersion;
  resolution: VideoEnhanceResolution | undefined;
  fps: number | undefined;
};

// Radix SelectItem 不允许空字符串，使用占位值替代
const SCENE_AUTO = "__auto__";
const RESOLUTION_DEFAULT = "__default__";

const SCENE_OPTIONS: { value: string; label: string }[] = [
  { value: SCENE_AUTO, label: "自动判定" },
  { value: "aigc", label: "aigc - AI 生成视频超分" },
  { value: "short_series", label: "short_series - 短剧增强" },
  { value: "ugc", label: "ugc - UGC 失真修复" },
  { value: "old_film", label: "old_film - 老片修复" },
];

const TOOL_VERSION_OPTIONS: {
  value: VideoEnhanceToolVersion;
  label: string;
}[] = [
    { value: "standard", label: "standard - 性价比优先" },
    { value: "professional", label: "professional - 效果优先" },
  ];

const RESOLUTION_OPTIONS: {
  value: string;
  label: string;
}[] = [
    { value: RESOLUTION_DEFAULT, label: "与源视频一致" },
    { value: "720p", label: "720p" },
    { value: "1080p", label: "1080p" },
    { value: "2k", label: "2k" },
    { value: "4k", label: "4k" },
  ];

type VideoEnhancePanelProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (params: VideoEnhanceParams) => void;
  isSubmitting?: boolean;
};

export const VideoEnhancePanel = ({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
}: VideoEnhancePanelProps) => {
  const [scene, setScene] = useState<string>(SCENE_AUTO);
  const [toolVersion, setToolVersion] =
    useState<VideoEnhanceToolVersion>("standard");
  const [resolution, setResolution] = useState<string>(RESOLUTION_DEFAULT);
  const [fps, setFps] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(() => {
    const next: Record<string, string> = {};

    if (fps) {
      const n = Number(fps);
      if (Number.isNaN(n) || n <= 0) {
        next.fps = "请输入正数";
      } else if (n < 1 || n > 120) {
        next.fps = "范围 1 ~ 120";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [fps]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;

    onSubmit({
      scene: scene === SCENE_AUTO ? undefined : (scene as VideoEnhanceScene),
      tool_version: toolVersion,
      resolution: resolution === RESOLUTION_DEFAULT ? undefined : (resolution as VideoEnhanceResolution),
      fps: fps ? Number(fps) : undefined,
    });

    // 重置表单
    setScene(SCENE_AUTO);
    setToolVersion("standard");
    setResolution(RESOLUTION_DEFAULT);
    setFps("");
    setErrors({});
  }, [scene, toolVersion, resolution, fps, validate, onSubmit]);

  const handleClose = useCallback(() => {
    setErrors({});
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="nodrag nopan nowheel flex max-h-[92vh] w-110 max-w-[92vw] flex-col overflow-hidden border border-white/10 bg-[#121214] p-0 text-white">
        <DialogHeader className="shrink-0 border-b border-white/5 bg-[#18181b] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-white">
            <IconBolt size={18} className="text-[#B43FEB]" />
            视频超清 — 参数设置
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 bg-[#18181b] p-5">
          {/* 场景预设 */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">
              场景预设 <span className="text-white/30">(scene)</span>
            </label>
            <Select
              value={scene}
              onValueChange={(v) => setScene(v)}
            >
              <SelectTrigger className="h-10 border-white/10 bg-white/5 text-white hover:bg-white/10">
                <SelectValue placeholder="自动判定" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#1e1e22] text-white">
                {SCENE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-white/30">
              选择场景预设可针对特定类型视频优化增强效果
            </p>
          </div>

          {/* 工具版本 */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">
              工具版本 <span className="text-white/30">(tool_version)</span>
            </label>
            <Select
              value={toolVersion}
              onValueChange={(v) =>
                setToolVersion(v as VideoEnhanceToolVersion)
              }
            >
              <SelectTrigger className="h-10 border-white/10 bg-white/5 text-white hover:bg-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#1e1e22] text-white">
                {TOOL_VERSION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 输出分辨率 */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">
              输出分辨率 <span className="text-white/30">(resolution)</span>
            </label>
            <Select
              value={resolution}
              onValueChange={(v) => setResolution(v)}
            >
              <SelectTrigger className="h-10 border-white/10 bg-white/5 text-white hover:bg-white/10">
                <SelectValue placeholder="与源视频一致" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#1e1e22] text-white">
                {RESOLUTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 输出帧率 */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">
              输出帧率{" "}
              <span className="text-white/30">(fps) [1 ~ 120]</span>
            </label>
            <input
              type="number"
              value={fps}
              onChange={(e) => {
                setFps(e.target.value);
                if (e.target.value && errors.fps) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.fps;
                    return next;
                  });
                }
              }}
              placeholder="输出帧率，最高 120。高于源视频时触发智能插帧"
              className={cn(
                "w-full h-10 rounded-lg border bg-white/5 px-3 text-sm text-white placeholder:text-white/25",
                "focus:outline-none focus:border-[#B43FEB]/50 focus:ring-1 focus:ring-[#B43FEB]/30",
                errors.fps ? "border-red-500/50" : "border-white/10",
              )}
            />
            {errors.fps && (
              <p className="text-[11px] text-red-400">{errors.fps}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-white/5 bg-[#18181b] px-5 py-4">
          <Button
            variant="default"
            onClick={handleClose}
            className="border border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="min-w-32 border border-[#f3d5ff]/50 bg-[#B43FEB] font-semibold text-white shadow-[0_12px_34px_rgba(180,63,235,0.44)] ring-1 ring-[#f0c7ff]/25 hover:bg-[#C45BF0] hover:shadow-[0_16px_40px_rgba(180,63,235,0.52)]"
          >
            {isSubmitting ? "提交中..." : "发起超清任务"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
