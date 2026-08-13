import { ExternalLink, Globe2, X } from "lucide-react";
import type { ScriptAgentSource } from "shared/types/scriptAgent";
import { isSafeExternalUrl } from "./sourceUtils";

type Props = {
    sources: ScriptAgentSource[];
    onClose: () => void;
};

export const SourcePanel = ({ sources, onClose }: Props) => (
    <aside className="flex w-90 shrink-0 flex-col border-l border-white/10 bg-[#101015]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Globe2 size={17} className="text-[#79cfff]" />
                    <span>搜索来源</span>
                </div>
                <p className="mt-1 text-xs text-white/45">已阅读 {sources.length} 个网页</p>
            </div>
            <button
                onClick={onClose}
                className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                title="关闭来源面板"
            >
                <X size={17} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
            <div className="grid gap-3">
                {sources.map((source) => (
                    <a
                        key={`${source.index}-${source.url}`}
                        href={isSafeExternalUrl(source.url) ? source.url : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-white/10 bg-white/3 p-3 hover:border-[#79cfff]/50 hover:bg-[#79cfff]/10"
                    >
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                            <span className="rounded bg-[#79cfff]/15 px-1.5 py-0.5 text-[#79cfff]">[{source.index}]</span>
                            <span className="min-w-0 truncate text-white/45">{source.siteName}</span>
                            <ExternalLink size={14} className="shrink-0 text-[#79cfff]" />
                        </div>
                        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-white/90">{source.title}</h3>
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/55">{source.summary}</p>
                        <p className="mt-2 text-xs text-white/35">发布时间：{source.publishedAt || "未知"}</p>
                    </a>
                ))}
            </div>
        </div>
    </aside>
);