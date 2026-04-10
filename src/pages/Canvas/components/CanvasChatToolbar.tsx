import { IconMessageCircle } from "@tabler/icons-react";

import { cn } from "@/utils/utils";

type CanvasChatToolbarProps = {
  onOpenChat: () => void;
  isChatOpen?: boolean;
};

export const CanvasChatToolbar = ({
  onOpenChat,
  isChatOpen,
}: CanvasChatToolbarProps) => {
  return (
    <div className="fixed right-6 bottom-6 z-50">
      <button
        type="button"
        title="打开 AI 对话"
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_10px_24px_rgba(37,99,235,0.45)] transition-transform hover:scale-105",
          isChatOpen ? "bg-blue-500" : "bg-blue-600",
        )}
        onClick={onOpenChat}
      >
        <IconMessageCircle size={22} />
      </button>
    </div>
  );
};
