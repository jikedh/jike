import { memo } from "react";
import { IconCopy, IconTrash } from "@tabler/icons-react";
import type { XxxGenerationNode } from "shared/types/flow";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

interface XxxToolbarProps {
  id: string;
  data: XxxGenerationNode;
}

const XxxToolbar = memo(function XxxToolbar({ id, data }: XxxToolbarProps) {
  const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
  const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[#121214] border-b border-white/10">
      <span className="text-white/70 text-sm font-medium">Xxx 节点</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => duplicateNode(id)}
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <IconCopy size={14} />
        </button>
        <button
          onClick={() => deleteNode(id)}
          className="p-1.5 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
        >
          <IconTrash size={14} />
        </button>
      </div>
    </div>
  );
});

export { XxxToolbar };
