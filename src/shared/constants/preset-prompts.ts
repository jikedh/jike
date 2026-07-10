export type PresetItem = {
    id: string;
    category: string;
    name: string;
    content: string;
    enabled: boolean;
    sort_order?: number;
};

export type PresetsMap = Record<string, PresetItem[]>;

/**
 * 默认推荐预设
 *
 * 仅在用户从未保存过任何预设时展示，不写回本地存储或后端；
 * 用户首次保存预设后，服务端数据将完全替代这些默认项。
 */
export const defaultPresets: PresetsMap = {
    general: [
        {
            id: "default-general-2",
            category: "general",
            name: "赛博朋克风格",
            content:
                "Cyberpunk aesthetic, neon lights, rainy streets, futuristic city, high contrast",
            enabled: false,
        },
    ],
    image: [
        {
            id: "default-image-1",
            category: "image",
            name: "电影感光效",
            content:
                "Cinematic lighting, volumetric fog, 8k resolution, highly detailed, anamorphic lens flare",
            enabled: true,
        },
    ],
    video: [
        {
            id: "default-video-3",
            category: "video",
            name: "慢动作特写",
            content:
                "Slow motion, extreme close up, shallow depth of field, 120fps style",
            enabled: true,
        },
    ],
};