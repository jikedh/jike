import {
    createPresetPrompt,
    deletePresetPrompt,
    listPresetPrompts,
    updatePresetPrompt,
    type PresetPromptItem,
} from "@/api/jikeGo";
import {
    defaultPresets,
    type PresetItem,
    type PresetsMap,
} from "shared/constants/preset-prompts";

/**
 * 预设提示词库 — 后端化版本
 *
 * - 通过 `jikeGo` HTTP API 拉取/写入后端数据库。
 * - 进程内维护一份缓存 + inflight 去重。
 * - 写操作成功后派发 `CANVAS_PRESETS_UPDATED_EVENT` 通知订阅者刷新。
 */

export const CANVAS_PRESETS_UPDATED_EVENT = "canvas-presets-updated";

export type { PresetItem, PresetsMap };

export type PresetOpResult = {
    success: boolean;
    error?: string;
    preset?: PresetItem;
};

const emit = () => {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CANVAS_PRESETS_UPDATED_EVENT));
    }
};

const toPresetItem = (item: PresetPromptItem): PresetItem => ({
    id: item.id,
    category: item.category,
    name: item.name,
    content: item.content,
    enabled: !!item.enabled,
    sort_order: item.sort_order,
});

const flattenCache = (cache: PresetsMap | null): PresetItem[] =>
    cache ? Object.values(cache).flat() : [];

const groupByCategory = (items: PresetItem[]): PresetsMap => {
    const map: PresetsMap = {};
    for (const item of items) {
        if (!map[item.category]) map[item.category] = [];
        map[item.category].push(item);
    }
    return map;
};

let cache: PresetsMap | null = null;
let inflight: Promise<PresetsMap | null> | null = null;

export const presetStorage = {
    /**
     * 读取并归类后的预设。
     * - 命中缓存直接返回。
     * - 未命中则拉取后端数据；失败兜底 `defaultPresets`。
     */
    async loadPresets(): Promise<PresetsMap> {
        if (cache) return cache;
        if (inflight) return (await inflight) ?? defaultPresets;

        inflight = (async () => {
            try {
                const res = await listPresetPrompts();
                const list: PresetPromptItem[] = res?.data?.presets ?? [];
                const items = list.map(toPresetItem);
                cache = items.length > 0 ? groupByCategory(items) : defaultPresets;
                return cache;
            } catch {
                cache = defaultPresets;
                return cache;
            } finally {
                inflight = null;
            }
        })();

        return (await inflight) ?? defaultPresets;
    },

    /**
     * 新增预设。
     */
    async createPreset(input: {
        category: string;
        name: string;
        content: string;
        enabled?: boolean;
    }): Promise<PresetOpResult> {
        try {
            const res = await createPresetPrompt({
                category: input.category,
                name: input.name,
                content: input.content,
                enabled: input.enabled ?? true,
            });
            const preset = toPresetItem(res?.data?.preset);
            cache = groupByCategory([...flattenCache(cache), preset]);
            emit();
            return { success: true, preset };
        } catch (e: any) {
            return {
                success: false,
                error: e?.message ?? e?.response?.data?.message ?? "创建预设失败",
            };
        }
    },

    /**
     * 更新预设。
     */
    async updatePreset(input: {
        id: string;
        name?: string;
        content?: string;
        enabled?: boolean;
        category?: string;
    }): Promise<PresetOpResult> {
        try {
            const res = await updatePresetPrompt(input);
            const updated = toPresetItem(res?.data?.preset);
            const merged = flattenCache(cache).map((item) =>
                item.id === updated.id ? { ...item, ...updated } : item,
            );
            cache = groupByCategory(merged);
            emit();
            return { success: true, preset: updated };
        } catch (e: any) {
            return {
                success: false,
                error: e?.message ?? e?.response?.data?.message ?? "更新预设失败",
            };
        }
    },

    /**
     * 删除预设（本地立即从缓存移除，失败时回滚）。
     */
    async deletePreset(id: string): Promise<PresetOpResult> {
        const previous = cache;
        cache = groupByCategory(
            flattenCache(cache).filter((item) => item.id !== id),
        );
        try {
            await deletePresetPrompt({ id });
            emit();
            return { success: true };
        } catch (e: any) {
            cache = previous;
            return {
                success: false,
                error: e?.message ?? e?.response?.data?.message ?? "删除预设失败",
            };
        }
    },

    /**
     * 调试 / 测试用：清空内存缓存与 inflight。
     */
    __resetForTest() {
        cache = null;
        inflight = null;
    },
};

export type { PresetPromptItem };