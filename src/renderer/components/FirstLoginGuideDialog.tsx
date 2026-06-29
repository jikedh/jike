import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  AtSign,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 单项定义：key 用于区分点击行为，icon 用于视觉展示
export type GuideItem = {
  key: "username";
  label: string;
  reason: string;
  icon: React.ComponentType<{ className?: string }>;
};

// 引导项静态配置（按显示顺序）
const ITEM_META: Record<GuideItem["key"], Omit<GuideItem, "key">> = {
  username: {
    label: "自定义用户名",
    reason: "尚未设置自定义用户名",
    icon: AtSign,
  },
};

interface FirstLoginGuideDialogProps {
  open: boolean;
  // 传入待补全的项；空数组表示无未完成项
  pending: GuideItem["key"][];
  // 用户点击"去设置"或选择跳过时关闭弹窗
  onClose: () => void;
}

// 构造引导项集合
export const buildGuideItems = (
  pending: GuideItem["key"][],
): GuideItem[] =>
  pending.map((key) => ({
    key,
    ...ITEM_META[key],
  }));

// 首次登录引导弹窗：强制用户关注待补全项，引导跳转 Profile 完成设置
export const FirstLoginGuideDialog = ({
  open,
  pending,
  onClose,
}: FirstLoginGuideDialogProps) => {
  const navigate = useNavigate();

  // 空数组时直接不渲染（避免无效空态）
  if (pending.length === 0) return null;

  const items = buildGuideItems(pending);

  // 处理单项点击：关闭主弹窗 -> 跳转 Profile -> 通过 URL 参数告知 Profile 打开用户名弹窗
  const handleGoToSettle = (key: GuideItem["key"]) => {
    onClose();
    // 当前必填项只有 username，URL 带 focus=username 让 Profile 自动展开。
    navigate(`/profile?focus=${key}`);
  };

  return (
    <Dialog
      open={open}
      // 强制引导：禁止点击遮罩或 ESC 关闭，仅可由"去设置"或"稍后再说"触发
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="w-[min(520px,94vw)] border border-white/10 bg-[#121214] p-0 text-white"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-white/5 bg-gradient-to-r from-[#B43FEB]/15 via-[#2b5aed]/10 to-transparent px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-base text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B43FEB]/20 text-[#B43FEB]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">完善账号信息</span>
              <span className="text-[11px] font-normal text-white/50">
                检测到您的账号尚未设置自定义用户名，建议立即完善
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <section className="space-y-2 px-6 py-5">
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-[#B43FEB]/20 bg-[#B43FEB]/5 px-3 py-2 text-[12px] leading-relaxed text-white/70">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B43FEB]" />
            <span>
              自定义用户名可用于账号识别与登录，设置后更便于后续使用。
            </span>
          </div>

          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.key}
                  className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-colors hover:border-[#B43FEB]/30 hover:bg-[#B43FEB]/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/70">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-white/90">{item.label}</span>
                    <span className="mt-0.5 text-[11px] text-white/40">
                      {item.reason}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="blue"
                    onClick={() => handleGoToSettle(item.key)}
                    className="shrink-0"
                  >
                    去设置
                  </Button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-4">
            <span className="flex items-center gap-1 text-[11px] text-white/40">
              <CheckCircle2 className="h-3 w-3" />
              完成设置后将自动消失
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white/60 hover:text-white"
            >
              稍后再说
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
};

export default FirstLoginGuideDialog;
