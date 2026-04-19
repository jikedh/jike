import { memo, useCallback, useState } from "react";
import { cn } from "shared/utils/utils";

interface NicknameEditorProps {
  nickname: string;
  isSelected: boolean;
  onSave: (nickname: string) => void;
  className?: string;
}

/**
 * 节点昵称编辑器组件
 * - 显示节点的 nickname，支持点击编辑
 * - 仅在节点被选中时允许编辑
 * - Enter 保存，Escape 取消，Blur 保存
 */
export const NicknameEditor = memo(
  ({
    nickname,
    isSelected,
    onSave,
    className,
  }: NicknameEditorProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(nickname);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSelected) {
          setIsEditing(true);
          setEditValue(nickname);
        }
      },
      [isSelected, nickname],
    );

    const handleBlur = useCallback(() => {
      setIsEditing(false);

      const normalizedEditValue = editValue.trim();
      const normalizedNickname = nickname.trim();

      if (normalizedEditValue !== normalizedNickname) {
        onSave(normalizedEditValue);
      }
    }, [editValue, nickname, onSave]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          handleBlur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setEditValue(nickname);
          setIsEditing(false);
        }
      },
      [handleBlur, nickname],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditValue(e.target.value);
      },
      [],
    );

    if (isEditing) {
      return (
        <input
          type="text"
          value={editValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className={cn(
            "nodrag nopan nowheel bg-transparent text-white text-xs font-medium outline-none border border-[#B43FEB]/50 rounded px-2 py-1 w-16",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "text-white text-xs font-medium px-2 py-1 rounded transition-colors",
          isSelected
            ? "cursor-pointer bg-[#B43FEB]/20 hover:bg-[#B43FEB]/30"
            : "cursor-default bg-white/5",
          className,
        )}
      >
        {nickname || "-"}
      </button>
    );
  },
);

NicknameEditor.displayName = "NicknameEditor";
