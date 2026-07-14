import { IconLayersLinked } from "@tabler/icons-react";
import { type NodeProps, Position } from "@xyflow/react";
import { memo, useCallback } from "react";
import type { DirectorDeskNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import { ButtonHandle } from "@/components/button-handle";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";

export const DIRECTOR_DESK_OPEN_EVENT = "canvas:open-director-desk";

/** 导演台节点只负责入口展示，通过 DOM 事件通知画布容器打开独立工作区。 */
export const DirectorDeskNode = memo(
    ({ id, selected }: NodeProps<DirectorDeskNodeType>) => {
        const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
        const deleteNode = useCanvasFlowStore((state) => state.deleteNode);

        const handleOpen = useCallback(
            (event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
                window.dispatchEvent(
                    new CustomEvent(DIRECTOR_DESK_OPEN_EVENT, { detail: { nodeId: id } }),
                );
            },
            [id],
        );

        const handleVisibilityClass = selected
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100";

        return (
            <NodeContextMenu
                onDuplicate={() => duplicateNode(id)}
                onDelete={() => deleteNode(id)}
            >
                <div className="group/node">
                    <div
                        className={cn(
                            "group/card relative flex size-80 flex-col overflow-hidden rounded-xl border bg-[#202020] text-white shadow-[0_14px_32px_rgba(0,0,0,0.24)]",
                            selected
                                ? "border-[#b43feb] ring-1 ring-[#b43feb]/60"
                                : "border-white/45",
                        )}
                    >
                        <ButtonHandle
                            type="target"
                            position={Position.Left}
                            id="input"
                            visible
                            className={handleVisibilityClass}
                        />
                        <ButtonHandle
                            type="source"
                            position={Position.Right}
                            id="output"
                            visible
                            className={handleVisibilityClass}
                        />

                        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-sm font-medium">
                            <IconLayersLinked size={16} className="text-white/70" />
                            <span>导演台</span>
                        </div>

                        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-6 pb-7 text-center">
                            <IconLayersLinked size={42} strokeWidth={1.45} className="text-white/35" />
                            <div className="text-sm font-medium text-white/90">
                                在3D空间中搭建场景并进行多视角截图
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                className="nodrag nopan rounded-lg bg-white/15 text-white hover:bg-white/25"
                                onClick={handleOpen}
                            >
                                打开导演台
                            </Button>
                        </div>
                    </div>
                </div>
            </NodeContextMenu>
        );
    },
);

DirectorDeskNode.displayName = "DirectorDeskNode";
