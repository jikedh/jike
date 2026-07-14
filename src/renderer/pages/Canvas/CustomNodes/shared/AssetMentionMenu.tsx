import {
  IconAlertCircle,
  IconChevronLeft,
  IconFolder,
  IconLoader2,
  IconMusic,
  IconPhoto,
  IconSearch,
  IconVideo,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import type { MediaType } from "shared/types/api/assets";
import type { AssetMentionGroup, MentionAssetOption } from "./assetMentionTypes";
import { getAssetMentionOptionSourceLabel } from "./assetMentionUtils";

interface AssetMentionMenuProps {
  query: string;
  groups: AssetMentionGroup[];
  selectedKey?: string | null;
  loading?: boolean;
  error?: string | null;
  breadcrumbs?: string[];
  canGoBack?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (option: MentionAssetOption) => void;
  onHoverOption?: (key: string) => void;
  onInputKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBack?: () => void;
}

const mediaIconMap = {
  image: IconPhoto,
  video: IconVideo,
  audio: IconMusic,
} satisfies Record<MediaType, typeof IconPhoto>;

const getOptionClassName = (option: MentionAssetOption, selected: boolean) => {
  const baseClass = "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left";
  if (option.disabled) {
    return `${baseClass} cursor-not-allowed opacity-45`;
  }
  if (selected) {
    return `${baseClass} bg-white/14 text-white`;
  }
  return `${baseClass} text-white/82 hover:bg-white/10 hover:text-white`;
};

const AssetPreview = ({ option }: { option: MentionAssetOption }) => {
  if (option.optionType === "scope-folder" || option.optionType === "category-folder") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.07] text-white/72">
        <IconFolder size={17} stroke={1.8} />
      </div>
    );
  }

  const Icon = mediaIconMap[option.mediaType];
  const showImage = option.mediaType === "image" && option.thumbnailUrl;

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.07] text-white/72">
      {showImage ? (
        <img
          src={option.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <Icon size={17} stroke={1.8} />
      )}
    </div>
  );
};

const AssetOptionRow = ({
  option,
  selected,
  onSelect,
  onHoverOption,
}: {
  option: MentionAssetOption;
  selected: boolean;
  onSelect: (option: MentionAssetOption) => void;
  onHoverOption?: (key: string) => void;
}) => {
  const handleMouseEnter = () => {
    if (!option.disabled) {
      onHoverOption?.(option.key);
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!option.disabled) {
      onSelect(option);
    }
  };

  return (
    <button
      type="button"
      className={getOptionClassName(option, selected)}
      onMouseEnter={handleMouseEnter}
      onMouseDown={handleMouseDown}
      disabled={option.disabled}
    >
      <AssetPreview option={option} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-medium leading-5">
            {option.label}
          </span>
          {option.disabled ? (
            <span className="shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-200">
              不可用
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-white/48">
          <span className="shrink-0 rounded bg-white/8 px-1.5 py-0.5">
            {getAssetMentionOptionSourceLabel(option)}
          </span>
          <span className="truncate">
            {option.disabled ? option.disabledReason : option.description || option.value}
          </span>
        </div>
      </div>
    </button>
  );
};

export const AssetMentionMenu = ({
  query,
  groups,
  selectedKey,
  loading = false,
  error,
  breadcrumbs = [],
  canGoBack = false,
  placeholder = "搜索图片、视频资产",
  autoFocus = false,
  onQueryChange,
  onSelect,
  onHoverOption,
  onInputKeyDown,
  onBack,
}: AssetMentionMenuProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  return (
    <div className="w-90 overflow-hidden rounded-xl border border-white/12 bg-[#111217]/95 text-white shadow-2xl shadow-black/35 backdrop-blur-xl">
      <div className="border-b border-white/10 p-2">
        {breadcrumbs.length > 0 ? (
          <div className="mb-1.5 flex min-w-0 items-center gap-1 text-[11px] text-white/50">
            {canGoBack ? (
              <button
                type="button"
                className="rounded p-0.5 text-white/65 hover:bg-white/10 hover:text-white"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onBack?.();
                }}
              >
                <IconChevronLeft size={14} />
              </button>
            ) : null}
            <span className="truncate">{breadcrumbs.join(" / ")}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/24 px-2.5 py-1.5 text-white/70">
          <IconSearch size={15} stroke={1.8} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder}
            className="h-6 min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/34"
          />
          {loading ? (
            <IconLoader2 size={14} className="animate-spin text-white/45" />
          ) : null}
        </div>
        {error ? (
          <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] text-amber-200/90">
            <IconAlertCircle size={13} />
            <span className="truncate">{error}</span>
          </div>
        ) : null}
      </div>

      <div className="max-h-105 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <div key={group.key} className="mb-2 last:mb-0">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-[#111217]/95 px-1 py-1 text-[11px] font-semibold text-white/72 backdrop-blur-xl">
              <span>{group.label}</span>
            </div>

            <div className="space-y-1">
              {group.children.map((section) => (
                <div key={section.key} className="rounded-lg bg-white/2.5 p-1">
                  <div className="px-1.5 py-1 text-[10px] text-white/42">
                    {section.label}
                  </div>

                  {section.options.length > 0 ? (
                    <div className="space-y-0.5">
                      {section.options.map((option) => (
                        <AssetOptionRow
                          key={option.key}
                          option={option}
                          selected={selectedKey === option.key}
                          onSelect={onSelect}
                          onHoverOption={onHoverOption}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md px-2 py-2 text-[11px] text-white/32">
                      {section.emptyText}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
