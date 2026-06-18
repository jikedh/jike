// 个人中心静态 mock 数据，后续接入真实接口时替换该文件即可
export const PROFILE_MOCK = {
    userId: "88592031",
    nickname: "即刻创作者",
    email: "creator@jike.app",
    phone: "138****6688",
    vipLabel: "PRO MEMBER",
    registeredAt: "2024年3月",
    lastPasswordUpdate: "2025年12月",
};

export type ProfileMock = typeof PROFILE_MOCK;
