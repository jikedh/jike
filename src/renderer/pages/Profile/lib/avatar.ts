// 与 UserAvatarDropdown 保持一致的 dicebear 头像生成逻辑
const AVATAR_STYLES = [
    "adventurer",
    "adventurer-neutral",
    "avataaars",
    "big-ears",
    "big-smile",
    "bottts",
    "croodles",
    "fun-emoji",
];

export const getAvatarStyle = (seed: string) => {
    const index =
        seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
        AVATAR_STYLES.length;
    return AVATAR_STYLES[index];
};

export const getAvatarUrl = (seed: string, style?: string) => {
    const finalStyle = style ?? getAvatarStyle(seed);
    return `https://api.dicebear.com/7.x/${finalStyle}/svg?seed=${encodeURIComponent(seed)}`;
};
