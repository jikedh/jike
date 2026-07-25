import { useEffect, useState } from "react";
import type { TeamMember } from "shared/types/api/teams";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCredits } from "../utils";

/* ---------------- 创建 / 编辑团队 ---------------- */

interface TeamFormDialogProps {
    open: boolean;
    mode: "create" | "edit";
    initialName?: string;
    initialDescription?: string;
    onOpenChange: (open: boolean) => void;
    onSubmit: (name: string, description: string) => void;
}

export function TeamFormDialog({
    open,
    mode,
    initialName = "",
    initialDescription = "",
    onOpenChange,
    onSubmit,
}: TeamFormDialogProps) {
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription);

    useEffect(() => {
        if (open) {
            setName(initialName);
            setDescription(initialDescription);
        }
    }, [open, initialName, initialDescription]);

    const handleSubmit = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error("请输入团队名称");
            return;
        }
        onSubmit(trimmed, description.trim());
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border-white/10 bg-[#1a1a1e] text-white">
                <DialogHeader>
                    <DialogTitle className="text-white">
                        {mode === "create" ? "创建新团队" : "编辑团队信息"}
                    </DialogTitle>
                    <DialogDescription className="text-white/40">
                        {mode === "create"
                            ? "创建后即可邀请成员并统一分配积分。"
                            : "仅团队负责人可以修改团队名称与简介。"}
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                    <div>
                        <div className="mb-1.5 block text-xs font-bold text-white/50">团队名称</div>
                        <Input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="例如：星火内容工作室"
                            maxLength={30}
                            className="border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-[#B43FEB]/60"
                        />
                    </div>
                    <div>
                        <div className="mb-1.5 block text-xs font-bold text-white/50">团队简介</div>
                        <Textarea
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="一句话说明团队方向，便于成员识别"
                            rows={3}
                            maxLength={120}
                            className="border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-[#B43FEB]/60"
                        />
                    </div>
                </div>
                <DialogFooter className="border-white/10">
                    <Button onClick={() => onOpenChange(false)}>取消</Button>
                    <Button variant="blue" onClick={handleSubmit}>
                        {mode === "create" ? "创建团队" : "保存修改"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ---------------- 邀请成员 ---------------- */

interface InviteMemberDialogProps {
    open: boolean;
    teamName: string;
    onOpenChange: (open: boolean) => void;
    onSubmit: (inviteeUserId: string) => void;
}

export function InviteMemberDialog({
    open,
    teamName,
    onOpenChange,
    onSubmit,
}: InviteMemberDialogProps) {
    const [inviteeUserId, setInviteeUserId] = useState("");

    useEffect(() => {
        if (open) setInviteeUserId("");
    }, [open]);

    const handleSubmit = () => {
        const trimmed = inviteeUserId.trim();
        if (!trimmed) {
            toast.error("请输入被邀请人的用户 ID");
            return;
        }
        onSubmit(trimmed);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border-white/10 bg-[#1a1a1e] text-white">
                <DialogHeader>
                    <DialogTitle className="text-white">邀请成员</DialogTitle>
                    <DialogDescription className="text-white/40">
                        输入对方用户 ID，将其邀请加入「{teamName}」。
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    <div className="mb-1.5 block text-xs font-bold text-white/50">用户 ID</div>
                    <Input
                        value={inviteeUserId}
                        onChange={(event) => setInviteeUserId(event.target.value)}
                        placeholder="例如：10086"
                        className="border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-[#B43FEB]/60"
                    />
                </div>
                <DialogFooter className="border-white/10">
                    <Button onClick={() => onOpenChange(false)}>取消</Button>
                    <Button variant="blue" onClick={handleSubmit}>
                        发送邀请
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ---------------- 分配积分 ---------------- */

interface AllocateCreditsDialogProps {
    open: boolean;
    members: TeamMember[];
    presetMember?: TeamMember | null;
    allocatableCredits: number;
    onOpenChange: (open: boolean) => void;
    onSubmit: (memberUserId: string, amount: number) => void;
}

export function AllocateCreditsDialog({
    open,
    members,
    presetMember,
    allocatableCredits,
    onOpenChange,
    onSubmit,
}: AllocateCreditsDialogProps) {
    const [memberUserId, setMemberUserId] = useState<string>("");
    const [amount, setAmount] = useState<string>("");

    useEffect(() => {
        if (open) {
            setMemberUserId(presetMember ? String(presetMember.userId) : "");
            setAmount("");
        }
    }, [open, presetMember]);

    const handleSubmit = () => {
        if (!memberUserId) {
            toast.error("请选择要分配的成员");
            return;
        }
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            toast.error("请输入大于 0 的积分数量");
            return;
        }
        if (value > allocatableCredits) {
            toast.error("超出当前可分配积分余额");
            return;
        }
        onSubmit(memberUserId, Math.floor(value));
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border-white/10 bg-[#1a1a1e] text-white">
                <DialogHeader>
                    <DialogTitle className="text-white">分配个人积分</DialogTitle>
                    <DialogDescription className="text-white/40">
                        当前可分配积分
                        <span className="mx-1 font-bold text-[#d896ff]">
                            {formatCredits(allocatableCredits)}
                        </span>
                        ，分配后成员即可用于任务消费。
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                    <div>
                        <div className="mb-1.5 block text-xs font-bold text-white/50">选择成员</div>
                        <Select value={memberUserId} onValueChange={setMemberUserId}>
                            <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                                <SelectValue placeholder="选择团队成员" />
                            </SelectTrigger>
                            <SelectContent className="border-white/10 bg-[#1a1a1e] text-white">
                                {members.map((member) => (
                                    <SelectItem
                                        key={String(member.userId)}
                                        value={String(member.userId)}
                                    >
                                        {member.nickname}
                                        {member.role === "OWNER" ? "（负责人）" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <div className="mb-1.5 block text-xs font-bold text-white/50">积分数量</div>
                        <Input
                            value={amount}
                            onChange={(event) =>
                                setAmount(event.target.value.replace(/[^0-9]/g, ""))
                            }
                            placeholder="输入正整数积分"
                            inputMode="numeric"
                            className="border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-[#B43FEB]/60"
                        />
                    </div>
                </div>
                <DialogFooter className="border-white/10">
                    <Button onClick={() => onOpenChange(false)}>取消</Button>
                    <Button variant="blue" onClick={handleSubmit}>
                        确认分配
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ---------------- 通用确认 ---------------- */

interface ConfirmActionDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export function ConfirmActionDialog({
    open,
    title,
    description,
    confirmText = "确认",
    onOpenChange,
    onConfirm,
}: ConfirmActionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border-white/10 bg-[#1a1a1e] text-white">
                <DialogHeader>
                    <DialogTitle className="text-white">{title}</DialogTitle>
                    <DialogDescription className="text-white/40">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="border-white/10">
                    <Button onClick={() => onOpenChange(false)}>取消</Button>
                    <Button
                        variant="blue"
                        onClick={() => {
                            onConfirm();
                            onOpenChange(false);
                        }}
                    >
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
