import {
  IconAspectRatio,
  IconBrush,
  IconCamera,
  IconCrop,
  IconDownload,
  IconEraser,
  IconPlayerStop,
  IconSparkles,
  IconTrash,
  IconUpload,
  IconVideo,
  IconZoomIn,
} from "@tabler/icons-react";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import type { VideoGenerationNode } from "shared/types/flow";
import { toast } from "sonner";
import Lightbox from "yet-another-react-lightbox";
// import Captions from 'yet-another-react-lightbox/plugins/captions'
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Share from "yet-another-react-lightbox/plugins/share";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Video from "yet-another-react-lightbox/plugins/video";
// import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { getVideoUrlsFromNodeData } from "./utils/video-url";
import { cn, downloadImageFromUrl } from "shared/utils/utils";
import { useVideoFrameCapture } from "./hooks/useVideoFrameCapture";
import { VideoSnapshotPanel } from "./components/VideoSnapshotPanel";

type VideoToolbarProps = {
  nodeId: string;
  data: VideoGenerationNode;
  onDelete?: () => void;
};

type ActionKey =
  | "upload"
  | "repaint"
  | "erase"
  | "enhance"
  | "outpaint"
  | "crop"
  | "download"
  | "preview"
  | "lastFrame"
  | "snapshot";

/**
 * 视频节点工具栏组件
 * 职责：
 * - 提供重绘、擦除、增强、扩图、裁剪、下载、放大查看、尾帧提取、截帧等操作按钮
 * - 处理工具栏按钮交互反馈
 * - 基于 yet-another-react-lightbox 提供放大查看能力
 */
export const VideoToolbar = ({ nodeId, data, onDelete }: VideoToolbarProps) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSnapshotPanelOpen, setIsSnapshotPanelOpen] = useState(false);

  // 隐藏的文件输入框引用：用于点击"上传"按钮时拉起文件选择器
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 更新视频节点数据：上传成功后将 URL 回填到当前节点
  const updateVideoNodeData = useCanvasFlowStore(
    (state) => state.updateVideoNodeData,
  );

  // 视频截帧 Hook
  const { captureLastFrame, captureSnapshot, isCapturingLastFrame, isCapturingSnapshot } =
    useVideoFrameCapture({ updateVideoNodeData, nodeId });

  // 统一走视频节点 URL 提取工具，避免不同组件口径不一致。
  const videoUrls = useMemo(() => {
    return getVideoUrlsFromNodeData(data);
  }, [data]);
  const currentVideoUrl = videoUrls[0];

  // 获取视频时长（秒）
  const videoDuration = data.duration;

  const toolbarActions = useMemo(() => {
    return [
      { key: "upload" as const, label: "上传", icon: IconUpload },
      { key: "repaint" as const, label: "重绘", icon: IconBrush },
      { key: "erase" as const, label: "擦除", icon: IconEraser },
      { key: "enhance" as const, label: "增强", icon: IconSparkles },
      { key: "outpaint" as const, label: "扩图", icon: IconAspectRatio },
      { key: "crop" as const, label: "裁剪", icon: IconCrop },
      { key: "download" as const, label: "下载", icon: IconDownload },
      { key: "preview" as const, label: "放大查看", icon: IconZoomIn },
      { key: "lastFrame" as const, label: "尾帧", icon: IconPlayerStop },
      { key: "snapshot" as const, label: "截帧", icon: IconCamera },
    ];
  }, []);

  // 触发文件选择
  const handleUploadClick = () => {
    if (isUploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  // 处理文件上传：调用 OSS 上传并把返回 URL 追加到视频结果数组
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadFileToOSS(file);
      const uploadedUrl = result.url;

      if (!uploadedUrl) {
        toast.warning("上传成功但未返回视频地址");
        return;
      }

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const currentData = data.result?.data ?? [];

      updateVideoNodeData(nodeId, {
        result: {
          type: "video",
          data: [...currentData, { url: uploadedUrl, format: fileExt }],
        },
      });
      toast.success("上传成功");
    } catch (uploadError) {
      console.error("上传视频失败:", uploadError);
      toast.error("上传失败，请重试");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleAction = async (actionKey: ActionKey) => {
    if (actionKey === "upload") {
      handleUploadClick();
      return;
    }

    if (actionKey === "preview") {
      if (!currentVideoUrl) {
        toast.info("暂无可预览视频");
        return;
      }

      setIsLightboxOpen(true);
      return;
    }

    if (actionKey === "download") {
      if (!currentVideoUrl) {
        toast.info("暂无可下载视频");
        return;
      }

      if (isDownloading) {
        return;
      }

      setIsDownloading(true);
      try {
        await downloadImageFromUrl(currentVideoUrl);
        toast.success("下载成功");
      } catch (error) {
        const message = error instanceof Error ? error.message : "下载失败";
        toast.error(message);
        console.error("下载视频失败:", error);
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    if (actionKey === "lastFrame") {
      if (!currentVideoUrl) {
        toast.info("暂无可用视频");
        return;
      }
      await captureLastFrame(currentVideoUrl);
      return;
    }

    if (actionKey === "snapshot") {
      if (!currentVideoUrl) {
        toast.info("暂无可用视频");
        return;
      }
      setIsSnapshotPanelOpen(true);
      return;
    }

    // 其余功能仅保留占位交互框架，业务逻辑后续接入
    toast.info("功能开发中...");
  };

  const isPreviewActive = isLightboxOpen;

  return (
    <>
      {/* 隐藏 input：通过工具栏“上传”按钮触发 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="nodrag nopan nowheel inline-flex h-10 items-center gap-1 rounded-full bg-[#2a2a2d] border border-white/10 px-2 shadow-xl">
        {toolbarActions.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === "preview" ? isPreviewActive : false;
          const isDisabled =
            (item.key === "download" && isDownloading) ||
            (item.key === "upload" && isUploading);

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleAction(item.key)}
              disabled={isDisabled}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer min-w-13",
                isDisabled
                  ? "text-white/30 cursor-not-allowed"
                  : isActive
                    ? "text-[#B43FEB]"
                    : "text-white/60 hover:text-white hover:bg-white/5",
              )}
              title={item.label}
              aria-label={item.label}
            >
              <Icon size={16} stroke={1.5} />
              <span className="text-[10px] whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 删除按钮 */}
        <button
          type="button"
          onClick={onDelete}
          className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer min-w-13"
          title="删除"
          aria-label="删除节点"
        >
          <IconTrash size={16} stroke={1.5} />
          <span className="text-[10px]">删除</span>
        </button>
      </div>

      {/* 截帧面板 */}
      <VideoSnapshotPanel
        open={isSnapshotPanelOpen}
        onClose={() => setIsSnapshotPanelOpen(false)}
        videoUrl={currentVideoUrl || ""}
        duration={videoDuration}
        onSnapshot={(timeMs) => captureSnapshot(currentVideoUrl, timeMs)}
        isCapturing={isCapturingSnapshot}
      />

      {isLightboxOpen ? (
        <Lightbox
          open={isLightboxOpen}
          close={() => {
            setIsLightboxOpen(false);
          }}
          slides={videoUrls
            .filter((url): url is string => !!url)
            .map((url) => ({
              type: "video" as const,
              sources: [{ src: url, type: "video/mp4" }],
            }))}
          plugins={[Video, Fullscreen, Slideshow, Zoom, Share, Download]}
          zoom={{ maxZoomPixelRatio: 4, zoomInMultiplier: 2 }}
          controller={{ closeOnBackdropClick: true }}
        />
      ) : null}
    </>
  );
};
