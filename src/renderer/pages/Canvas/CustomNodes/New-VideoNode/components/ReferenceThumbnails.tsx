import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconGripVertical,
  IconMusic,
  IconPhoto,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { cn, getVideoThumbnail } from "shared/utils/utils";
import { ThumbnailPreviewPopover } from "@/components/ThumbnailPreviewPopover";
import type { MentionItem } from "../constants/mockData";

interface ReferenceThumbnailsProps {
  items: MentionItem[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRemove?: (item: MentionItem) => void;
  onHoverChange?: (item: MentionItem, isHovering: boolean) => void;
}

const TYPE_LABELS: Record<MentionItem["type"], string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
};

const MediaBadge = ({
  label,
  type,
  index,
}: {
  label?: string;
  type: MentionItem["type"];
  index: number;
}) => (
  <div className="pointer-events-none absolute inset-x-1 top-1 flex items-center justify-between">
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-black/65 px-1 text-[10px] font-medium text-white">
      {index + 1}
    </span>
    <span
      className="max-w-12 truncate rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white/85"
      title={label || TYPE_LABELS[type]}
    >
      {label || TYPE_LABELS[type]}
    </span>
  </div>
);

const Placeholder = ({
  type,
  label,
}: {
  type: "video" | "audio";
  label?: string;
}) => {
  const Icon = type === "video" ? IconVideo : IconMusic;
  const displayLabel = label?.trim() || TYPE_LABELS[type];

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
      <span
        className="max-w-full truncate px-1 text-[10px] font-medium"
        title={displayLabel}
      >
        {displayLabel}
      </span>
    </div>
  );
};

const VideoThumbnail = ({ url, label }: { url: string; label?: string }) => {
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
    return <Placeholder type="video" label={label} />;
  }

  return (
    <img
      src={thumbnail}
      alt={label || "视频"}
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
        <VideoThumbnail url={item.thumbnail} label={item.label} />
      ) : (
        <Placeholder type="audio" label={item.label} />
      )}
      <MediaBadge label={item.label} type={item.type} index={index} />
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

const SortableReferenceItem = ({
  item,
  index,
  displayIndex,
  onRemove,
  onHoverChange,
}: {
  item: MentionItem;
  index: number;
  displayIndex: number;
  onRemove?: (item: MentionItem) => void;
  onHoverChange?: (item: MentionItem, isHovering: boolean) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      item,
      index,
    },
  });

  const style = {
    // 参考素材只允许横向换位，禁用纵向位移，避免长按拖拽时把图片区域往下拉。
    transform: CSS.Transform.toString(
      transform ? { ...transform, y: 0 } : null,
    ),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex shrink-0 items-center",
        isDragging && "z-10 opacity-60",
      )}
      onMouseEnter={() => onHoverChange?.(item, true)}
      onMouseLeave={() => onHoverChange?.(item, false)}
    >
      <ReferenceCard item={item} index={displayIndex} />
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(item);
          }}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 text-neutral-300 opacity-0 shadow-sm transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100"
          title="移除参考素材"
        >
          <IconX size={10} />
        </button>
      ) : null}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute right-1 bottom-1 flex h-6 w-6 cursor-grab items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-sm transition-opacity active:cursor-grabbing group-hover:opacity-100"
        title={`拖动排序${TYPE_LABELS[item.type]}`}
      >
        <IconGripVertical size={18} stroke={1.8} />
      </button>
    </div>
  );
};

const StaticReferenceItem = ({
  item,
  index,
  displayIndex,
  onRemove,
  onHoverChange,
}: {
  item: MentionItem;
  index: number;
  displayIndex: number;
  onRemove?: (item: MentionItem) => void;
  onHoverChange?: (item: MentionItem, isHovering: boolean) => void;
}) => {
  return (
    <div
      className="group relative flex shrink-0 items-center"
      onMouseEnter={() => onHoverChange?.(item, true)}
      onMouseLeave={() => onHoverChange?.(item, false)}
    >
      <ReferenceCard item={item} index={displayIndex} />
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(item);
          }}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 text-neutral-300 opacity-0 shadow-sm transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100"
          title="移除参考素材"
        >
          <IconX size={10} />
        </button>
      ) : null}
    </div>
  );
};

export const ReferenceThumbnails = ({
  items,
  onReorder,
  onRemove,
  onHoverChange,
}: ReferenceThumbnailsProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const sortableItems = useMemo(() => {
    const typeIndexes: Record<MentionItem["type"], number> = {
      image: 0,
      video: 0,
      audio: 0,
    };

    return items.map((item, index) => {
      const displayIndex = typeIndexes[item.type];
      typeIndexes[item.type] += 1;

      return {
        item,
        index,
        displayIndex,
      };
    });
  }, [items]);

  if (!onReorder) {
    // 新版视频节点暂时禁用拖拽排序，避免缩略图长按/拖动时把素材区域向下拉伸。
    return (
      <div className="flex h-[60px] items-center gap-2 overflow-visible">
        {sortableItems.map(({ item, index, displayIndex }) => (
          <StaticReferenceItem
            key={item.id}
            item={item}
            index={index}
            displayIndex={displayIndex}
            onRemove={onRemove}
            onHoverChange={onHoverChange}
          />
        ))}
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const activeData = event.active.data.current as
      | { item?: MentionItem; index?: number }
      | undefined;
    const overData = event.over?.data.current as
      | { item?: MentionItem; index?: number }
      | undefined;

    if (!activeData?.item || !overData?.item) {
      return;
    }

    if (activeData.item.id === overData.item.id) {
      return;
    }

    if (
      typeof activeData.index !== "number" ||
      typeof overData.index !== "number"
    ) {
      return;
    }

    onReorder?.(activeData.index, overData.index);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortableItems.map(({ item }) => item.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex h-[60px] items-center gap-2 overflow-visible">
          {sortableItems.map(({ item, index, displayIndex }) => (
            <SortableReferenceItem
              key={item.id}
              item={item}
              index={index}
              displayIndex={displayIndex}
              onRemove={onRemove}
              onHoverChange={onHoverChange}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
