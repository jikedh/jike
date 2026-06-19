import { IconTable } from "@tabler/icons-react";
import { type NodeProps, NodeResizer, Position } from "@xyflow/react";
import { memo, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CharacterTableRow, TableNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { ButtonHandle } from "@/components/button-handle";
import { NodeContextMenu } from "@/pages/Canvas/components/NodeContextMenu";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { NodeNameBadge } from "../shared/NodeNameBadge";

const TABLE_COLUMNS = [
  "姓名",
  "基础设定",
  "性格特征",
  "核心动机",
  "核心关系",
  "习惯和兴趣",
];

const FullscreenIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
    <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
    <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
    <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
  </svg>
);

const MinimizeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3v3a2 2 0 0 1-2 2H3"></path>
    <path d="M21 8h-3a2 2 0 0 1-2-2V3"></path>
    <path d="M3 16h3a2 2 0 0 1 2 2v3"></path>
    <path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>
  </svg>
);

const DeleteIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18"></path>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
  </svg>
);

interface EditableCellProps {
  value: string;
  rowIndex: number;
  column: string;
  onUpdate: (rowIndex: number, column: string, value: string) => void;
  maxWidth?: string;
  className?: string;
}

const EditableCell = memo(
  ({
    value,
    rowIndex,
    column,
    onUpdate,
    maxWidth,
    className,
  }: EditableCellProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    const handleDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
        setEditValue(value);
      },
      [value],
    );

    const handleBlur = useCallback(() => {
      setIsEditing(false);
      if (editValue !== value) {
        onUpdate(rowIndex, column, editValue);
      }
    }, [editValue, value, rowIndex, column, onUpdate]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleBlur();
        }
        if (e.key === "Escape") {
          setEditValue(value);
          setIsEditing(false);
        }
      },
      [handleBlur, value],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditValue(e.target.value);
      },
      [],
    );

    if (isEditing) {
      return (
        <textarea
          value={editValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="absolute inset-0 w-full h-full bg-[#1A1A1C] text-[#8D8D8E] text-xs resize-none outline-none border border-[#B43FEB]/50 leading-relaxed p-3 nodrag nopan noflow nowheel"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
            }
            e.stopPropagation();
          }}
        />
      );
    }

    return (
      <div
        className={cn(
          "whitespace-pre-wrap break-words leading-relaxed cursor-text w-full h-full",
          className,
        )}
        style={{ maxWidth: maxWidth || "120px" }}
        onDoubleClick={handleDoubleClick}
      >
        {value || "-"}
      </div>
    );
  },
);

EditableCell.displayName = "EditableCell";

interface TableBodyProps {
  rows: CharacterTableRow[];
  columns: string[];
  onUpdateCell: (rowIndex: number, column: string, value: string) => void;
  maxWidth?: string;
  cellClassName?: string;
}

const TableBody = memo(
  ({
    rows,
    columns,
    onUpdateCell,
    maxWidth,
    cellClassName,
  }: TableBodyProps) => {
    if (!rows || rows.length === 0) {
      return (
        <tr>
          <td
            colSpan={columns.length}
            className={cn(
              "px-3 py-8 text-center text-[#8D8D8E]/50 text-xs",
              cellClassName,
            )}
          >
            暂无数据
          </td>
        </tr>
      );
    }

    return (
      <>
        {rows.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            className="hover:bg-white/[0.03] transition-colors"
          >
            {columns.map((col) => (
              <td
                key={col}
                className={cn(
                  "relative px-3 py-2 border-b border-r border-white/[0.06] text-[#8D8D8E] text-xs align-top",
                  cellClassName,
                )}
              >
                <EditableCell
                  value={row[col as keyof typeof row] || ""}
                  rowIndex={rowIndex}
                  column={col}
                  onUpdate={onUpdateCell}
                  maxWidth={maxWidth}
                />
              </td>
            ))}
          </tr>
        ))}
      </>
    );
  },
);

TableBody.displayName = "TableBody";

export const TableNode = memo(
  ({
    id,
    data,
    selected,
    width,
    height,
    dragging,
  }: NodeProps<TableNodeType>) => {
    const duplicateNode = useCanvasFlowStore((state) => state.duplicateNode);
    const deleteNode = useCanvasFlowStore((state) => state.deleteNode);
    const updateTableNodeData = useCanvasFlowStore(
      (state) => state.updateTableNodeData,
    );
    const updateNodeNickname = useCanvasFlowStore(
      (state) => state.updateNodeNickname,
    );
    const isDragging = Boolean(dragging);
    // 仅订阅与当前节点相关的派生布尔值，避免选中数量变化时所有节点重渲染
    const hasMultipleSelected = useCanvasFlowStore(
      (state) => state.selectedNodesCount > 1,
    );
    const shouldShowToolbar =
      selected && !isDragging && !hasMultipleSelected;

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);

    const handleVisibilityClass = selected
      ? "visible opacity-100"
      : "invisible opacity-0 group-hover/node:visible group-hover/node:opacity-100";

    const { title, rows } = data;
    const nodeLabel = data.nickname ?? title ?? "表格节点";
    const columns = data.columns || TABLE_COLUMNS;

    const handleRenameStart = useCallback(() => {
      if (selected) {
        setIsRenaming(true);
      }
    }, [selected]);

    const handleRename = useCallback(
      (name: string) => {
        updateNodeNickname(id, name);
      },
      [id, updateNodeNickname],
    );

    const handleEditEnd = useCallback(() => setIsRenaming(false), []);

    const nodeIcon = useMemo(() => <IconTable size={14} />, []);

    const toggleFullscreen = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFullscreen(!isFullscreen);
      },
      [isFullscreen],
    );

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteNode(id);
      },
      [deleteNode, id],
    );

    const handleUpdateCell = useCallback(
      (rowIndex: number, column: string, value: string) => {
        // 使用函数式更新避免依赖外部 rows，减少重渲染
        updateTableNodeData(id, ((prevData: any) => {
          const currentRows = prevData.rows || [];
          const newRows = [...currentRows];
          newRows[rowIndex] = {
            ...newRows[rowIndex],
            [column]: value,
          };
          return { rows: newRows };
        }) as (prev: Record<string, unknown>) => Record<string, unknown>);
      },
      [id, updateTableNodeData],
    );

    const fullscreenContent = (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#141418] to-[#0d0d10] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="text-base font-semibold text-white">
            {title || "角色设计表"}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-white/5 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title="退出全屏"
            >
              <MinimizeIcon />
            </button>
            <button
              onClick={handleDelete}
              className="w-8 h-8 rounded-lg bg-white/5 text-white/70 hover:text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors cursor-pointer"
              title="删除"
            >
              <DeleteIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="bg-[#1A1A1C] rounded-lg border border-white/[0.06] overflow-auto min-w-full">
            <table className="border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#1A1A1C]">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 border-b border-r border-white/[0.06] text-[#8D8D8E]/70 font-medium text-sm whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <TableBody
                  rows={rows || []}
                  columns={columns}
                  onUpdateCell={handleUpdateCell}
                  maxWidth="200px"
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    return (
      <>
        {isFullscreen && createPortal(fullscreenContent, document.body)}

        <NodeContextMenu
          onDuplicate={() => duplicateNode(id)}
          onDelete={() => deleteNode(id)}
        >
          <div className="group/node relative">
            <NodeResizer
              isVisible={selected && !isDragging}
              lineClassName="!border !border-[#B43FEB]/50"
              handleClassName="!w-5 !h-5 !bg-transparent !border-0"
            />

            <div
              style={{
                width: width || 700,
                height: height || 350,
              }}
              className={cn(
                "group/card relative flex h-full w-full flex-col rounded-xl border transition-all duration-300 ease-out overflow-hidden",
                selected
                  ? "border-[#B43FEB]/80 shadow-[0_0_25px_rgba(180,63,235,0.4),0_0_50px_rgba(180,63,235,0.15)] ring-1 ring-[#B43FEB]/30 bg-gradient-to-br from-[#141418] to-[#0d0d10]"
                  : "border-white/[0.06] hover:border-white/[0.12] hover:bg-gradient-to-br hover:from-[#18181c] hover:to-[#101014] bg-gradient-to-br from-[#141418] to-[#0d0d10]",
              )}
            >
              <NodeNameBadge
                icon={nodeIcon}
                selected={selected}
                isEditing={isRenaming}
                onEditStart={handleRenameStart}
                onEditEnd={handleEditEnd}
                onRename={handleRename}
              >
                {nodeLabel}
              </NodeNameBadge>

              <ButtonHandle
                type="target"
                position={Position.Left}
                id="input"
                visible
                className={`${handleVisibilityClass}`}
              />

              <ButtonHandle
                type="source"
                position={Position.Right}
                id="output"
                visible
                className={` ${handleVisibilityClass}`}
              />
              {shouldShowToolbar && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                  <button
                    onClick={toggleFullscreen}
                    className="w-7 h-7 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
                    title="全屏"
                  >
                    <FullscreenIcon />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-7 h-7 rounded-lg bg-black/50 text-white/70 hover:text-red-400 hover:bg-red-500/20 flex items-center justify-center backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
                    title="删除"
                  >
                    <DeleteIcon />
                  </button>
                </div>
              )}

              <div className="flex flex-col h-full overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <h3 className="text-sm font-semibold text-white">
                    {title || "角色设计表"}
                  </h3>
                </div>

                <div className="flex-1 overflow-auto p-2 nodrag nopan nowheel">
                  <div className="bg-[#1A1A1C] rounded-lg border border-white/[0.06] overflow-auto min-w-full">
                    <table className="border-collapse text-left">
                      <thead className="sticky top-0 z-10 bg-[#1A1A1C]">
                        <tr>
                          {columns.map((col) => (
                            <th
                              key={col}
                              className="px-3 py-2 border-b border-r border-white/[0.06] text-[#8D8D8E]/70 font-medium text-xs whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <TableBody
                          rows={rows || []}
                          columns={columns}
                          onUpdateCell={handleUpdateCell}
                          maxWidth="120px"
                        />
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </NodeContextMenu>
      </>
    );
  },
);

TableNode.displayName = "TableNode";
