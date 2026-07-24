/** 团队页展示辅助函数。 */

/** 将秒级时间戳格式化为 zh-CN 日期时间。 */
export const formatTeamTime = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleString("zh-CN", {
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
