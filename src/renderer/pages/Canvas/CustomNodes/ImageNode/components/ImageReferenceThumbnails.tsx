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
  IconFileText,
  IconGripVertical,
  IconPhoto,
  IconX
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { cn } from "shared/utils/utils";
import { NotePreviewPopover } from "@/components/NotePreviewPopover";
import { ThumbnailPreviewPopover } from "@/components/ThumbnailPreviewPopover";

export interface ImageReferenceItem {
  id: string;
  url: string;
  label?: string;
  thumbnail?: string;
  /** 是否为上传的本地图片（而非父节点图片） */
  isLocalImage?: boolean;
  /** 引用类型：图片或便签文本 */
  type?: "image" | "note";
  /** 便签全文（用于悬浮预览） */
  content?: string;
}

interface ImageReferenceThumbnailsProps {
  items: ImageReferenceItem[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRemove?: (item: ImageReferenceItem) => void;
  onHoverChange?: (item: ImageReferenceItem, isHovering: boolean) => void;
}

interface SortableItemData {
  item: ImageReferenceItem;
  index: number;
}

const NoteCardContent = ({ item, label }: {
  item: ImageReferenceItem;
  label?: string;
}) => {
  const summary = item.content?.trim()
    ? item.content.trim().length > 24
      ? `${item.content.trim().slice(0, 24)}…`
      : item.content.trim()
    : "便签";
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#B43FEB]/12 px-1 py-1 text-[#B43FEB]">
      <IconFileText size={16} stroke={1.8} />
      <span className="max-w-full truncate px-1 text-[9px] font-medium leading-none" title={summary}>
        {summary}
      </span>
      {label && label !== "便签节点" && (
        <span className="max-w-full truncate px-1 text-[8px] text-white/65 leading-none" title={label}>
          {label}
        </span>
      )}
    </div>
  );
};

const SortableImageItem = ({
  item,
  index,
  onRemove,
  onHoverChange,
}: {
  item: ImageReferenceItem;
  index: number;
  onRemove?: (item: ImageReferenceItem) => void;
  onHoverChange?: (item: ImageReferenceItem, isHovering: boolean) => void;
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
    transform: CSS.Transform.toString(
      transform ? { ...transform, y: 0 } : null,
    ),
    transition,
  };

  const noteCard = item.type === "note" ? (
    <NotePreviewPopover
      content={item.content ?? ""}
      label={item.label}
      index={index}
    >
      <NoteCardContent item={item} label={item.label} />
    </NotePreviewPopover>
  ) : null;

  const card = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-xl border border-white/8 bg-white/3 shadow-sm transition-colors",
        item.type === "note"
          ? "border-[#B43FEB]/40"
          : "border-white/8",
        isDragging && "z-10 opacity-60",
      )}
      onMouseEnter={() => onHoverChange?.(item, true)}
      onMouseLeave={() => onHoverChange?.(item, false)}
    >
      <div className="relative h-15 w-15">
        {item.type === "note" ? (
          noteCard
        ) : item.thumbnail || item.url ? (
          <img
            src={item.thumbnail ?? item.url}
            alt={item.label || "参考图"}
            className="h-full w-full object-cover"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/45">
            <IconPhoto size={18} />
          </div>
        )}
      </div>

      {/* 序号角标 */}
      <div className="pointer-events-none absolute inset-x-1 top-1 flex items-center justify-between">
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-black/65 px-1 text-[10px] font-medium text-white">
          {index + 1}
        </span>
        {item.label && (
          <span className="max-w-12 truncate rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white/85">
            {item.label}
          </span>
        )}
      </div>

      {/* 删除按钮 */}
      {onRemove && (
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
      )}

      {/* 拖拽手柄 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute right-1 bottom-1 flex h-6 w-6 cursor-grab items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-sm transition-opacity active:cursor-grabbing group-hover:opacity-100"
        title="拖动排序"
      >
        <IconGripVertical size={18} stroke={1.8} />
      </button>
    </div>
  );

  if (!item.thumbnail || !item.url) {
    return card;
  }

  return (
    <ThumbnailPreviewPopover src={item.thumbnail ?? item.url} index={index}>
      {card}
    </ThumbnailPreviewPopover>
  );
};

const StaticImageItem = ({
  item,
  index,
  onRemove,
  onHoverChange,
}: {
  item: ImageReferenceItem;
  index: number;
  onRemove?: (item: ImageReferenceItem) => void;
  onHoverChange?: (item: ImageReferenceItem, isHovering: boolean) => void;
}) => {
  const noteCard = item.type === "note" ? (
    <NotePreviewPopover
      content={item.content ?? ""}
      label={item.label}
      index={index}
    >
      <NoteCardContent item={item} label={item.label} />
    </NotePreviewPopover>
  ) : null;

  const card = (
    <div
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-xl border border-white/8 bg-white/3 shadow-sm transition-colors",
        item.type === "note" ? "border-[#B43FEB]/40" : "border-white/8",
      )}
      onMouseEnter={() => onHoverChange?.(item, true)}
      onMouseLeave={() => onHoverChange?.(item, false)}
    >
      <div className="relative h-15 w-15">
        {item.type === "note" ? (
          noteCard
        ) : item.thumbnail || item.url ? (
          <img
            src={item.thumbnail ?? item.url}
            alt={item.label || "参考图"}
            className="h-full w-full object-cover"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/45">
            <IconPhoto size={18} />
          </div>
        )}
      </div>

      {/* 序号角标 */}
      <div className="pointer-events-none absolute inset-x-1 top-1 flex items-center justify-between">
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-black/65 px-1 text-[10px] font-medium text-white">
          {index + 1}
        </span>
        {item.label && (
          <span className="max-w-12 truncate rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white/85">
            {item.label}
          </span>
        )}
      </div>

      {/* 删除按钮 */}
      {onRemove && (
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
      )}
    </div>
  );

  if (!item.thumbnail || !item.url) {
    return card;
  }

  return (
    <ThumbnailPreviewPopover src={item.thumbnail ?? item.url} index={index}>
      {card}
    </ThumbnailPreviewPopover>
  );
};

export const ImageReferenceThumbnails = ({
  items,
  onReorder,
  onRemove,
  onHoverChange,
}: ImageReferenceThumbnailsProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const sortableItems: SortableItemData[] = useMemo(
    () => items.map((item, index) => ({ item, index })),
    [items],
  );

  if (!onReorder) {
    return (
      <div className="flex h-15 items-center gap-2 overflow-visible">
        {sortableItems.map(({ item, index }) => (
          <StaticImageItem
            key={item.id}
            item={item}
            index={index}
            onRemove={onRemove}
            onHoverChange={onHoverChange}
          />
        ))}
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const activeData = event.active.data.current as
      | { item?: ImageReferenceItem; index?: number }
      | undefined;
    const overData = event.over?.data.current as
      | { item?: ImageReferenceItem; index?: number }
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
        <div className="flex h-15 items-center gap-2 overflow-visible">
          {sortableItems.map(({ item, index }) => (
            <SortableImageItem
              key={item.id}
              item={item}
              index={index}
              onRemove={onRemove}
              onHoverChange={onHoverChange}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
