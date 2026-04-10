import { IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ChangeEvent, RefObject, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn, getVideoThumbnail } from "@/lib/utils";
import { PROMPT_PANEL_STYLES } from "../../shared/promptPanelStyles";

/**
 * 视频缩略图按钮。
 * 输入视频 URL 后异步获取封面，失败时展示占位图标。
 */
const VideoThumbnailButton = ({ videoUrl }: { videoUrl: string }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    getVideoThumbnail(videoUrl)
      .then(setThumbnail)
      .catch(() => {});
  }, [videoUrl]);

  if (thumbnail) {
    return (
      <img
        src={thumbnail}
        alt="视频"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-[#B43FEB]">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
      <span>视频</span>
    </div>
  );
};

/**
 * 参考项通用包裹层。
 * 提供统一尺寸与“断开连接”悬浮按钮。
 */
const ReferenceItemWrapper = ({
  children,
  onDisconnect,
  onMouseEnter,
  onMouseLeave,
  className,
}: {
  children: ReactNode;
  onDisconnect?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        PROMPT_PANEL_STYLES.referenceImageButton,
        "group relative",
        className,
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {onDisconnect && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onDisconnect();
          }}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100"
          title="断开连接"
        >
          <IconX size={10} />
        </button>
      )}
    </div>
  );
};

/**
 * 参考资源条组件。
 * 负责展示上传按钮与参考图/参考音频/参考视频。
 */
export const VideoReferenceAssetsBar = ({
  isUploading,
  fileInputRef,
  onUploadClick,
  onFileChange,
  referenceImageUrls,
  parentImageNodeUrls,
  parentImageNodeIdByUrl,
  parentAudioNodes,
  parentVideoNodes,
  model,
  onDisconnectNode,
  onRemoveReferenceImage,
  onReferenceHoverChange,
}: {
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  referenceImageUrls: string[];
  parentImageNodeUrls: Set<string>;
  parentImageNodeIdByUrl: Record<string, string>;
  parentAudioNodes: { id: string; url: string }[];
  parentVideoNodes: { id: string; url: string }[];
  model: string;
  onDisconnectNode: (sourceNodeId: string) => void;
  onRemoveReferenceImage: (url: string) => void;
  onReferenceHoverChange: (sourceNodeId: string, isHovering: boolean) => void;
}) => {
  return (
    <div className="nodrag nopan nowheel mt-2.5 flex gap-2 overflow-x-auto pb-1">
      <Button
        unstyled
        className={PROMPT_PANEL_STYLES.uploadButton}
        onClick={onUploadClick}
        title={isUploading ? "上传中..." : "上传参考图"}
        disabled={isUploading}
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px]">
          <IconUpload size={16} />
          {isUploading ? "上传中" : "上传"}
        </div>
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {referenceImageUrls.map((url, index) => {
        const isFromParent = parentImageNodeUrls.has(url);
        const parentNodeId = isFromParent
          ? parentImageNodeIdByUrl[url]
          : undefined;
        const handleRemove = () => {
          if (parentNodeId) {
            onDisconnectNode(parentNodeId);
            return;
          }

          onRemoveReferenceImage(url);
        };

        return (
          <ReferenceItemWrapper
            key={`${url}-${index}`}
            onDisconnect={handleRemove}
            onMouseEnter={() => {
              if (!parentNodeId) {
                return;
              }

              onReferenceHoverChange(parentNodeId, true);
            }}
            onMouseLeave={() => {
              if (!parentNodeId) {
                return;
              }

              onReferenceHoverChange(parentNodeId, false);
            }}
          >
            <img
              src={url}
              alt="参考图"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />
          </ReferenceItemWrapper>
        );
      })}

      {model === "doubao-seedance-2.0" &&
        parentAudioNodes.map((item, index) => (
          <ReferenceItemWrapper
            key={`audio-${item.id}-${index}`}
            className="border-[#B43FEB]/40 bg-[#B43FEB]/20"
            onDisconnect={() => onDisconnectNode(item.id)}
            onMouseEnter={() => onReferenceHoverChange(item.id, true)}
            onMouseLeave={() => onReferenceHoverChange(item.id, false)}
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-[#B43FEB]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span>音频</span>
            </div>
          </ReferenceItemWrapper>
        ))}

      {model === "doubao-seedance-2.0" &&
        parentVideoNodes.map((item, index) => (
          <ReferenceItemWrapper
            key={`video-${item.id}-${index}`}
            className="overflow-hidden"
            onDisconnect={() => onDisconnectNode(item.id)}
            onMouseEnter={() => onReferenceHoverChange(item.id, true)}
            onMouseLeave={() => onReferenceHoverChange(item.id, false)}
          >
            <VideoThumbnailButton videoUrl={item.url} />
          </ReferenceItemWrapper>
        ))}
    </div>
  );
};
