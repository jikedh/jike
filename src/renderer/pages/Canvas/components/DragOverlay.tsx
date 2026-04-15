import { Image, Music, Video } from "lucide-react";
import { memo } from "react";
import type { MediaType } from "shared/constants/mediaTypes";
import { cn } from "shared/utils/utils";

interface DragOverlayProps {
  isVisible: boolean;
  fileCount: number;
  acceptedTypes: MediaType[];
}

/**
 * 拖拽上传遮罩组件
 * 当用户拖拽文件进入画布时显示，提供深色半透明遮罩和可视化反馈
 */
export const DragOverlay = memo(
  ({ isVisible, fileCount, acceptedTypes }: DragOverlayProps) => {
    if (!isVisible) return null;

    return (
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      >
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 transition-all duration-200",
            "border-white/30 bg-white/5 backdrop-blur-sm",
          )}
        >
          {/* 图标区域 */}
          <div className="flex gap-3">
            {acceptedTypes.includes("image") && (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-500/20">
                <Image className="h-7 w-7 text-purple-400" />
              </div>
            )}
            {acceptedTypes.includes("video") && (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/20">
                <Video className="h-7 w-7 text-blue-400" />
              </div>
            )}
            {acceptedTypes.includes("audio") && (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-500/20">
                <Music className="h-7 w-7 text-green-400" />
              </div>
            )}
          </div>

          {/* 文字提示 */}
          <div className="text-center">
            <p className="text-lg font-medium text-white">
              释放文件创建{fileCount > 1 ? `${fileCount} 个` : ""}
              {acceptedTypes.length === 1
                ? acceptedTypes[0] === "image"
                  ? "图片"
                  : acceptedTypes[0] === "video"
                    ? "视频"
                    : "音频"
                : ""}
              节点
            </p>
            <p className="mt-1 text-sm text-white/50">
              支持 JPG、PNG、GIF、WEBP、MP4、WEBM、MOV、MP3、WAV 等格式
            </p>
          </div>
        </div>
      </div>
    );
  },
);

DragOverlay.displayName = "DragOverlay";
