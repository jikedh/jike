import { IconHelpCircle, IconMap2 } from "@tabler/icons-react";
import { type ReactFlowInstance, useReactFlow, useStore } from "@xyflow/react";
import { Grid3X3, Maximize2 } from "lucide-react";
import { type ChangeEvent, useEffect, useState } from "react";
import { cn } from "shared/utils/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";

type CanvasChatToolbarProps = {
  isMiniMapVisible: boolean;
  onToggleMiniMap: () => void;
};

const TOOLBAR_BUTTON_CLASSNAME =
  "flex h-9 w-9 items-center justify-center rounded-lg border text-white/70 transition-colors";

const clampZoom = (zoom: number) => Math.min(2, Math.max(0.05, zoom));

const setFlowZoom = (
  reactFlowInstance: ReactFlowInstance,
  zoom: number,
  duration?: number,
) => {
  const { x, y } = reactFlowInstance.getViewport();
  reactFlowInstance.setViewport(
    {
      x,
      y,
      zoom: clampZoom(Number(zoom.toFixed(2))),
    },
    { duration },
  );
};

export const CanvasChatToolbar = ({
  isMiniMapVisible,
  onToggleMiniMap,
}: CanvasChatToolbarProps) => {
  const reactFlowInstance = useReactFlow();
  const snapToGrid = useChatSettingsStore((state) => state.snapToGrid);
  const setSnapToGrid = useChatSettingsStore((state) => state.setSnapToGrid);
  // 使用 useStore 订阅视口缩放变化，实时更新进度条
  const rawZoom = useStore((s) => s.transform[2]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);

  // 当 rawZoom 变化时更新 zoomLevel
  useEffect(() => {
    setZoomLevel(clampZoom(rawZoom));
  }, [rawZoom]);

  const handleFitView = () => {
    reactFlowInstance.fitView({ padding: 0.1, duration: 300 });
  };

  const handleZoomChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextZoom = clampZoom(Number(event.target.value));
    setZoomLevel(nextZoom);
    setFlowZoom(reactFlowInstance, nextZoom);
  };

  return (
    <>
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-xl border border-white/10 bg-black/80 px-2.5 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <button
          type="button"
          title="切换小地图"
          className={cn(
            TOOLBAR_BUTTON_CLASSNAME,
            isMiniMapVisible
              ? "border-[#B43FEB]/40 bg-[#B43FEB]/15 text-[#d793ff]"
              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
          )}
          onClick={onToggleMiniMap}
        >
          <IconMap2 size={16} />
        </button>

        <button
          type="button"
          title="切换网格吸附"
          className={cn(
            TOOLBAR_BUTTON_CLASSNAME,
            snapToGrid
              ? "border-[#B43FEB]/40 bg-[#B43FEB]/15 text-[#d793ff]"
              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
          )}
          onClick={() => setSnapToGrid(!snapToGrid)}
        >
          <Grid3X3 size={16} />
        </button>

        <button
          type="button"
          title="自适应窗口"
          className={cn(
            TOOLBAR_BUTTON_CLASSNAME,
            "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
          )}
          onClick={handleFitView}
        >
          <Maximize2 size={16} />
        </button>

        <div className="flex min-w-[156px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
          <input
            type="range"
            min={0.05}
            max={2}
            step={0.05}
            value={zoomLevel}
            onChange={handleZoomChange}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/10 [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-[#B43FEB] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(180,63,235,0.45)]"
          />
          <span className="w-9 text-right text-[11px] text-white/60">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        <button
          type="button"
          title="帮助"
          className={cn(
            TOOLBAR_BUTTON_CLASSNAME,
            "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
          )}
          onClick={() => setHelpOpen(true)}
        >
          <IconHelpCircle size={16} />
        </button>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="w-[400px] max-w-[calc(100vw-32px)] border-white/10 bg-[#0a0a0f] text-white">
          <DialogHeader>
            <DialogTitle>帮助</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-white/70">功能正在开发当中</div>
        </DialogContent>
      </Dialog>
    </>
  );
};
