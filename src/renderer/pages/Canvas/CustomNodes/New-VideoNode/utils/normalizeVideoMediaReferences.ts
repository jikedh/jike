/**
 * 视频节点媒体引用归一化
 *
 * 在提交 AI 视频生成请求之前，把 TipTap 正文 @ 提及和上方参考列表中的媒体资源
 * 统一合并、去重、按媒体类型独立编号（ImageN / AudioN / VideoN），
 * 并保证最终 prompt 中的占位符编号严格对应 `images[N-1]` / `audios[N-1]` / `videos[N-1]`。
 *
 * 设计原则：
 * 1. 正文 mention 优先：按 TipTap 文档中 mention 节点出现的顺序进入最终数组。
 * 2. 参考列表补充：上方已选中但未被正文 @ 的媒体，按参考列表顺序追加。
 * 3. 去重：同一媒体只在对应类型数组中出现一次；优先用真实 URL（url/fileUrl/value）作为去重 key。
 * 4. 不依赖 UI label：最终 prompt 一定使用英文占位符 `ImageN / AudioN / VideoN`。
 */

import type { MentionItem } from "../constants/mockData";

export type MediaKind = "image" | "video" | "audio";

export interface MentionLike {
    id?: string | null;
    type?: string | null;
    mediaType?: string | null;
    label?: string | null;
    displayLabel?: string | null;
    originalLabel?: string | null;
    value?: string | null;
    thumbnail?: string | null;
    url?: string | null;
    fileUrl?: string | null;
    source?: string | null;
    scope?: string | null;
    assetId?: string | null;
    nodeId?: string | null;
    primaryCategory?: string | null;
    category?: string | null;
}

export interface NormalizedMediaEntry {
    /** 媒体类型 */
    type: MediaKind;
    /** 占位符编号（从 1 开始，与 prompt 中的 ImageN/AudioN/VideoN 对应） */
    index: number;
    /** 真实资源 URL，用于最终请求体 */
    url: string;
    /** 用于去重 / 回溯的稳定 key */
    key: string;
    /** mention 节点 ID，可为空（参考列表补充） */
    mentionId: string | null;
    /** 原始来源：来自正文 @ 提及 or 上方参考列表 */
    source: "prompt" | "reference";
    /** mention 原 label，用于日志/调试 */
    label: string | null;
}

export interface NormalizeResult {
    /** 归一化后的 prompt（已把 mention 替换为 ImageN/AudioN/VideoN） */
    prompt: string;
    /** 严格按 Image1..N 顺序排列的图片条目 */
    images: NormalizedMediaEntry[];
    /** 严格按 Audio1..N 顺序排列的音频条目 */
    audios: NormalizedMediaEntry[];
    /** 严格按 Video1..N 顺序排列的视频条目 */
    videos: NormalizedMediaEntry[];
    /** 与 buildVideoApiRequest 对齐的 referenceItems（MentionItem[]），可被现有请求构建函数直接消费 */
    referenceItems: MentionItem[];
}

const PLACEHOLDER_PREFIX: Record<MediaKind, string> = {
    image: "Image",
    audio: "Audio",
    video: "Video",
};

const isMediaKind = (value: unknown): value is MediaKind =>
    value === "image" || value === "video" || value === "audio";

const pickRealUrl = (item: MentionLike): string => {
    const candidates = [item.fileUrl, item.url, item.value, item.thumbnail];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate;
        }
    }
    return "";
};

const buildDedupeKey = (item: MentionLike, fallbackIndex: number): string => {
    const url = pickRealUrl(item);
    if (url) return `url::${url}`;
    if (item.assetId) return `asset::${item.assetId}`;
    if (item.nodeId) return `node::${item.nodeId}`;
    if (item.id) return `id::${item.id}`;
    return `fallback::${fallbackIndex}`;
};

const toMentionItem = (
    entry: NormalizedMediaEntry,
    placeholder: string,
    originalLabel: string | null,
): MentionItem => {
    return {
        id: entry.mentionId ?? `normalized-${entry.type}-${entry.index}`,
        mentionId: entry.mentionId ?? undefined,
        label: originalLabel ?? placeholder,
        displayLabel: placeholder,
        originalLabel: originalLabel ?? placeholder,
        value: entry.url,
        thumbnail: entry.url,
        url: entry.url,
        fileUrl: entry.url,
        type: entry.type,
        mediaType: entry.type,
    };
};

/**
 * 从 TipTap 富文本中按文档顺序提取 mention 节点。
 * 同时返回"原文中 mention 的展示文本"位置，以便替换为英文占位符。
 */
export const extractMentionsFromProseMirrorDoc = (
    doc: unknown,
): MentionLike[] => {
    const mentions: MentionLike[] = [];

    const visit = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        const record = node as Record<string, unknown>;

        if (record.type === "mention") {
            const attrs = (record.attrs ?? {}) as Record<string, unknown>;
            mentions.push({
                id: (attrs.id as string | null) ?? null,
                type: (attrs.type as string | null) ?? null,
                mediaType: (attrs.mediaType as string | null) ?? null,
                label: (attrs.label as string | null) ?? null,
                displayLabel: (attrs.displayLabel as string | null) ?? null,
                originalLabel: (attrs.originalLabel as string | null) ?? null,
                value: (attrs.value as string | null) ?? null,
                thumbnail: (attrs.thumbnail as string | null) ?? null,
                url: (attrs.url as string | null) ?? null,
                fileUrl: (attrs.fileUrl as string | null) ?? null,
                source: (attrs.source as string | null) ?? null,
                scope: (attrs.scope as string | null) ?? null,
                assetId: (attrs.assetId as string | null) ?? null,
                nodeId: (attrs.nodeId as string | null) ?? null,
                primaryCategory: (attrs.primaryCategory as string | null) ?? null,
                category: (attrs.category as string | null) ?? null,
            });
            return;
        }

        if (Array.isArray(record.content)) {
            record.content.forEach(visit);
        }
    };

    visit(doc);
    return mentions;
};

/**
 * 把 TipTap 文档树中每个 mention 节点的展示文本（displayLabel 或 label）
 * 替换为最终英文占位符。
 *
 * - 替换基于节点在 doc.content 数组中的顺序，与 `buildOrderedMentions` 的顺序一致。
 * - 对于不在已用 mention 集合里的 mention（例如纯显示残留），按真实出现顺序退回到默认占位符。
 */
const replaceMentionsInDoc = (
    doc: unknown,
    replacements: Map<string, string>,
): string => {
    if (!doc || typeof doc !== "object") return "";

    const BLOCK_TYPES = new Set([
        "doc",
        "paragraph",
        "heading",
        "blockquote",
        "bulletList",
        "orderedList",
        "listItem",
        "codeBlock",
    ]);

    const visit = (node: unknown): string => {
        const record = node as Record<string, unknown>;
        if (!record || typeof record !== "object") return "";

        if (record.type === "text") {
            return typeof record.text === "string" ? record.text : "";
        }

        if (record.type === "mention") {
            const attrs = (record.attrs ?? {}) as Record<string, unknown>;
            const mentionId = (attrs.id as string | null) ?? "";
            return replacements.get(mentionId) ?? "";
        }

        if (record.type === "hardBreak") {
            return "\n";
        }

        if (Array.isArray(record.content)) {
            const separator = BLOCK_TYPES.has(String(record.type)) ? "\n" : "";
            return record.content.map(visit).join(separator);
        }

        return "";
    };

    return visit(doc);
};

const resolveMentionKind = (
    mention: MentionLike,
): MediaKind | null => {
    const raw = mention.type ?? mention.mediaType;
    return isMediaKind(raw) ? raw : null;
};

const buildOrderedMentions = (
    mentions: MentionLike[],
): NormalizedMediaEntry[] => {
    const counters: Record<MediaKind, number> = {
        image: 0,
        audio: 0,
        video: 0,
    };
    const seenKeys = new Set<string>();
    const ordered: NormalizedMediaEntry[] = [];

    mentions.forEach((mention, index) => {
        const kind = resolveMentionKind(mention);
        if (!kind) return;

        const key = buildDedupeKey(mention, index);
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        const url = pickRealUrl(mention);
        if (!url) return;

        counters[kind] += 1;
        ordered.push({
            type: kind,
            index: counters[kind],
            url,
            key,
            mentionId: typeof mention.id === "string" ? mention.id : null,
            source: "prompt",
            label:
                mention.originalLabel ?? mention.label ?? mention.displayLabel ?? null,
        });
    });

    return ordered;
};

const appendFromReferenceItems = (
    existing: NormalizedMediaEntry[],
    referenceItems: MentionItem[],
): NormalizedMediaEntry[] => {
    const counters: Record<MediaKind, number> = {
        image: 0,
        audio: 0,
        video: 0,
    };
    existing.forEach((entry) => {
        counters[entry.type] = Math.max(counters[entry.type], entry.index);
    });

    const seenKeys = new Set(existing.map((entry) => entry.key));
    const ordered = [...existing];

    referenceItems.forEach((item, index) => {
        if (!isMediaKind(item.type)) return;

        const key = buildDedupeKey(
            {
                id: item.id,
                type: item.type,
                label: item.label,
                displayLabel: item.displayLabel,
                originalLabel: item.originalLabel,
                value: item.value,
                thumbnail: item.thumbnail,
                url: item.url,
                fileUrl: item.fileUrl,
                source: item.source,
                scope: item.scope,
                assetId: item.assetId,
                nodeId: item.nodeId,
                primaryCategory: item.primaryCategory,
            },
            index,
        );
        if (seenKeys.has(key)) return;

        const url = pickRealUrl({
            url: item.url,
            fileUrl: item.fileUrl,
            value: item.value,
            thumbnail: item.thumbnail,
        });
        if (!url) return;

        seenKeys.add(key);
        counters[item.type] += 1;
        ordered.push({
            type: item.type,
            index: counters[item.type],
            url,
            key,
            mentionId: item.mentionId ?? null,
            source: "reference",
            label: item.originalLabel ?? item.label ?? null,
        });
    });

    return ordered;
};

export interface NormalizeVideoMediaReferencesInput {
    /** TipTap 编辑器的 ProseMirror 文档根节点（doc.getJSON()） */
    promptDoc?: unknown;
    /** 上方参考列表中的媒体（MentionItem[]） */
    referenceItems: MentionItem[];
    /** 编辑器纯文本（fallback：当无法解析 TipTap doc 时使用） */
    promptText?: string;
}

/**
 * 统一归一化入口。
 *
 * - 解析 TipTap 文档中所有 mention 节点，按文档顺序编号。
 * - 剩余未在正文提及的媒体从 referenceItems 末尾追加。
 * - 返回严格按 ImageN/AudioN/VideoN 顺序排列的最终请求数据。
 */
export const normalizeVideoMediaReferences = ({
    promptDoc,
    referenceItems,
    promptText,
}: NormalizeVideoMediaReferencesInput): NormalizeResult => {
    const promptMentions = extractMentionsFromProseMirrorDoc(promptDoc);
    const promptEntries = buildOrderedMentions(promptMentions);

    const allEntries = appendFromReferenceItems(promptEntries, referenceItems);

    const replacements = new Map<string, string>();
    promptEntries.forEach((entry) => {
        if (!entry.mentionId) return;
        const placeholder = `${PLACEHOLDER_PREFIX[entry.type]}${entry.index}`;
        replacements.set(entry.mentionId, placeholder);
    });

    // doc 中可能存在未在 promptMentions 中（id 缺失等）的 mention；为它们生成默认占位符。
    const docMentions = promptDoc
        ? extractMentionsFromProseMirrorDoc(promptDoc)
        : [];
    const fallbackCounters: Record<MediaKind, number> = {
        image: 0,
        audio: 0,
        video: 0,
    };
    promptEntries.forEach((entry) => {
        fallbackCounters[entry.type] = Math.max(
            fallbackCounters[entry.type],
            entry.index,
        );
    });
    docMentions.forEach((mention) => {
        const mentionId = mention.id ?? "";
        if (!mentionId || replacements.has(mentionId)) return;
        const kind = resolveMentionKind(mention);
        if (!kind) return;
        fallbackCounters[kind] += 1;
        const placeholder = `${PLACEHOLDER_PREFIX[kind]}${fallbackCounters[kind]}`;
        replacements.set(mentionId, placeholder);
    });

    const normalizedPrompt = promptDoc
        ? replaceMentionsInDoc(promptDoc, replacements)
        : promptText ?? "";

    const splitByKind = (kind: MediaKind) =>
        allEntries.filter((entry) => entry.type === kind);

    const buildItems = (kind: MediaKind) => {
        const entries = splitByKind(kind);
        return entries.map((entry, ordinal) => {
            const placeholder = `${PLACEHOLDER_PREFIX[entry.type]}${entry.index}`;
            return toMentionItem(
                { ...entry, index: ordinal + 1 },
                placeholder,
                entry.label,
            );
        });
    };

    return {
        prompt: normalizedPrompt,
        images: splitByKind("image"),
        audios: splitByKind("audio"),
        videos: splitByKind("video"),
        referenceItems: [
            ...buildItems("image"),
            ...buildItems("video"),
            ...buildItems("audio"),
        ],
    };
};

/** 暴露给 UI 的工具：把归一化结果按类型分组返回最终 URL 数组 */
export const splitReferenceUrls = (result: NormalizeResult) => ({
    images: result.images.map((entry) => entry.url),
    audios: result.audios.map((entry) => entry.url),
    videos: result.videos.map((entry) => entry.url),
});
