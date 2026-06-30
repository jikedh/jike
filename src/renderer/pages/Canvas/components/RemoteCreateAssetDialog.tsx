/**
 * Canvas 远程资产创建弹窗
 *
 * 使用场景：
 *   1. 用户从节点右键“创建为项目资产”
 *   2. 资产库 UI 中点击“上传资产”
 *
 * 流程：
 * - 入参为 RemoteCreateAssetRequest：媒体类型 + Blob 或远程 URL + 来源元信息
 * - 用户在表单中选择：scope、主分类、名称、描述、标签
 * - 提交时调用 uploadAndCreateAsset 进入完整上传链路
 */

import {
    IconMusic,
    IconPhoto,
    IconTag,
    IconVideo,
    IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
    AssetScope,
    MediaType,
    PrimaryCategory,
} from "shared/types/api/assets";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
    fetchBlobFromUrl,
    uploadAndCreateAsset,
} from "../utils/remoteAssetUpload";
import {
    formatFileSize,
    getDefaultPrimaryCategory,
    guessExtensionFromUrl,
} from "../utils/remoteAssets";

export interface RemoteCreateAssetRequest {
    mediaType: MediaType;
    /** 初始名称（节点 nickname 或文件名） */
    initialName: string;
    /** 来源 1：本地 Blob/File（用户从上传按钮选择） */
    blob?: Blob;
    /** 来源 2：远程 URL（节点已生成媒体） */
    url?: string;
    /** 文件名（用于 OSS key） */
    fileName?: string;
    /** 节点 ID，用于资产 source 元信息 */
    nodeId?: string;
    /** 当前项目 ID */
    projectId?: string | null;
    /** 默认 scope：可由调用方指定 */
    defaultScope?: AssetScope;
}

export interface RemoteCreateAssetDialogProps {
    open: boolean;
    request: RemoteCreateAssetRequest | null;
    onClose: () => void;
    onCreated?: () => void;
}

const SCOPE_OPTIONS: Array<{ id: AssetScope; label: string; hint: string }> = [
    { id: "project", label: "项目资产", hint: "归属当前项目，项目成员可见" },
    { id: "personal", label: "个人资产", hint: "仅自己可见，可后续升级" },
    { id: "public", label: "公开资产", hint: "公开可见，可作为公共素材" },
];

const CATEGORY_OPTIONS: Array<{ id: PrimaryCategory; label: string }> = [
    { id: "character", label: "角色" },
    { id: "scene", label: "场景" },
    { id: "prop", label: "道具" },
];

const getDefaultName = (request: RemoteCreateAssetRequest | null) => {
    if (!request) return "";
    if (request.initialName?.trim()) return request.initialName.trim();
    return request.mediaType === "image"
        ? "图片素材"
        : request.mediaType === "video"
            ? "视频素材"
            : "音频素材";
};

const getDefaultScope = (
    request: RemoteCreateAssetRequest | null,
): AssetScope => {
    if (!request) return "personal";
    if (request.defaultScope) return request.defaultScope;
    return request.projectId ? "project" : "personal";
};

const getMediaIcon = (mediaType: MediaType, size = 18) => {
    if (mediaType === "video") return <IconVideo size={size} />;
    if (mediaType === "audio") return <IconMusic size={size} />;
    return <IconPhoto size={size} />;
};

const splitTags = (raw: string): string[] => {
    const set = new Set<string>();
    for (const part of raw.split(/[,，\s]+/)) {
        const trimmed = part.trim();
        if (trimmed.length > 0) set.add(trimmed);
    }
    return Array.from(set);
};

export const RemoteCreateAssetDialog = ({
    open,
    request,
    onClose,
    onCreated,
}: RemoteCreateAssetDialogProps) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [scope, setScope] = useState<AssetScope>("personal");
    const [primaryCategory, setPrimaryCategory] = useState<PrimaryCategory>(
        "character",
    );
    const [tagsInput, setTagsInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [previewUrl, setPreviewUrl] = useState("");
    const abortRef = useRef<AbortController | null>(null);

    const tags = useMemo(() => splitTags(tagsInput), [tagsInput]);

    // 维护 blob preview URL 的生命周期，避免内存泄漏
    useEffect(() => {
        if (!request) {
            setPreviewUrl("");
            return;
        }
        if (request.url) {
            setPreviewUrl(request.url);
            return;
        }
        if (request.blob) {
            const url = URL.createObjectURL(request.blob);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setPreviewUrl("");
        return;
    }, [request]);

    // 初始化表单
    useEffect(() => {
        if (!open || !request) return;
        setName(getDefaultName(request));
        setDescription("");
        setScope(getDefaultScope(request));
        setPrimaryCategory(getDefaultPrimaryCategory(request.mediaType));
        setTagsInput("");
        setProgress(0);
    }, [open, request]);

    // 关闭时中断上传
    useEffect(() => {
        if (!open && abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
    }, [open]);

    if (!open || !request) return null;

    const handleSubmit = async () => {
        if (submitting) return;

        try {
            // 解析 Blob 来源
            let blob = request.blob;
            let fileName = request.fileName;
            if (!blob && request.url) {
                const defaultName =
                    fileName ||
                    `${name || "asset"}.${guessExtensionFromUrl(request.url) || (request.mediaType === "image" ? "png" : request.mediaType === "video" ? "mp4" : "mp3")}`;
                const fetched = await fetchBlobFromUrl(request.url, defaultName);
                blob = fetched.blob;
                fileName = fetched.fileName;
            }
            if (!blob) {
                throw new Error("没有可用的媒体数据");
            }
            if (!fileName) {
                fileName = `asset.${guessExtensionFromUrl(blob.type ? "" : request.url || "") || (request.mediaType === "image" ? "png" : request.mediaType === "video" ? "mp4" : "mp3")}`;
            }

            // 项目资产必须有 projectId
            const targetProjectId =
                scope === "project" ? request.projectId || undefined : undefined;
            if (scope === "project" && !targetProjectId) {
                toast.warning("当前画布未关联项目，无法创建项目资产");
                return;
            }

            setSubmitting(true);
            setProgress(0);
            const controller = new AbortController();
            abortRef.current = controller;

            const result = await uploadAndCreateAsset({
                blob,
                fileName,
                mediaType: request.mediaType,
                primaryCategory,
                scope,
                projectId: targetProjectId,
                name,
                description,
                tags,
                sourceProjectId: request.projectId || undefined,
                sourceNodeId: request.nodeId || undefined,
                onProgress: (percent) => setProgress(percent),
                signal: controller.signal,
            });

            toast.success(result.reused ? "已复用现有资产" : "资产已创建");
            onCreated?.();
            onClose();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "创建资产失败";
            toast.error(message);
        } finally {
            setSubmitting(false);
            abortRef.current = null;
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm">
            <div className="noflow nodrag nopan nowheel w-[min(720px,94vw)] overflow-hidden rounded-xl border border-white/10 bg-[#171719] text-white shadow-2xl">
                {/* Header */}
                <div className="flex h-13 items-center justify-between border-b border-white/8 px-5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        {getMediaIcon(request.mediaType)}
                        创建远程资产
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-40"
                        aria-label="关闭"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="grid gap-5 p-5 md:grid-cols-[320px_minmax(0,1fr)]">
                    {/* Preview */}
                    <div>
                        <div className="mb-2 text-xs text-white/40">预览</div>
                        <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md border border-white/8 bg-[#1c1c20]">
                            {request.mediaType === "image" && previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt={name}
                                    className="h-full w-full object-contain"
                                />
                            ) : request.mediaType === "video" && previewUrl ? (
                                <video
                                    src={previewUrl}
                                    className="h-full w-full object-contain"
                                    controls
                                    muted
                                />
                            ) : request.mediaType === "audio" && previewUrl ? (
                                <div className="flex w-full flex-col items-center gap-3 px-4 text-white/65">
                                    <IconMusic size={36} />
                                    <audio src={previewUrl} className="w-full" controls />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-white/40">
                                    {getMediaIcon(request.mediaType, 32)}
                                    <span className="mt-2 text-xs">资产预览</span>
                                </div>
                            )}
                        </div>

                        {request.blob ? (
                            <div className="mt-2 text-xs text-white/40">
                                文件大小：{formatFileSize(request.blob.size)}
                            </div>
                        ) : null}
                    </div>

                    {/* Form */}
                    <div className="space-y-4">
                        <label className="block">
                            <div className="mb-1.5 text-xs text-white/45">
                                名称 <span className="text-red-400">*</span>
                            </div>
                            <input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={255}
                                disabled={submitting}
                                className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#B43FEB]/70"
                            />
                        </label>

                        <div>
                            <div className="mb-1.5 text-xs text-white/45">
                                范围 <span className="text-red-400">*</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {SCOPE_OPTIONS.map((option) => {
                                    const disabled =
                                        submitting ||
                                        (option.id === "project" && !request.projectId);
                                    return (
                                        <button
                                            type="button"
                                            key={option.id}
                                            disabled={disabled}
                                            onClick={() => setScope(option.id)}
                                            className={cn(
                                                "rounded-md border px-2 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                                                scope === option.id
                                                    ? "border-[#B43FEB] bg-[#B43FEB]/15 text-white"
                                                    : "border-white/8 bg-white/[0.03] text-white/65 hover:text-white",
                                            )}
                                        >
                                            <div className="text-sm">{option.label}</div>
                                            <div className="mt-0.5 text-[10px] leading-snug text-white/40">
                                                {option.hint}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {request.mediaType !== "audio" ? (
                            <div>
                                <div className="mb-1.5 text-xs text-white/45">
                                    主分类 <span className="text-red-400">*</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {CATEGORY_OPTIONS.map((option) => (
                                        <button
                                            type="button"
                                            key={option.id}
                                            disabled={submitting}
                                            onClick={() => setPrimaryCategory(option.id)}
                                            className={cn(
                                                "h-9 rounded-md border text-sm transition-colors disabled:opacity-40",
                                                primaryCategory === option.id
                                                    ? "border-[#B43FEB] bg-[#B43FEB]/15 text-white"
                                                    : "border-white/8 bg-white/[0.03] text-white/65 hover:text-white",
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <label className="block">
                            <div className="mb-1.5 text-xs text-white/45">描述</div>
                            <textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                maxLength={1024}
                                disabled={submitting}
                                rows={2}
                                className="w-full resize-none rounded-md border border-white/10 bg-black/30 p-2.5 text-sm outline-none focus:border-[#B43FEB]/70"
                                placeholder="可选，最多 1024 字"
                            />
                        </label>

                        <label className="block">
                            <div className="mb-1.5 flex items-center justify-between text-xs text-white/45">
                                <span>
                                    标签 <span className="text-white/30">(最多 20 个)</span>
                                </span>
                                <span className="text-white/30">用空格或逗号分隔</span>
                            </div>
                            <input
                                value={tagsInput}
                                onChange={(event) => setTagsInput(event.target.value)}
                                disabled={submitting}
                                placeholder="例：古风, 汉服, 少女"
                                className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#B43FEB]/70"
                            />
                            {tags.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 rounded-full bg-[#B43FEB]/15 px-2 py-0.5 text-[11px] text-[#d486ff]"
                                        >
                                            <IconTag size={10} />
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex h-14 items-center justify-between border-t border-white/8 px-5">
                    {submitting && progress > 0 ? (
                        <div className="flex items-center gap-2 text-xs text-white/55">
                            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full bg-[#B43FEB] transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span>{progress}%</span>
                        </div>
                    ) : (
                        <div />
                    )}
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={onClose} disabled={submitting}>
                            取消
                        </Button>
                        <Button
                            size="sm"
                            variant="blue"
                            loading={submitting}
                            onClick={() => void handleSubmit()}
                        >
                            创建
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
