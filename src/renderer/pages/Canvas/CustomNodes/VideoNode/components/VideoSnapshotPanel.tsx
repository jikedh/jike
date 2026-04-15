import { IconPlayerSkipBack, IconVideo } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 视频截帧面板属性
 */
export interface VideoSnapshotPanelProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 视频 URL */
  videoUrl: string;
  /** 截帧回调 (时间点，毫秒) */
  onSnapshot: (timeMs: number) => void;
  /** 首帧回调 */
  onFirstFrame: () => void;
  /** 是否正在截帧 */
  isCapturing?: boolean;
  /** 视频总时长（秒） */
  duration?: number;
}

/**
 * 视频截帧面板组件
 * 提供首帧提取和时间点输入，支持毫秒和秒两种单位
 */
export const VideoSnapshotPanel = ({
  open,
  onClose,
  videoUrl,
  onSnapshot,
  onFirstFrame,
  isCapturing = false,
  duration,
}: VideoSnapshotPanelProps) => {
  const [timeInput, setTimeInput] = useState("");
  const [unit, setUnit] = useState<"s" | "ms">("s");

  const handleSubmit = () => {
    const value = parseFloat(timeInput);
    if (isNaN(value) || value < 0) {
      toast.error("请输入有效的时间值");
      return;
    }

    // 转换为毫秒
    const timeMs = unit === "s" ? Math.round(value * 1000) : Math.round(value);

    // 如果有视频时长限制，进行校验
    if (duration && timeMs > duration * 1000) {
      toast.error(`时间点不能超过视频时长 ${duration} 秒`);
      return;
    }

    onSnapshot(timeMs);
    setTimeInput("");
    onClose();
  };

  const handleUseFirstFrame = () => {
    onFirstFrame();
    setTimeInput("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-100 bg-neutral-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <IconVideo size={18} />
            截取视频帧
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 首帧按钮 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              首帧
            </label>
            <Button
              variant="default"
              className="w-full justify-start gap-2"
              onClick={handleUseFirstFrame}
              disabled={isCapturing}
            >
              <IconPlayerSkipBack size={16} />
              提取视频第一帧
            </Button>
            <p className="text-xs text-muted-foreground">
              自动提取视频的第一帧作为图片
            </p>
          </div>

          {/* 分隔线 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                或指定时间点
              </span>
            </div>
          </div>

          {/* 时间点输入 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              指定时间点
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                step={0.1}
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder={unit === "s" ? "例如: 5" : "例如: 5000"}
                disabled={isCapturing}
              />
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as "s" | "ms")}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="s">秒 (s)</SelectItem>
                  <SelectItem value="ms">毫秒 (ms)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {duration && (
              <p className="text-xs text-muted-foreground">
                视频时长: {duration} 秒
              </p>
            )}
          </div>

          {/* 提交按钮 */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!timeInput || isCapturing}
          >
            {isCapturing ? "截帧中..." : "截取当前帧"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
