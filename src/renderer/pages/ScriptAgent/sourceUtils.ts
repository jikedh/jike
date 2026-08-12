import type { ScriptAgentSource } from "shared/types/scriptAgent";

export const SOURCE_SECTION_HEADING = "## 引用来源";
export const SOURCE_DATA_MARKER = "<!--SCRIPT_AGENT_SOURCES:";

export const isSafeExternalUrl = (value: string) => {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
};

const getSiteName = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "未知来源";
    }
};

export const parseAssistantContent = (content: string) => {
    const markerIndex = content.lastIndexOf(SOURCE_DATA_MARKER);
    let sourceData: ScriptAgentSource[] = [];
    let normalizedContent = content;

    if (markerIndex !== -1) {
        const markerEnd = content.indexOf("-->", markerIndex);
        if (markerEnd !== -1) {
            try {
                const value = content.slice(markerIndex + SOURCE_DATA_MARKER.length, markerEnd);
                sourceData = JSON.parse(value);
                normalizedContent = content.slice(0, markerIndex).trimEnd();
            } catch {
                sourceData = [];
            }
        }
    }

    const sourceHeadingIndex = normalizedContent.indexOf(SOURCE_SECTION_HEADING);
    if (sourceHeadingIndex === -1) return { answer: normalizedContent, sources: sourceData };

    const answer = normalizedContent.slice(0, sourceHeadingIndex).trim();
    const sourceText = normalizedContent.slice(sourceHeadingIndex + SOURCE_SECTION_HEADING.length);
    const sources = sourceData.length > 0 ? sourceData : Array.from(sourceText.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)(?:\s*[｜|]\s*(.+))?/g)).map(
        ([, title, url, summary], index) => ({
            index: index + 1,
            siteName: getSiteName(url),
            title: title.trim(),
            summary: summary?.trim() || "暂无摘要",
            url,
        }),
    );

    return { answer, sources };
};

export const appendSourceData = (content: string, sources: ScriptAgentSource[]) =>
    sources.length > 0 ? `${content}\n${SOURCE_DATA_MARKER}${JSON.stringify(sources)}-->` : content;