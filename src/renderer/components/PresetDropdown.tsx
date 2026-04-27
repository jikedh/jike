import { IconBook2 } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import {
  CANVAS_PRESETS_UPDATED_EVENT,
  defaultPresets,
  type PresetItem,
  presetsService,
} from "service/localStorageService";
import { cn } from "shared/utils/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PresetDropdownProps {
  /** 预设类型：image 或 video */
  presetType: "image" | "video";
  /** 选中预设后的回调 */
  onSelect: (content: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

export const PresetDropdown = ({
  presetType,
  onSelect,
  disabled = false,
}: PresetDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 加载预设
  useEffect(() => {
    const loadPresets = () => {
      const loaded = presetsService.load() ?? defaultPresets;
      const filtered = [
        ...(loaded.general ?? []),
        ...(loaded[presetType] ?? []),
      ].filter((p) => p.enabled);

      setPresets(filtered);
    };

    loadPresets();
    window.addEventListener(CANVAS_PRESETS_UPDATED_EVENT, loadPresets);

    return () => {
      window.removeEventListener(CANVAS_PRESETS_UPDATED_EVENT, loadPresets);
    };
  }, [presetType]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (preset: PresetItem) => {
    onSelect(preset.content);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all",
          "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "bg-white/10 text-white",
        )}
        title="预设提示词"
      >
        <IconBook2 size={14} />
        <span>预设</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-1 right-0 z-50 w-48 bg-[#1a1a1c] border border-white/10 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="py-1 max-h-60 overflow-y-auto">
            {presets.length === 0 ? (
              <div className="px-3 py-2 text-xs text-white/40 text-center">
                暂无可用预设
              </div>
            ) : (
              <TooltipProvider delayDuration={120}>
                {presets.map((preset) => (
                  <Tooltip key={preset.id}>
                    {/* 使用 Portal Tooltip，避免被下拉容器的 overflow 裁剪 */}
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 cursor-pointer hover:bg-white/5"
                        onClick={() => handleSelect(preset)}
                      >
                        <div className="text-sm text-white/80 truncate">
                          {preset.name}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      align="end"
                      sideOffset={8}
                      className="max-w-64 whitespace-normal wrap-break-word border border-white/10 bg-black/90 text-xs text-white/80"
                    >
                      {preset.content}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
