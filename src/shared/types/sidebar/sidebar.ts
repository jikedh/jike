import type { ReactNode } from "react";

// 侧边栏上下文值类型
export type SidebarContextValue = {
  // 当前激活的导航项ID
  activeId: string | null;
  // 设置激活项
  setActiveId: (id: string) => void;
  // 是否折叠
  collapsed: boolean;
  // 切换折叠状态
  toggleCollapsed: () => void;
};

// 导航项属性
export type SidebarNavItemProps = {
  // 唯一标识
  id: string;
  // 图标
  icon?: ReactNode;
  // 标签文本
  label: string;
  // 点击回调
  onClick?: () => void;
  // 自定义类名
  classNames?: {
    root?: string;
    icon?: string;
    label?: string;
  };
};

// 分组属性
export type SidebarGroupProps = {
  children: ReactNode;
  // 自定义类名
  classNames?: {
    root?: string;
  };
};

// 分组标题属性
export type SidebarGroupLabelProps = {
  children: ReactNode;
  // 自定义类名
  classNames?: {
    root?: string;
  };
};

// 分组内容属性
export type SidebarGroupContentProps = {
  children: ReactNode;
  // 自定义类名
  classNames?: {
    root?: string;
  };
};

// 根容器属性
export type SidebarRootProps = {
  children: ReactNode;
  // 初始激活项ID
  defaultActiveId?: string;
  // 自定义类名
  classNames?: {
    root?: string;
  };
};

// 导航区域属性
export type SidebarNavProps = {
  children: ReactNode;
  // 自定义类名
  classNames?: {
    root?: string;
  };
};

// 底部区域属性
export type SidebarFooterProps = {
  children: ReactNode;
  // 自定义类名
  classNames?: {
    root?: string;
  };
};

// Logo区域属性
export type SidebarLogoProps = {
  children: ReactNode;
  // 自定义类名
  classNames?: {
    root?: string;
  };
};
