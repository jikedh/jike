import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface PasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface FieldConfig {
    key: "current" | "next" | "confirm";
    label: string;
    placeholder: string;
}

const FIELDS: FieldConfig[] = [
    { key: "current", label: "当前密码", placeholder: "请输入当前登录密码" },
    { key: "next", label: "新密码", placeholder: "8-20 位，包含字母与数字" },
    { key: "confirm", label: "确认新密码", placeholder: "再次输入新密码" },
];

const INITIAL_VALUES = { current: "", next: "", confirm: "" } as const;

// 密码设置弹窗（静态交互，仅做基础校验提示）
export const PasswordDialog = ({ open, onOpenChange }: PasswordDialogProps) => {
    const [values, setValues] = useState<Record<string, string>>(INITIAL_VALUES);
    const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
    const [submitting, setSubmitting] = useState(false);

    // 关闭时重置内部状态，避免下次打开残留
    useEffect(() => {
        if (!open) {
            setValues(INITIAL_VALUES);
            setVisibleFields({});
            setSubmitting(false);
        }
    }, [open]);

    const handleChange = (key: string, value: string) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    const toggleVisible = (key: string) => {
        setVisibleFields((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubmit = async () => {
        if (!values.current || !values.next || !values.confirm) {
            toast.error("请完整填写所有密码字段");
            return;
        }
        if (values.next.length < 8 || values.next.length > 20) {
            toast.error("新密码长度需在 8-20 位之间");
            return;
        }
        if (values.next !== values.confirm) {
            toast.error("两次输入的新密码不一致");
            return;
        }
        if (values.next === values.current) {
            toast.error("新密码不能与当前密码相同");
            return;
        }

        // 静态 mock：模拟一次网络请求
        setSubmitting(true);
        await new Promise((resolve) => setTimeout(resolve, 600));
        setSubmitting(false);
        toast.success("密码已更新");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[min(460px,92vw)] border border-white/10 bg-[#121214] p-0 text-white">
                <DialogHeader className="border-b border-white/5 bg-[#18181b] px-5 py-4">
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <KeyRound className="h-4.5 w-4.5 text-[#B43FEB]" />
                        修改登录密码
                    </DialogTitle>
                </DialogHeader>

                <section className="space-y-4 px-5 py-5">
                    {FIELDS.map((field) => {
                        const visible = !!visibleFields[field.key];
                        return (
                            <div key={field.key} className="flex flex-col gap-1.5">
                                <label className="text-xs text-white/50">{field.label}</label>
                                <div className="relative">
                                    <input
                                        type={visible ? "text" : "password"}
                                        value={values[field.key] ?? ""}
                                        onChange={(e) => handleChange(field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                        className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 pr-10 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#B43FEB]/60"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleVisible(field.key)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
                                        title={visible ? "隐藏" : "显示"}
                                    >
                                        {visible ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    <p className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-white/40">
                        建议使用字母 + 数字组合，定期更换密码可提升账号安全。
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            取消
                        </Button>
                        <Button
                            variant="blue"
                            size="sm"
                            loading={submitting}
                            onClick={handleSubmit}
                        >
                            保存修改
                        </Button>
                    </div>
                </section>
            </DialogContent>
        </Dialog>
    );
};
