/** 团队页展示辅助函数。 */

/**
 * 将日期字符串或秒级时间戳格式化为 zh-CN 日期时间。
 * 后端可能返回 "2026-07-24 16:08:02" 或 Unix 秒级时间戳，两者均兼容。
 */
export const formatTeamTime = (value?: number | string) => {
    if (!value) return "-";
    const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

/** 大额积分千分位展示。 */
export const formatCredits = (value?: number) =>
    (value ?? 0).toLocaleString("zh-CN");
