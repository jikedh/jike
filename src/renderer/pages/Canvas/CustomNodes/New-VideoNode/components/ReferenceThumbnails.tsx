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
import { IconGripVertical, IconMusic, IconPhoto, IconVideo } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { cn, getVideoThumbnail } from "shared/utils/utils";
import { ThumbnailPreviewPopover } from "@/components/ThumbnailPreviewPopover";
import type { MentionItem } from "../constants/mockData";

interface ReferenceThumbnailsProps {
  items: MentionItem[];
  onReorder?: (
    type: MentionItem["type"],
    fromIndex: number,
    toIndex: number,
  ) => void;
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

const SortableReferenceItem = ({
  item,
  index,
  typeIndex,
}: {
  item: MentionItem;
  index: number;
  typeIndex: number;
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
      typeIndex,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
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
    >
      <ReferenceCard item={item} index={index} />
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

export const ReferenceThumbnails = ({
  items,
  onReorder,
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
      const typeIndex = typeIndexes[item.type];
      typeIndexes[item.type] += 1;

      return {
        item,
        index,
        typeIndex,
      };
    });
  }, [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const activeData = event.active.data.current as
      | { item?: MentionItem; typeIndex?: number }
      | undefined;
    const overData = event.over?.data.current as
      | { item?: MentionItem; typeIndex?: number }
      | undefined;

    if (!activeData?.item || !overData?.item) {
      return;
    }

    if (activeData.item.id === overData.item.id) {
      return;
    }

    if (activeData.item.type !== overData.item.type) {
      return;
    }

    if (
      typeof activeData.typeIndex !== "number" ||
      typeof overData.typeIndex !== "number"
    ) {
      return;
    }

    onReorder?.(
      activeData.item.type,
      activeData.typeIndex,
      overData.typeIndex,
    );
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
        <div className="flex items-center gap-2 overflow-visible">
          {sortableItems.map(({ item, index, typeIndex }) => (
            <SortableReferenceItem
              key={item.id}
              item={item}
              index={index}
              typeIndex={typeIndex}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
