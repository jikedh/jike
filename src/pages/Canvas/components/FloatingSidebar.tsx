import {
    IconDeviceFloppy,
    IconHistory,
    IconLayoutGrid,
    IconMessageCircle,
    IconPlus,
    IconRefresh,
    IconSettings,
    IconSparkles,
    IconTool,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { cn } from '@/utils/utils'

import './floatingSidebar.css'
import useMessage from '@/hooks/useMessage'
import { SettingsModal } from './SettingsModal'

// 侧边栏动作项类型
export type FloatingSidebarItem = {
    id: string
    label: string
    icon: ReactNode
    onClick?: () => void
    disabled?: boolean
    active?: boolean
    role?: 'primary' | 'default' | 'bottom'
    children?: { id: string; label: string }[]
}

// 组件 Props：支持外部注入动作项与统一动作回调，当前以占位逻辑为主。
export type FloatingSidebarProps = {
    items?: FloatingSidebarItem[]
    onAction?: (id: string) => void
    className?: string
}

// 默认占位动作：首版使用 6 个常用图标动作，分为顶部主操作、中部工具组、底部次级操作。
const defaultItems: FloatingSidebarItem[] = [
    {
        id: 'create',
        label: '新增节点',
        icon: <IconPlus stroke={2.5} size={22} />,
        role: 'primary',
        children: [
            { id: 'create-note', label: '便签' },
            { id: 'create-image', label: '图片' },
            { id: 'create-video', label: '视频' },
        ],
    },
    {
        id: 'assistant',
        label: '智能助手',
        icon: <IconSparkles size={20} />,
        children: [
            { id: 'novel-to-script-agent', label: '小说转剧本智能助手' },
            { id: 'short-video-script-agent', label: '爆款短视频脚本智能助手' },
        ],
    },
    {
        id: 'efficiency-tools',
        label: '效率工具',
        icon: <IconTool size={20} />,
        children: [
            { id: 'script-outline', label: '剧本大纲' },
            { id: 'script-hierarchy', label: '剧本分级' },
            { id: 'character-design', label: '角色设计' },
            { id: 'storyboard-design', label: '分镜图设计' },
            { id: 'storyboard-breakdown', label: '分镜图拆解' },
            { id: 'storyboard-video', label: '分镜视频生成' },
            { id: 'drama-analysis', label: '剧目分析' },
        ],
    },
    // {
    //     id: 'layout',
    //     label: '布局工具',
    //     icon: <IconLayoutGrid size={20} />,
    // },
    // {
    //     id: 'comment',
    //     label: '注释面板',
    //     icon: <IconMessageCircle size={20} />,
    // },
    // {
    //     id: 'history',
    //     label: '历史记录',
    //     icon: <IconHistory size={20} />,
    // },
    {
        id: 'save',
        label: '保存画布',
        icon: <IconDeviceFloppy size={20} />,
        role: 'bottom',
    },
    {
        id: 'reset',
        label: '重置画布',
        icon: <IconRefresh size={20} />,
        role: 'bottom',
    },
    {
        id: 'settings',
        label: '设置',
        icon: <IconSettings size={20} />,
        role: 'bottom',
    },
]

// 过滤工具函数：按角色拆分渲染区域，保持结构与视觉层级清晰。
const getItemsByRole = (items: FloatingSidebarItem[], role: FloatingSidebarItem['role']) => {
    if (role === 'default') {
        return items.filter((item) => !item.role || item.role === 'default')
    }

    return items.filter((item) => item.role === role)
}

// 悬浮侧边栏组件：只负责视觉与占位回调，不耦合业务状态。
export const FloatingSidebar = ({ items = defaultItems, onAction, className }: FloatingSidebarProps) => {
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const { warning } = useMessage()

    // 顶部主操作。
    const primaryItems = getItemsByRole(items, 'primary')
    // 中部常规操作。
    const defaultRoleItems = getItemsByRole(items, 'default')
    // 底部次级操作。
    const bottomItems = getItemsByRole(items, 'bottom')

    // 占位点击处理：优先调用 item.onClick，其次派发统一 onAction。
    const handleClick = (item: FloatingSidebarItem) => {
        if (item.disabled) {
            return
        }

        if (item.id === 'settings') {
            setExpandedItemId(null)
            setIsSettingsOpen(true)
            return
        }

        if (item.children) {
            // 如果有子菜单，切换展开状态
            setExpandedItemId(expandedItemId === item.id ? null : item.id)
        } else {
            item.onClick?.()
            onAction?.(item.id)
        }
    }

    // 处理子菜单项点击
    const handleSubItemClick = (subId: string) => {
        // 效率工具的子选项显示开发中提示
        if (subId.startsWith('script-') || subId.startsWith('character-') || 
            subId.startsWith('storyboard-') || subId === 'drama-analysis') {
            warning('该功能正在开发中', '敬请期待')
            setExpandedItemId(null)
            return
        }
        
        onAction?.(subId)
        setExpandedItemId(null)
    }

    // 渲染菜单项
    const renderMenuItems = (itemsList: FloatingSidebarItem[]) => {
        return itemsList.map((item) => (
            <div key={item.id} className="relative">
                <button
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    className={cn(
                        'noflow nopan nodelete nodrag canvas-floating-sidebar__button',
                        item.id === 'create' && 'canvas-floating-sidebar__button--primary',
                        item.active && 'canvas-floating-sidebar__button--active',
                        item.disabled && 'canvas-floating-sidebar__button--disabled',
                    )}
                    disabled={item.disabled}
                    onClick={() => handleClick(item)}
                >
                    {item.icon}
                </button>

                {/* 子菜单 */}
                {item.children && expandedItemId === item.id && (
                    <div className="absolute left-full top-0 ml-4 min-w-max py-1 glass-panel">
                        {item.children.map((subItem) => (
                            <button
                                key={subItem.id}
                                type="button"
                                className="block w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-slate-700 transition-colors noflow nopan nodelete nodrag"
                                onClick={() => handleSubItemClick(subItem.id)}
                            >
                                {subItem.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        ))
    }

    return (
        <>
            <aside className={cn('canvas-floating-sidebar glass-panel', className)} aria-label="画布悬浮侧边栏">
                <div className="canvas-floating-sidebar__group canvas-floating-sidebar__group--primary">
                    {renderMenuItems(primaryItems)}
                </div>

                <div className="canvas-floating-sidebar__group">
                    {renderMenuItems(defaultRoleItems)}
                </div>

                <div className="canvas-floating-sidebar__group canvas-floating-sidebar__group--bottom">
                    {renderMenuItems(bottomItems)}
                </div>
            </aside>

            <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    )
}
