import {
    IconAlertCircle,
    IconArrowRight,
    IconCheck,
    IconDownload,
    IconExternalLink,
    IconFileText,
    IconLoader2,
    IconRefresh,
    IconRotateClockwise,
} from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState } from "react";
import { cn } from "shared/utils/utils";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type {
    UpdateInfo,
    UpdateProgress,
    UpdateState,
} from "@/hooks/useUpdater";

interface UpdateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    state: UpdateState;
    progress: UpdateProgress;
    updateInfo: UpdateInfo | null;
    error: string | null;
    currentVersion: string;
    onCheckForUpdates: () => Promise<boolean>;
    onStartUpdate: () => Promise<void>;
    onRestartApp: () => Promise<void>;
    onRetry: () => Promise<boolean>;
    /**
     * 当检测/下载失败时，提供一个"浏览器下载"的兜底入口。
     * 留空则不显示兜底按钮。
     */
    fallbackOpenUrl?: string;
    onFallbackOpen?: () => void;
}

function formatBytes(bytes: number): string {
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getProgressPercentage(progress: UpdateProgress): number {
    if (!progress.totalBytes || progress.totalBytes === 0) return 0;
    return Math.round((progress.downloadedBytes / progress.totalBytes) * 100);
}

const stateConfig: Record<
    UpdateState,
    {
        label: string;
        description: string;
        accent: string;
    }
> = {
    idle: {
        label: "检查更新",
        description: "点击下方按钮检查是否有新版本",
        accent: "border-white/10",
    },
    checking: {
        label: "正在检查更新",
        description: "正在连接更新服务器…",
        accent: "border-[#B43FEB]/40",
    },
    available: {
        label: "发现新版本",
        description: "新版本已就绪，可以下载并安装",
        accent: "border-yellow-500/40",
    },
    downloading: {
        label: "正在下载更新",
        description: "请稍候，更新包下载中…",
        accent: "border-[#B43FEB]/40",
    },
    installing: {
        label: "正在安装更新",
        description: "正在应用更新…",
        accent: "border-[#B43FEB]/40",
    },
    complete: {
        label: "更新已安装",
        description: "重启应用以应用更新",
        accent: "border-green-500/40",
    },
    error: {
        label: "更新失败",
        description: "更新过程中出现错误",
        accent: "border-red-500/40",
    },
    up_to_date: {
        label: "已是最新版本",
        description: "当前已是最新版本，无需更新",
        accent: "border-green-500/40",
    },
};

export function UpdateDialog({
    open,
    onOpenChange,
    state,
    progress,
    updateInfo,
    error,
    currentVersion,
    onCheckForUpdates,
    onStartUpdate,
    onRestartApp,
    onRetry,
    fallbackOpenUrl,
    onFallbackOpen,
}: UpdateDialogProps) {
    const config = stateConfig[state];
    const percentage = getProgressPercentage(progress);

    // 弹窗关闭 300ms 后再重置状态，避免关闭动画期间闪烁
    const [pendingClose, setPendingClose] = useState(false);
    useEffect(() => {
        if (!open) {
            setPendingClose(true);
            const t = setTimeout(() => setPendingClose(false), 300);
            return () => clearTimeout(t);
        }
        setPendingClose(false);
        return undefined;
    }, [open]);

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            onOpenChange(true);
            return;
        }
        // 检查/下载/安装中不允许关闭，避免状态错乱
        if (state === "checking" || state === "downloading" || state === "installing") {
            return;
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                // 覆盖默认白底，贴合项目暗色风格
                className="bg-[#0a0a0f] border-white/10 text-white max-w-lg p-0 gap-0 overflow-hidden"
                onPointerDownOutside={(e) => {
                    if (state === "downloading" || state === "installing") {
                        e.preventDefault();
                    }
                }}
                onEscapeKeyDown={(e) => {
                    if (state === "downloading" || state === "installing") {
                        e.preventDefault();
                    }
                }}
            >
                <DialogHeader
                    className={cn(
                        "px-6 pt-6 pb-4 border-b border-white/5",
                        "bg-gradient-to-br from-[#B43FEB]/8 via-transparent to-transparent",
                    )}
                >
                    <div className="flex items-start gap-4">
                        <div
                            className={cn(
                                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
                                "bg-[#B43FEB]/15 text-[#B43FEB]",
                                config.accent,
                            )}
                        >
                            {state === "checking" ||
                                state === "downloading" ||
                                state === "installing" ? (
                                <IconLoader2 size={22} className="animate-spin" />
                            ) : state === "available" ? (
                                <IconDownload size={22} />
                            ) : state === "complete" || state === "up_to_date" ? (
                                <IconCheck size={22} />
                            ) : state === "error" ? (
                                <IconAlertCircle size={22} />
                            ) : (
                                <IconRefresh size={22} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-base font-semibold text-white">
                                {config.label}
                            </DialogTitle>
                            <p className="text-xs text-white/50 mt-1">{config.description}</p>
                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 text-[11px] font-mono text-white/60">
                                    v{currentVersion || "?"}
                                </span>
                                {updateInfo && state === "available" && (
                                    <>
                                        <IconArrowRight size={14} className="text-white/40" />
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-yellow-500/20 text-[11px] font-mono text-yellow-300 font-medium">
                                            v{updateInfo.version}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 py-5 space-y-4 min-h-[120px]">
                    {state === "idle" && (
                        <div className="rounded-lg border border-dashed border-white/10 p-6 text-center">
                            <p className="text-sm text-white/50">
                                点击下方"检查更新"开始检测新版本
                            </p>
                        </div>
                    )}

                    {state === "checking" && (
                        <div className="rounded-lg border border-[#B43FEB]/20 bg-[#B43FEB]/5 p-6 text-center">
                            <p className="text-sm text-white/60">正在连接更新服务器…</p>
                        </div>
                    )}

                    {state === "up_to_date" && (
                        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center">
                            <p className="text-sm text-green-300 font-medium">
                                当前版本 v{currentVersion} 已是最新版本
                            </p>
                        </div>
                    )}

                    {state === "available" && updateInfo && (
                        <div className="space-y-3">
                            {updateInfo.releaseNotes ? (
                                <>
                                    <div className="flex items-center gap-2 text-xs font-medium text-white/70">
                                        <IconFileText size={14} className="text-white/40" />
                                        更新内容
                                    </div>
                                    <div className="max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-white/70 leading-relaxed">
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h1: ({ children }) => (
                                                        <h1 className="text-sm font-bold mt-2 mb-2 first:mt-0 pb-1.5 border-b border-white/10">
                                                            {children}
                                                        </h1>
                                                    ),
                                                    h2: ({ children }) => (
                                                        <h2 className="text-sm font-semibold mt-3 mb-1.5 first:mt-0">
                                                            {children}
                                                        </h2>
                                                    ),
                                                    h3: ({ children }) => (
                                                        <h3 className="text-[13px] font-medium mt-2 mb-1 first:mt-0">
                                                            {children}
                                                        </h3>
                                                    ),
                                                    ul: ({ children }) => (
                                                        <ul className="list-none pl-0 my-2 space-y-1">
                                                            {children}
                                                        </ul>
                                                    ),
                                                    li: ({ children }) => (
                                                        <li className="text-[13px] text-white/65 flex items-start gap-2">
                                                            <span className="text-[#B43FEB] mt-1.5 text-[6px]">
                                                                ●
                                                            </span>
                                                            <span>{children}</span>
                                                        </li>
                                                    ),
                                                    p: ({ children }) => (
                                                        <p className="text-[13px] text-white/65 my-1.5 leading-relaxed">
                                                            {children}
                                                        </p>
                                                    ),
                                                    hr: () => (
                                                        <hr className="my-3 border-white/10" />
                                                    ),
                                                    strong: ({ children }) => (
                                                        <strong className="font-semibold text-white/85">
                                                            {children}
                                                        </strong>
                                                    ),
                                                    code: ({ children }) => (
                                                        <code className="px-1 py-0.5 rounded bg-white/10 text-[#B43FEB] text-[12px] font-mono">
                                                            {children}
                                                        </code>
                                                    ),
                                                    a: ({ href, children }) => (
                                                        <a
                                                            href={href}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[#B43FEB] hover:underline inline-flex items-center gap-1"
                                                        >
                                                            {children}
                                                            <IconExternalLink size={12} />
                                                        </a>
                                                    ),
                                                }}
                                            >
                                                {updateInfo.releaseNotes}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-white/60">
                                    新版本 v{updateInfo.version} 已就绪，建议立即更新。
                                </div>
                            )}
                        </div>
                    )}

                    {(state === "downloading" || state === "installing") && (
                        <div className="rounded-lg border border-[#B43FEB]/20 bg-[#B43FEB]/5 p-4 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-white/60">
                                    {state === "downloading" ? "下载中…" : "安装中…"}
                                </span>
                                <span className="font-mono text-[#B43FEB] font-medium">
                                    {percentage}%
                                </span>
                            </div>
                            <div className="relative h-2 w-full rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full bg-[#B43FEB]/40 blur-[3px] transition-all duration-200"
                                    style={{ width: `${percentage}%` }}
                                />
                                <div
                                    className="relative h-full rounded-full bg-[#B43FEB] transition-all duration-200 ease-out"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[11px] text-white/40">
                                <span>{formatBytes(progress.downloadedBytes)}</span>
                                {progress.totalBytes ? (
                                    <span>{formatBytes(progress.totalBytes)}</span>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {state === "complete" && (
                        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center">
                            <p className="text-sm text-green-300 font-medium">
                                更新已下载并安装完成
                            </p>
                            <p className="text-xs text-white/50 mt-1">
                                重启应用即可使用新版本
                            </p>
                        </div>
                    )}

                    {state === "error" && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
                            <IconAlertCircle
                                size={18}
                                className="text-red-400 shrink-0 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-red-300 font-medium">更新失败</p>
                                <p className="text-xs text-red-300/80 mt-1 break-all">
                                    {error || "未知错误"}
                                </p>
                                {fallbackOpenUrl && (
                                    <button
                                        type="button"
                                        onClick={onFallbackOpen}
                                        className="mt-2 inline-flex items-center gap-1 text-xs text-[#B43FEB] hover:underline"
                                    >
                                        <IconExternalLink size={12} />
                                        改用浏览器下载
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t border-white/5 bg-black/20">
                    {/* 隐藏状态：避免弹窗刚关闭瞬间渲染任何 footer 内容 */}
                    {pendingClose && !open ? null : (
                        <>
                            {state === "idle" && (
                                <Button
                                    size="sm"
                                    variant="blue"
                                    onClick={() => void onCheckForUpdates()}
                                >
                                    <IconRefresh size={14} />
                                    检查更新
                                </Button>
                            )}

                            {state === "checking" && (
                                <Button size="sm" disabled>
                                    <IconLoader2 size={14} className="animate-spin" />
                                    检查中…
                                </Button>
                            )}

                            {state === "available" && (
                                <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                                    <Button size="sm" onClick={() => onOpenChange(false)}>
                                        稍后
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="blue"
                                        onClick={() => void onStartUpdate()}
                                    >
                                        <IconDownload size={14} />
                                        立即更新
                                    </Button>
                                </div>
                            )}

                            {(state === "downloading" || state === "installing") && (
                                <Button size="sm" disabled>
                                    <IconLoader2 size={14} className="animate-spin" />
                                    {state === "downloading" ? "下载中…" : "安装中…"}
                                </Button>
                            )}

                            {state === "complete" && (
                                <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                                    <Button size="sm" onClick={() => onOpenChange(false)}>
                                        稍后
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="blue"
                                        onClick={() => void onRestartApp()}
                                    >
                                        <IconRotateClockwise size={14} />
                                        立即重启
                                    </Button>
                                </div>
                            )}

                            {state === "error" && (
                                <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                                    <Button size="sm" onClick={() => onOpenChange(false)}>
                                        关闭
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="blue"
                                        onClick={() => void onRetry()}
                                    >
                                        <IconRefresh size={14} />
                                        重试
                                    </Button>
                                </div>
                            )}

                            {state === "up_to_date" && (
                                <Button size="sm" onClick={() => onOpenChange(false)}>
                                    关闭
                                </Button>
                            )}
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
