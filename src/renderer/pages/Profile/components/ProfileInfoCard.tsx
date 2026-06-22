import { ChevronRight, Mail, Phone, Smile, type LucideIcon } from "lucide-react";
import { cn } from "shared/utils/utils";

export interface ProfileInfoItem {
    key: string;
    icon: LucideIcon;
    label: string;
    value: string;
    // 是否可编辑（仅展示静态行为，点击通过 onAction 抛出）
    editable?: boolean;
    actionText?: string;
}

interface ProfileInfoCardProps {
    items: ProfileInfoItem[];
    onAction?: (key: string) => void;
}

// 信息列表卡片：昵称 / 邮箱 / 手机号 等，统一行式布局
export const ProfileInfoCard = ({ items, onAction }: ProfileInfoCardProps) => (
    <ul className="overflow-hidden rounded-2xl border border-white/5 bg-[#121214]">
        {items.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === items.length - 1;
            return (
                <li
                    key={item.key}
                    className={cn(
                        "group flex items-center gap-4 px-5 py-4 transition-colors",
                        !isLast && "border-b border-white/5",
                        item.editable && "cursor-pointer hover:bg-white/[0.03]",
                    )}
                    onClick={() => item.editable && onAction?.(item.key)}
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/70">
                        <Icon className="h-4 w-4" />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-xs text-white/40">{item.label}</span>
                        <span className="mt-0.5 truncate text-sm text-white/90">
                            {item.value}
                        </span>
                    </div>

                    {item.editable && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-white/40 transition-colors group-hover:text-white/80">
                            {item.actionText ?? "修改"}
                            <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                    )}
                </li>
            );
        })}
    </ul>
);

// 默认图标组合便于 Profile 页面直接复用
export const PROFILE_INFO_ICONS = {
    nickname: Smile,
    email: Mail,
    phone: Phone,
};
