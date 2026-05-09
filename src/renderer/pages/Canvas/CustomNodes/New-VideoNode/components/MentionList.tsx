import { IconMusic, IconPhoto, IconVideo } from "@tabler/icons-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { cn } from "shared/utils/utils";
import type { MentionItem } from "../constants/mockData";

interface MentionListProps {
  items: MentionItem[];
  command: (item: {
    id: string;
    label: string;
    value: string;
    thumbnail?: string;
    type?: "image" | "video" | "audio";
  }) => void;
}

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const selectedItemRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useEffect(() => {
      selectedItemRef.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }, [selectedIndex, items.length]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    const selectItem = (index: number) => {
      const item = items[index];
      if (item && command) {
        command({
          id: item.id,
          label: item.label,
          value: item.value,
          thumbnail: item.thumbnail,
          type: item.type,
        });
      }
    };

    if (items.length === 0) {
      return (
        <div className="max-h-60 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-center text-sm text-neutral-400 shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
          无匹配素材
        </div>
      );
    }

    return (
      <div className="max-h-60 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={index === selectedIndex ? selectedItemRef : undefined}
            type="button"
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 border-b border-neutral-800 px-3 py-2 text-left last:border-b-0",
              index === selectedIndex
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-200 hover:bg-neutral-800",
            )}
            onMouseDown={(event) => {
              event.preventDefault();
              selectItem(index);
            }}
            onMouseEnter={() => {
              setSelectedIndex(index);
            }}
          >
            {/* 缩略图 */}
            {item.type === "audio" ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#B43FEB]/20">
                <IconMusic size={16} className="text-[#B43FEB]" />
              </div>
            ) : item.type === "video" ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#B43FEB]/20">
                <IconVideo size={16} className="text-[#B43FEB]" />
              </div>
            ) : (
              <img
                src={item.thumbnail}
                alt={item.label}
                className="h-8 w-8 shrink-0 rounded-md object-cover"
                loading="lazy"
              />
            )}

            {/* 名称 */}
            <span className="flex-1 truncate text-sm">{item.label}</span>

            {/* 类型图标 */}
            {item.type === "image" && (
              <IconPhoto size={14} className="shrink-0 text-neutral-500" />
            )}
            {item.type === "video" && (
              <IconVideo size={14} className="shrink-0 text-neutral-500" />
            )}
            {item.type === "audio" && (
              <IconMusic size={14} className="shrink-0 text-neutral-500" />
            )}
          </button>
        ))}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";
