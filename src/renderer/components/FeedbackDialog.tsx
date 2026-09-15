import { ImagePlus, MessageSquareText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    createFeedback,
    type FeedbackCategory,
    uploadFeedbackAttachment,
} from "@/api/feedback";
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
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MAX_ATTACHMENT_COUNT = 9;
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);
const ACCEPTED_IMAGE_EXTENSIONS = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
]);

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
    { value: "suggestion", label: "产品建议" },
    { value: "bug", label: "问题反馈" },
    { value: "complaint", label: "投诉与服务问题" },
    { value: "consultation", label: "功能咨询" },
];

type Attachment = {
    file: File;
    previewURL: string;
};

type FeedbackDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const hasSuccessCode = (code?: number) => code === 0 || code === 200;

const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "提交失败，请稍后重试";

const getFileExtension = (fileName: string) => {
    const index = fileName.lastIndexOf(".");
    return index === -1 ? "" : fileName.slice(index).toLowerCase();
};

export const FeedbackDialog = ({
    open,
    onOpenChange,
}: FeedbackDialogProps) => {
    const [category, setCategory] = useState<FeedbackCategory | "">("");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [contact, setContact] = useState("");
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [diagnosticConsent, setDiagnosticConsent] = useState(false);
    const [appVersion, setAppVersion] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedCount, setUploadedCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        window.debug
            ?.getAppVersion()
            .then((version) => setAppVersion(version || ""))
            .catch(() => setAppVersion(""));
    }, [open]);

    const resetForm = () => {
        attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewURL));
        setCategory("");
        setTitle("");
        setContent("");
        setContact("");
        setAttachments([]);
        setDiagnosticConsent(false);
        setUploadedCount(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && (isSubmitting || isUploading)) {
            return;
        }
        if (!nextOpen) {
            resetForm();
        }
        onOpenChange(nextOpen);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(event.target.files || []);
        if (!selectedFiles.length) {
            return;
        }
        const availableCount = MAX_ATTACHMENT_COUNT - attachments.length;
        if (selectedFiles.length > availableCount) {
            toast.error(`最多上传 ${MAX_ATTACHMENT_COUNT} 张图片`);
        }
        const nextAttachments: Attachment[] = [];
        for (const file of selectedFiles.slice(0, availableCount)) {
            if (
                !ACCEPTED_IMAGE_TYPES.has(file.type) ||
                !ACCEPTED_IMAGE_EXTENSIONS.has(getFileExtension(file.name))
            ) {
                toast.error(`${file.name} 不是支持的图片格式`);
                continue;
            }
            if (file.size > MAX_ATTACHMENT_SIZE) {
                toast.error(`${file.name} 超过 50MB`);
                continue;
            }
            nextAttachments.push({ file, previewURL: URL.createObjectURL(file) });
        }
        setAttachments((current) => [...current, ...nextAttachments]);
        event.target.value = "";
    };

    const removeAttachment = (index: number) => {
        setAttachments((current) => {
            const removed = current[index];
            if (removed) {
                URL.revokeObjectURL(removed.previewURL);
            }
            return current.filter((_, attachmentIndex) => attachmentIndex !== index);
        });
    };

    const handleSubmit = async () => {
        const trimmedTitle = title.trim();
        const trimmedContent = content.trim();
        if (!category) {
            toast.error("请选择反馈分类");
            return;
        }
        if (!trimmedTitle) {
            toast.error("请输入反馈标题");
            return;
        }
        if (!trimmedContent) {
            toast.error("请输入反馈详情");
            return;
        }
        if (!diagnosticConsent) {
            toast.error("请先同意上传诊断信息");
            return;
        }

        setIsSubmitting(true);
        setUploadedCount(0);
        try {
            const attachmentKeys: string[] = [];
            if (attachments.length) {
                setIsUploading(true);
                for (const [index, attachment] of attachments.entries()) {
                    const response = await uploadFeedbackAttachment(attachment.file);
                    if (!hasSuccessCode(response.code) || !response.data?.key) {
                        throw new Error(response.msg || response.message || "图片上传失败");
                    }
                    attachmentKeys.push(response.data.key);
                    setUploadedCount(index + 1);
                }
                setIsUploading(false);
            }

            const response = await createFeedback({
                category,
                title: trimmedTitle,
                content: trimmedContent,
                contact: contact.trim() || undefined,
                attachmentKeys,
                appVersion,
                osVersion: navigator.userAgent.slice(0, 128),
                currentPage: window.location.hash || "/",
                diagnosticConsent,
            });
            if (!hasSuccessCode(response.code)) {
                throw new Error(response.msg || response.message || "提交失败");
            }
            toast.success("反馈已提交，我们会尽快处理");
            handleOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsUploading(false);
            setIsSubmitting(false);
        }
    };

    const submitLabel = isUploading
        ? `正在上传图片（${uploadedCount}/${attachments.length}）`
        : "提交反馈";

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-[min(640px,92vw)] flex-col overflow-hidden border-white/10 bg-[#121214] p-0 text-white shadow-2xl">
                <DialogHeader className="border-b border-white/10 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <MessageSquareText className="text-[#d68cf6]" />
                        <DialogTitle className="text-lg text-white">用户反馈</DialogTitle>
                    </div>
                    <DialogDescription className="text-white/50">
                        你的建议会帮助我们持续改进产品体验。
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-white/75">反馈分类</label>
                        <Select value={category} onValueChange={(value) => setCategory(value as FeedbackCategory)}>
                            <SelectTrigger className="h-10 w-full border-white/10 bg-white/5 text-white">
                                <SelectValue placeholder="请选择反馈分类" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {CATEGORY_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-white/75">标题</label>
                        <Input
                            value={title}
                            maxLength={100}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="请简要描述你遇到的问题或建议"
                            className="h-10 border-white/10 bg-white/5 text-white placeholder:text-white/30"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-white/75">详情</label>
                        <Textarea
                            value={content}
                            maxLength={5000}
                            onChange={(event) => setContent(event.target.value)}
                            placeholder="请尽可能说明发生场景、期望结果和实际结果"
                            className="min-h-32 border-white/10 bg-white/5 text-white placeholder:text-white/30"
                        />
                        <span className="text-right text-xs text-white/35">{content.length}/5000</span>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-white/75">联系方式（选填）</label>
                        <Input
                            value={contact}
                            maxLength={255}
                            onChange={(event) => setContact(event.target.value)}
                            placeholder="请输入手机号、邮箱或其他联系方式"
                            className="h-10 border-white/10 bg-white/5 text-white placeholder:text-white/30"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-white/75">图片附件（选填）</label>
                            <span className="text-xs text-white/35">最多 9 张，单张不超过 50MB</span>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <div className="flex flex-wrap gap-3">
                            {attachments.map((attachment, index) => (
                                <div key={attachment.previewURL} className="group relative size-20 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                                    <img src={attachment.previewURL} alt={attachment.file.name} className="size-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(index)}
                                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 group-hover:opacity-100"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {attachments.length < MAX_ATTACHMENT_COUNT ? (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 text-xs text-white/45 hover:border-[#d68cf6] hover:text-[#d68cf6]"
                                >
                                    <ImagePlus size={20} />
                                    添加图片
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <label className="flex items-start gap-2 text-xs leading-5 text-white/50">
                        <input
                            type="checkbox"
                            checked={diagnosticConsent}
                            onChange={(event) => setDiagnosticConsent(event.target.checked)}
                            className="mt-1 size-3.5 accent-[#B43FEB]"
                        />
                        我同意随反馈上传应用版本、系统版本与当前页面，用于定位问题。
                    </label>
                </div>

                <DialogFooter className="flex-row justify-end gap-3 border-t border-white/10 px-6 py-4">
                    <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                        取消
                    </Button>
                    <Button variant="blue" loading={isSubmitting} onClick={handleSubmit} disabled={isSubmitting}>
                        {submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
