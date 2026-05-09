import type { RECHARGE_PACKAGES } from "./constants";

export type ActiveTab = "usage" | "transaction";

export type RechargePackage = (typeof RECHARGE_PACKAGES)[number];

export type NativePayOrder = {
    orderId: string;
    codeUrl: string;
};
