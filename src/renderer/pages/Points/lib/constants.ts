export const AVATAR_STYLES = [
  "adventurer",
  "adventurer-neutral",
  "avataaars",
  "big-ears",
  "big-smile",
  "bottts",
  "croodles",
  "fun-emoji",
];

export const RECHARGE_PACKAGES = [
  {
    id: 1,
    packageId: "pkg_600",
    points: 600,
    price: 10,
    originalPrice: 10,
    tag: "入门首选",
  },
  {
    id: 2,
    packageId: "pkg_6000",
    points: 6000,
    price: 100,
    originalPrice: 100,
    tag: "超值特惠",
    popular: true,
  },
  {
    id: 3,
    packageId: "pkg_18000",
    points: 18000,
    price: 300,
    originalPrice: 300,
    tag: "创作达人",
  },
];

export const usageHistory = [
  {
    id: 1,
    type: "生成图像 (Midjourney V6)",
    amount: "-10",
    date: "2024-04-13 12:30",
    status: "success",
  },
  {
    id: 2,
    type: "视频合成 (Sora V1.5)",
    amount: "-50",
    date: "2024-04-12 15:20",
    status: "success",
  },
  {
    id: 3,
    type: "情感配音合成",
    amount: "-5",
    date: "2024-04-11 10:15",
    status: "success",
  },
  {
    id: 4,
    type: "剧本扩写",
    amount: "-2",
    date: "2024-04-10 09:45",
    status: "success",
  },
];

export const transactionHistory = [
  {
    id: 1,
    type: "积分充值 (6000积分)",
    amount: "¥100",
    date: "2024-04-12 18:45",
    method: "微信支付",
  },
  {
    id: 2,
    type: "积分充值 (600积分)",
    amount: "¥10",
    date: "2024-03-25 14:20",
    method: "支付宝",
  },
  {
    id: 3,
    type: "每日签到奖励",
    amount: "+10",
    date: "2024-04-13 09:00",
    method: "系统赠送",
  },
];
