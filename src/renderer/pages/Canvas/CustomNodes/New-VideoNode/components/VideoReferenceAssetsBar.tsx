import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn, getVideoThumbnail } from "shared/utils/utils";
import { PROMPT_PANEL_STYLES } from "../../shared/promptPanelStyles";

const VideoThumbnailButton = ({
  videoUrl,
}: {
  videoUrl: string;
}) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    getVideoThumbnail(videoUrl)
      .then(setThumbnail)
      .catch(() => { });
  }, [videoUrl]);

  if (thumbnail) {
    return (
      <img
        src={thumbnail}
        alt="视频参考"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center text-[#B43FEB]">
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
    </div>
  );
};

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
          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100"
          title="断开连接"
        >
          <IconX size={10} />
        </button>
      )}
    </div>
  );
};

export const VideoReferenceAssetsBar = ({
  referenceImageUrls,
  referenceImageIndexes,
  parentImageNodes,
  parentAudioNodes,
  parentVideoNodes,
  referenceContent,
  onDisconnectNode,
  onRemoveReferenceImage,
  onReferenceHoverChange,
}: {
  referenceImageUrls: string[];
  referenceImageIndexes?: number[];
  parentImageNodes: {
    id: string;
    url: string;
    displayUrl?: string;
    label?: string;
  }[];
  parentAudioNodes: { id: string; url: string; label?: string }[];
  parentVideoNodes: { id: string; url: string; label?: string }[];
  referenceContent?: ReactNode;
  onDisconnectNode: (sourceNodeId: string) => void;
  onRemoveReferenceImage: (url: string, index: number) => void;
  onReferenceHoverChange: (sourceNodeId: string, isHovering: boolean) => void;
}) => {
  return (
    <div className="nodrag nopan nowheel no-scrollbar flex h-15 items-center gap-2 overflow-x-auto overflow-y-hidden">
      {referenceContent ? (
        referenceContent
      ) : (
        <>
          {referenceImageUrls.map((url, index) => {
            return (
              <ReferenceItemWrapper
                key={`${url}-${index}`}
                onDisconnect={() =>
                  onRemoveReferenceImage(
                    url,
                    referenceImageIndexes?.[index] ?? index,
                  )
                }
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

          {parentImageNodes.map((item, index) => (
            <ReferenceItemWrapper
              key={`parent-image-${item.id}-${index}`}
              onDisconnect={() => onDisconnectNode(item.id)}
              onMouseEnter={() => onReferenceHoverChange(item.id, true)}
              onMouseLeave={() => onReferenceHoverChange(item.id, false)}
            >
              <img
                src={item.displayUrl ?? item.url}
                alt="参考图"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
              />
            </ReferenceItemWrapper>
          ))}

          {parentAudioNodes.map((item, index) => {
            return (
              <ReferenceItemWrapper
                key={`audio-${item.id}-${index}`}
                className="border-[#B43FEB]/40 bg-[#B43FEB]/20"
                onDisconnect={() => onDisconnectNode(item.id)}
                onMouseEnter={() => onReferenceHoverChange(item.id, true)}
                onMouseLeave={() => onReferenceHoverChange(item.id, false)}
              >
                <div className="flex h-full w-full items-center justify-center text-[#B43FEB]">
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
                </div>
              </ReferenceItemWrapper>
            );
          })}

          {parentVideoNodes.map((item, index) => (
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
        </>
      )}
    </div>
  );
};
