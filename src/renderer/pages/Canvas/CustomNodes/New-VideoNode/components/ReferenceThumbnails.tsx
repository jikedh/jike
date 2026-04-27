import {
  IconArrowsExchange,
  IconMusic,
  IconPhoto,
  IconVideo,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { cn, getVideoThumbnail } from "shared/utils/utils";
import { ThumbnailPreviewPopover } from "@/components/ThumbnailPreviewPopover";
import type { MentionItem } from "../constants/mockData";

interface ReferenceThumbnailsProps {
  items: MentionItem[];
  onSwap?: (indexA: number, indexB: number) => void;
}

const TYPE_LABELS: Record<MentionItem["type"], string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
};

const MediaBadge = ({
  type,
  index,
}: {
  type: MentionItem["type"];
  index: number;
}) => (
  <div className="pointer-events-none absolute inset-x-1 top-1 flex items-center justify-between">
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-black/65 px-1 text-[10px] font-medium text-white">
      {index + 1}
    </span>
    <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white/85">
      {TYPE_LABELS[type]}
    </span>
  </div>
);

const Placeholder = ({ type }: { type: "video" | "audio" }) => {
  const Icon = type === "video" ? IconVideo : IconMusic;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1",
        type === "video"
          ? "bg-sky-500/12 text-sky-300"
          : "bg-fuchsia-500/12 text-fuchsia-300",
      )}
    >
      <Icon size={18} stroke={1.8} />
      <span className="text-[10px] font-medium">{TYPE_LABELS[type]}</span>
    </div>
  );
};

const VideoThumbnail = ({ url }: { url: string }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!url) {
      setThumbnail(null);
      return;
    }

    getVideoThumbnail(url)
      .then((nextThumbnail) => {
        if (mounted) {
          setThumbnail(nextThumbnail);
        }
      })
      .catch(() => {
        if (mounted) {
          setThumbnail(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [url]);

  if (!thumbnail) {
    return <Placeholder type="video" />;
  }

  return (
    <img
      src={thumbnail}
      alt="视频"
      className="h-full w-full object-cover"
      draggable={false}
      loading="lazy"
    />
  );
};

const ReferenceCard = ({
  item,
  index,
}: {
  item: MentionItem;
  index: number;
}) => {
  const card = (
    <div className="relative h-15 w-15 shrink-0 overflow-hidden rounded-xl border border-white/8 bg-white/3 shadow-sm transition-colors group-hover:border-white/18">
      {item.type === "image" ? (
        item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.label}
            className="h-full w-full object-cover"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/45">
            <IconPhoto size={18} />
          </div>
        )
      ) : item.type === "video" ? (
        <VideoThumbnail url={item.thumbnail} />
      ) : (
        <Placeholder type="audio" />
      )}
      <MediaBadge type={item.type} index={index} />
    </div>
  );

  if (item.type !== "image" || !item.thumbnail) {
    return card;
  }

  return (
    <ThumbnailPreviewPopover src={item.thumbnail} index={index}>
      {card}
    </ThumbnailPreviewPopover>
  );
};

export const ReferenceThumbnails = ({
  items,
  onSwap,
}: ReferenceThumbnailsProps) => {
  return (
    <div className="flex items-center gap-2 overflow-visible">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="group relative flex shrink-0 items-center gap-1"
        >
          <ReferenceCard item={item} index={index} />
          {index < items.length - 1 && onSwap && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSwap(index, index + 1);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
              title="交换位置"
            >
              <IconArrowsExchange size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
