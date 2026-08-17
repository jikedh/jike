import {
  IconDownload,
  IconMusic,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import {
  type NodeProps,
  NodeToolbar,
  Position,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import type { AudioNodeType } from "shared/types/flow";
import { cn, downloadImageFromUrl } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import useMessage from "@/hooks/useMessage";
import { useNodeScale } from "@/hooks/useNodeScale";
import { dispatchCreateAssetFromNode } from "@/pages/Canvas/components/CanvasSidebar";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { GenerationErrorTooltip } from "../shared/GenerationErrorTooltip";
import { NodeNameBadge } from "../shared/NodeNameBadge";
import { AudioPromptPanel } from "./AudioPromptPanel";

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const AudioContent = memo(
  ({
    data,
    audioRef,
  }: {
    data: AudioNodeType["data"];
    audioRef: React.RefObject<HTMLAudioElement | null>;
  }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioUrl = data.result?.data?.[0]?.url;
    const status = data.status;
    const progress = data.progress ?? 0;
    const isUpload = data.isUpload;

    const handlePlayPause = useCallback(() => {
      if (!audioRef.current) return;

      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }, [isPlaying]);

    const handleTimeUpdate = useCallback(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, []);

    const handleLoadedMetadata = useCallback(() => {
      if (audioRef.current) {
        const dur = audioRef.current.duration;
        setDuration(dur);
      }
    }, []);

    const handleSeek = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;

        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      },
      [duration],
    );

    if (status === GenerationStatus.IN_PROGRESS) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <div className="relative">
            <IconMusic size={48} className="text-[#B43FEB]/50" />
            <div className="absolute inset-0 animate-pulse">
              <IconMusic size={48} className="text-[#B43FEB]" />
            </div>
          </div>
          <div className="text-sm text-white/60">生成中...</div>
          <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#B43FEB] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      );
    }

    if (status === GenerationStatus.QUEUED) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <IconMusic size={48} className="text-white/30" />
          <div className="text-sm text-white/60">排队中...</div>
        </div>
      );
    }

    if (status === GenerationStatus.FAILED) {
      const displayMessage = data.error?.message || "生成失败";

      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <IconMusic size={48} className="text-red-400/50" />
          <GenerationErrorTooltip message={displayMessage} />
        </div>
      );
    }

    if (!audioUrl) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <IconMusic size={48} className="text-white/20" />
          <div className="text-sm text-white/40">暂无音频</div>
        </div>
      );
    }

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />

        <div className="flex items-center gap-4 w-full">
          <button
            onClick={handlePlayPause}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B43FEB] text-white transition-all hover:bg-[#B43FEB]/80 hover:scale-105 shrink-0"
          >
            {isPlaying ? (
              <IconPlayerPause size={20} />
            ) : (
              <IconPlayerPlay size={20} className="ml-0.5" />
            )}
          </button>

          <div className="flex-1 flex flex-col gap-1.5">
            <div
              className="relative h-2 bg-white/10 rounded-full cursor-pointer overflow-hidden"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-[#B43FEB] rounded-full transition-all"
                style={{
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/50">
              <span>
                {formatTime(currentTime)}
              </span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-white/40 text-xs">
          <IconMusic size={14} />
          <span>{isUpload ? "已上传音频" : "AI 生成音频"}</span>
          {duration > 0 && <span className="text-white/30">|</span>}
          {duration > 0 && <span>{formatTime(duration)}</span>}
        </div>
      </div>
    );
  },
);

AudioContent.displayName = "AudioContent";

const AudioToolbar = memo(
  ({
    nodeId,
    data,
    onDuplicate,
    onDelete,
  }: {
    nodeId: string;
    data: AudioNodeType["data"];
    onDuplicate: () => void;
    onDelete: () => void;
  }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const updateAudioNodeData = useCanvasFlowStore(
      (state) => state.updateAudioNodeData,
    );
    const { success, warning, error } = useMessage();

    const audioUrl = data.result?.data?.[0]?.url;
    const hasAudio = Boolean(audioUrl);

    const handleUploadClick = useCallback(() => {
      if (isUploading) return;
      fileInputRef.current?.click();
    }, [isUploading]);

    const handleFileChange = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = [
          "audio/mpeg",
          "audio/wav",
          "audio/mp3",
          "audio/ogg",
          "audio/aac",
        ];
        if (
          !validTypes.includes(file.type) &&
          !file.name.match(/\.(mp3|wav|ogg|aac)$/i)
        ) {
          warning("请上传 MP3、WAV、OGG 或 AAC 格式的音频文件");
          return;
        }

        setIsUploading(true);

        try {
          const result = await uploadFileToOSS(file);
          const url = result.url;

          if (!url) {
            warning("上传成功但未返回音频地址");
            return;
          }

          updateAudioNodeData(nodeId, {
            status: GenerationStatus.COMPLETED,
            progress: 100,
            isUpload: true,
            result: {
              type: "audio",
              data: [{ url }],
            },
          });
          success("上传成功");
        } catch (err) {
          console.error("上传音频失败:", err);
          error("上传失败，请重试");
        } finally {
          setIsUploading(false);
          e.target.value = "";
        }
      },
      [nodeId, updateAudioNodeData, success, warning, error],
    );

    const handleDownload = useCallback(async () => {
      if (!audioUrl || isDownloading) return;

      const format = data.result?.data?.[0]?.format;
      const extension =
        typeof format === "string" && /^(mp3|wav|ogg|aac)$/i.test(format)
          ? format.toLowerCase()
          : "mp3";

      setIsDownloading(true);
      try {
        await downloadImageFromUrl(
          audioUrl,
          `audio_${nodeId}.${extension}`,
        );
        success("下载成功");
      } catch (downloadError) {
        const message =
          downloadError instanceof Error ? downloadError.message : "下载失败";
        if (message !== "取消下载") {
          error(message);
        }
      } finally {
        setIsDownloading(false);
      }
    }, [audioUrl, data.result, error, isDownloading, nodeId, success]);

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-neutral-900/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
              isUploading
                ? "cursor-not-allowed text-white/30"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <IconUpload size={14} />
            <span>{isUploading ? "上传中" : "上传"}</span>
          </button>
          <button
            onClick={() => void handleDownload()}
            disabled={!hasAudio || isDownloading}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
              !hasAudio || isDownloading
                ? "cursor-not-allowed text-white/30"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <IconDownload size={14} />
            <span>{isDownloading ? "下载中" : "下载"}</span>
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <IconTrash size={14} />
            <span>删除</span>
          </button>
        </div>
      </>
    );
  },
);

AudioToolbar.displayName = "AudioToolbar";

export const AudioNode = memo(
  ({ id, data, selected, dragging }: NodeProps<AudioNodeType>) => {
    const isDragging = Boolean(dragging);
    const { zoom } = useNodeScale();
    const [isRenaming, setIsRenaming] = useState(false);
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const updateNodeNickname = useCanvasFlowStore(
      (state) => state.updateNodeNickname,
    );
    // 仅订阅与当前节点相关的派生布尔值，避免高亮列表变化时所有节点重渲染
    const isSourceHighlighted = useCanvasFlowStore((state) =>
      state.highlightedSourceNodeIds.includes(id),
    );
    const isActiveFromStore = useCanvasFlowStore(
      (state) => state.activeNodeId === id,
    );
    const audioRef = useRef<HTMLAudioElement>(null);

    // 只让活动单节点挂载工具栏和生成面板。
    const isActiveNode = isActiveFromStore && selected;

    const handleVisibilityClass = useMemo(
      () =>
        selected
          ? "visible opacity-100"
          : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100",
      [selected],
    );

    const shouldShowToolbar = useMemo(
      () => isActiveNode && !isDragging,
      [isActiveNode, isDragging],
    );

    const handleDuplicate = useCallback(() => {
      duplicateNode(id);
    }, [duplicateNode, id]);

    const handleDelete = useCallback(() => {
      deleteNode(id);
    }, [deleteNode, id]);

    const handleRenameStart = useCallback(() => {
      if (selected) {
        setIsRenaming(true);
      }
    }, [selected]);

    const handleRename = useCallback(
      (name: string) => {
        updateNodeNickname(id, name);
      },
      [id, updateNodeNickname],
    );

    const isUploadAudio = data.isUpload ?? false;
    const badgeLabel =
      data.nickname ??
      data.badgeLabel ??
      (isUploadAudio ? "上传音频" : "生成音频");

    const handleContextMenuCreateAsset = useCallback(
      () => dispatchCreateAssetFromNode(id),
      [id],
    );

    const handleEditEnd = useCallback(() => setIsRenaming(false), []);

    const nodeIcon = useMemo(() => <IconMusic size={14} />, []);

    return (
      <NodeContextMenu
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onCreateAsset={handleContextMenuCreateAsset}
      >
        <div
          className="group/node relative"
        >
          <NodeToolbar
            isVisible={shouldShowToolbar}
            position={Position.Top}
            offset={48 * zoom}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "bottom center",
              }}
            >
              <AudioToolbar
                nodeId={id}
                data={data}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            </div>
          </NodeToolbar>

          <div
            className={cn(
              "group/card relative flex w-87.5 h-62.5 flex-col rounded-xl border bg-linear-to-br from-[#141418] to-[#0d0d10] transition-all duration-300 ease-out",
              selected
                ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30"
                : isSourceHighlighted
                  ? "border-[#B43FEB]/65 shadow-[0_0_18px_rgba(180,63,235,0.28),0_0_36px_rgba(180,63,235,0.12)] ring-1 ring-[#B43FEB]/20"
                  : "border-white/6 hover:border-white/12 hover:bg-linear-to-br hover:from-[#18181c] hover:to-[#101014]",
            )}
            style={{ pointerEvents: "auto" }}
          >
            <NodeNameBadge
              icon={nodeIcon}
              selected={selected}
              isEditing={isRenaming}
              onEditStart={handleRenameStart}
              onEditEnd={handleEditEnd}
              onRename={handleRename}
            >
              {badgeLabel}
            </NodeNameBadge>

            {/* 左侧输入 Handle */}
            <ButtonHandle
              type="target"
              position={Position.Left}
              id="input"
              visible
              className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />

            {/* 右侧输出 Handle */}
            <ButtonHandle
              type="source"
              position={Position.Right}
              id="output"
              visible
              className={`transition-opacity duration-150 ${handleVisibilityClass}`}
            />
            {selected && (
              <>
                <div className="absolute -top-px -left-px w-4 h-4 border-l-2 border-t-2 border-[#B43FEB] rounded-tl-xl" />
                <div className="absolute -top-px -right-px w-4 h-4 border-r-2 border-t-2 border-[#B43FEB] rounded-tr-xl" />
                <div className="absolute -bottom-px -left-px w-4 h-4 border-l-2 border-b-2 border-[#B43FEB] rounded-bl-xl" />
                <div className="absolute -bottom-px -right-px w-4 h-4 border-r-2 border-b-2 border-[#B43FEB] rounded-br-xl" />
              </>
            )}

            <div className="pointer-events-none absolute inset-0 rounded-xl bg-linear-to-tr from-transparent via-white/2 to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />

            <div className="relative flex h-full w-full overflow-hidden rounded-lg bg-black/30">
              <AudioContent
                data={data}
                audioRef={audioRef}
              />
            </div>
          </div>
          {isActiveNode ? (
            <AudioPromptPanel nodeId={id} />
          ) : null}
        </div>
      </NodeContextMenu>
    );
  },
);

AudioNode.displayName = "AudioNode";
