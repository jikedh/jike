import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export type ProfileEditField = "nickname" | "email" | "mobile";

interface ProfileEditDialogProps {
    open: boolean;
    field: ProfileEditField | null;
    initialValue: string;
    onOpenChange: (open: boolean) => void;
    onSubmit: (field: ProfileEditField, value: string) => Promise<void>;
}

const FIELD_META: Record<
    ProfileEditField,
    {
        title: string;
        label: string;
        placeholder: string;
        inputType: string;
        validate: (value: string) => string | null;
    }
> = {
    nickname: {
        title: "修改昵称",
        label: "昵称",
        placeholder: "请输入昵称（1-30 字符）",
        inputType: "text",
        validate: (value) => {
            const trimmed = value.trim();
            if (!trimmed) return "昵称不能为空";
            if ([...trimmed].length > 30) return "昵称长度不能超过 30 个字符";
            return null;
        },
    },
    email: {
        title: "修改邮箱",
        label: "邮箱",
        placeholder: "name@example.com",
        inputType: "email",
        validate: (value) => {
            if (!value) return null; // 允许清空
            const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            return ok ? null : "邮箱格式不正确";
        },
    },
    mobile: {
        title: "修改手机号",
        label: "手机号",
        placeholder: "请输入 11 位手机号",
        inputType: "tel",
        validate: (value) => {
            if (!value) return null; // 允许清空
            return /^1\d{10}$/.test(value) ? null : "手机号格式不正确";
        },
    },
};

// 通用单字段编辑弹窗，由父组件控制保存逻辑
export const ProfileEditDialog = ({
    open,
    field,
    initialValue,
    onOpenChange,
    onSubmit,
}: ProfileEditDialogProps) => {
    const [value, setValue] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setValue(initialValue ?? "");
            setSubmitting(false);
        }
    }, [open, initialValue]);

    if (!field) return null;
    const meta = FIELD_META[field];

    const handleSubmit = async () => {
        const error = meta.validate(value);
        if (error) {
            toast.error(error);
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit(field, value.trim());
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err?.message || "保存失败，请重试");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[min(420px,92vw)] border border-white/10 bg-[#121214] p-0 text-white">
                <DialogHeader className="border-b border-white/5 bg-[#18181b] px-5 py-4">
                    <DialogTitle className="text-white">{meta.title}</DialogTitle>
                </DialogHeader>

                <section className="space-y-4 px-5 py-5">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-white/50">{meta.label}</label>
                        <input
                            type={meta.inputType}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={meta.placeholder}
                            autoFocus
                            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#B43FEB]/60"
                        />
                    </div>

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
                            保存
                        </Button>
                    </div>
                </section>
            </DialogContent>
        </Dialog>
    );
};
