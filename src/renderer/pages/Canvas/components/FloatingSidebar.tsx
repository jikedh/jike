import {
  IconArchive,
  IconDeviceFloppy,
  IconFolders,
  IconList,
  IconPlus,
  IconSettings,
  IconSparkles,
} from "@tabler/icons-react";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "shared/utils/utils";
import useMessage from "@/hooks/useMessage";
import {
  ANNOUNCEMENT_POLL_INTERVAL,
  useAnnouncementStore,
} from "@/stores/announcementStore";
import { SettingsModal } from "./SettingsModal";
import "./floatingSidebar.css";

// ============================================================================
// Types
// ============================================================================

export interface FloatingSidebarItem {
  id: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  role?: "primary" | "default" | "bottom";
  children?: { id: string; label: string }[];
}

export interface FloatingSidebarProps {
  items?: FloatingSidebarItem[];
  onAction?: (id: string) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ITEMS: FloatingSidebarItem[] = [
  {
    id: "create",
    label: "新增节点",
    icon: <IconPlus stroke={2.5} size={22} />,
    role: "primary",
  },
  {
    id: "efficiency-tools",
    label: "效率工具",
    icon: <IconSparkles size={20} />,
    children: [
      { id: "script-outline", label: "剧本大纲" },
      { id: "script-hierarchy", label: "剧本分级" },
      { id: "character-design", label: "角色设计" },
      { id: "storyboard-design", label: "分镜图设计" },
      { id: "storyboard-breakdown", label: "分镜图拆解" },
      { id: "storyboard-video", label: "分镜视频生成" },
      { id: "drama-analysis", label: "剧目分析" },
    ],
  },
  {
    id: "model-tasks",
    label: "模型任务列表",
    icon: <IconList size={20} />,
    children: [
      { id: "video-model-tasks", label: "视频模型任务列表" },
      { id: "image-model-tasks", label: "图片模型任务列表" },
    ],
  },
  {
    id: "asset-library",
    label: "资产库",
    icon: <IconArchive size={20} />,
  },
  {
    id: "personal-asset-library",
    label: "个人素材库",
    icon: <IconFolders size={20} />,
  },
  {
    id: "save",
    label: "保存画布",
    icon: <IconDeviceFloppy size={20} />,
    role: "bottom",
  },
  {
    id: "settings",
    label: "设置",
    icon: <IconSettings size={20} />,
    role: "bottom",
  },
];

// ============================================================================
// Helpers
// ============================================================================

const filterItemsByRole = (
  items: FloatingSidebarItem[],
  role: FloatingSidebarItem["role"],
): FloatingSidebarItem[] => {
  if (role === "default") {
    return items.filter((item) => !item.role || item.role === "default");
  }
  return items.filter((item) => item.role === role);
};

// ============================================================================
// Components
// ============================================================================

/**
 * 画布悬浮侧边栏
 *
 * Features:
 * - 分组布局：顶部主操作、中部工具组、底部次级操作
 * - 支持子菜单展开
 * - 紫色主题风格
 */
export const FloatingSidebar = ({
  items = DEFAULT_ITEMS,
  onAction,
  className,
}: FloatingSidebarProps) => {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hasUnreadAnnouncements = useAnnouncementStore(
    (state) => state.hasUnreadAnnouncements,
  );
  const fetchAnnouncements = useAnnouncementStore(
    (state) => state.fetchAnnouncements,
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        expandedItemId &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setExpandedItemId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [expandedItemId]);

  useEffect(() => {
    void fetchAnnouncements();
    const timer = window.setInterval(() => {
      void fetchAnnouncements();
    }, ANNOUNCEMENT_POLL_INTERVAL);

    return () => {
      window.clearInterval(timer);
    };
  }, [fetchAnnouncements]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { warning } = useMessage();

  // 分组
  const primaryItems = filterItemsByRole(items, "primary");
  const defaultItems = filterItemsByRole(items, "default");
  const bottomItems = filterItemsByRole(items, "bottom");

  // 处理按钮点击
  const handleClick = useCallback(
    (item: FloatingSidebarItem, event: ReactMouseEvent<HTMLButtonElement>) => {
      if (item.disabled) return;

      if (item.id === "settings") {
        setExpandedItemId(null);
        setIsSettingsOpen(true);
        return;
      }

      if (item.id === "create") {
        setExpandedItemId(null);
        const rect = event.currentTarget.getBoundingClientRect();
        const x =
          event.clientX || Math.round(rect.left + Math.max(0, rect.width) / 2);
        const y =
          event.clientY || Math.round(rect.top + Math.max(0, rect.height) / 2);
        window.dispatchEvent(
          new CustomEvent("jike:open-canvas-context-menu", {
            detail: { x, y, mode: "create" },
          }),
        );
        return;
      }

      if (item.children) {
        setExpandedItemId((prev) => (prev === item.id ? null : item.id));
      } else {
        item.onClick?.();
        onAction?.(item.id);
      }
    },
    [onAction],
  );

  // 处理子菜单项点击
  const handleSubItemClick = useCallback(
    (subId: string) => {
      const isDevFeature =
        subId.startsWith("script-") ||
        subId.startsWith("character-") ||
        subId.startsWith("storyboard-") ||
        subId === "drama-analysis";

      if (isDevFeature) {
        warning("该功能正在开发中", "敬请期待");
      } else {
        onAction?.(subId);
      }
      setExpandedItemId(null);
    },
    [onAction, warning],
  );

  return (
    <>
      <aside
        ref={sidebarRef}
        className={cn("canvas-floating-sidebar", className)}
        aria-label="画布悬浮侧边栏"
      >
        {/* 顶部主操作 */}
        <ItemGroup
          items={primaryItems}
          expandedItemId={expandedItemId}
          onItemClick={handleClick}
          onSubItemClick={handleSubItemClick}
        />

        {/* 中部常规操作 */}
        <ItemGroup
          items={defaultItems}
          expandedItemId={expandedItemId}
          onItemClick={handleClick}
          onSubItemClick={handleSubItemClick}
        />

        {/* 底部次级操作 */}
        <div className="canvas-floating-sidebar__group canvas-floating-sidebar__group--bottom">
          <ItemGroup
            items={bottomItems}
            expandedItemId={expandedItemId}
            hasUnreadAnnouncements={hasUnreadAnnouncements}
            onItemClick={handleClick}
            onSubItemClick={handleSubItemClick}
          />
        </div>
      </aside>

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

interface ItemGroupProps {
  items: FloatingSidebarItem[];
  expandedItemId: string | null;
  hasUnreadAnnouncements?: boolean;
  onItemClick: (
    item: FloatingSidebarItem,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onSubItemClick: (subId: string) => void;
}

const ItemGroup = ({
  items,
  expandedItemId,
  hasUnreadAnnouncements = false,
  onItemClick,
  onSubItemClick,
}: ItemGroupProps) => (
  <div className="canvas-floating-sidebar__group">
    {items.map((item) => (
      <SidebarButton
        key={item.id}
        item={item}
        isExpanded={expandedItemId === item.id}
        showUnreadDot={item.id === "settings" && hasUnreadAnnouncements}
        onClick={(event) => onItemClick(item, event)}
        onSubItemClick={onSubItemClick}
      />
    ))}
  </div>
);

interface SidebarButtonProps {
  item: FloatingSidebarItem;
  isExpanded: boolean;
  showUnreadDot?: boolean;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSubItemClick: (subId: string) => void;
}

const SidebarButton = ({
  item,
  isExpanded,
  showUnreadDot = false,
  onClick,
  onSubItemClick,
}: SidebarButtonProps) => (
  <div className="relative">
    <button
      type="button"
      title={item.label}
      aria-label={item.label}
      className={cn(
        "noflow nopan nodelete nodrag canvas-floating-sidebar__button",
        item.id === "create" && "canvas-floating-sidebar__button--primary",
        item.active && "canvas-floating-sidebar__button--active",
        item.disabled && "canvas-floating-sidebar__button--disabled",
      )}
      disabled={item.disabled}
      onClick={onClick}
    >
      {item.icon}
      {showUnreadDot && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#121214]" />
      )}
    </button>

    {/* 子菜单 */}
    {item.children && isExpanded && (
      <SubMenu items={item.children} onItemClick={onSubItemClick} />
    )}
  </div>
);

interface SubMenuProps {
  items: { id: string; label: string }[];
  onItemClick: (id: string) => void;
}

const SubMenu = ({ items, onItemClick }: SubMenuProps) => (
  <div className="absolute left-full top-0 ml-3 min-w-max py-1 glass-panel animate-in fade-in slide-in-from-left-1 duration-150">
    {items.map((subItem) => (
      <button
        key={subItem.id}
        type="button"
        className="block w-full text-left px-4 py-2 text-sm transition-colors noflow nopan nodelete nodrag"
        onClick={() => onItemClick(subItem.id)}
      >
        {subItem.label}
      </button>
    ))}
  </div>
);
