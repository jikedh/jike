import { IconBook2 } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CANVAS_PRESETS_UPDATED_EVENT,
  type PresetItem,
  presetStorage,
} from "service/presetStorage";
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
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 加载预设
  useEffect(() => {
    const loadPresets = async () => {
      const loaded = await presetStorage.loadPresets();
      const filtered = [
        ...(loaded.general ?? []),
        ...(loaded[presetType] ?? []),
      ].filter((p) => p.enabled);

      setPresets(filtered);
    };

    void loadPresets();
    window.addEventListener(CANVAS_PRESETS_UPDATED_EVENT, loadPresets);

    return () => {
      window.removeEventListener(CANVAS_PRESETS_UPDATED_EVENT, loadPresets);
    };
  }, [presetType]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const updatePosition = () => {
      const triggerElement = triggerRef.current;
      if (!triggerElement) {
        return;
      }
      const rect = triggerElement.getBoundingClientRect();
      const menuWidth = 192;
      const viewportPadding = 8;
      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        Math.max(
          viewportPadding,
          window.innerWidth - menuWidth - viewportPadding,
        ),
      );
      setMenuStyle({
        top: rect.top - 4,
        left,
        width: menuWidth,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
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
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all",
          "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
          disabled && "cursor-not-allowed opacity-50",
          isOpen && "bg-white/10 text-white",
        )}
        title="预设提示词"
      >
        <IconBook2 size={14} />
        <span>预设</span>
      </button>
      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            className="z-9999 overflow-hidden rounded-lg border-white/10 bg-[#1a1a1c] shadow-xl animate-in fade-in slide-in-from-bottom-1 duration-200"
            style={{
              position: "fixed",
              left: menuStyle.left,
              top: menuStyle.top,
              width: menuStyle.width,
              transform: "translateY(-100%)",
            }}
          >
            <div className="max-h-60 overflow-y-auto py-1">
              {presets.length === 0 ? (
                <div className="px-3 py-2 text-center text-xs text-white/40">
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
                          className="w-full cursor-pointer px-3 py-2 text-left hover:bg-white/5"
                          onClick={() => handleSelect(preset)}
                        >
                          <div className="truncate text-sm text-white/80">
                            {preset.name}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        align="end"
                        sideOffset={8}
                        className="max-w-64 whitespace-normal wrap-break-word border-white/10 bg-black/90 text-xs text-white/80"
                      >
                        {preset.content}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
              )}
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
};
