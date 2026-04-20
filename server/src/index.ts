import "dotenv/config";

import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";

import { createDb } from "./db";
import { WechatPayV3Client, type TradeState } from "./wechatPayV3";

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  CORS_ORIGIN: z.string().optional(),
  DB_PATH: z.string().default("server/data/payments.sqlite3"),

  WECHATPAY_MCHID: z.string().min(1),
  WECHATPAY_APPID: z.string().min(1),
  WECHATPAY_API_V3_KEY: z.string().min(32),
  WECHATPAY_MCH_CERT_SERIAL: z.string().min(1),
  WECHATPAY_MCH_PRIVATE_KEY_PEM: z.string().optional(),
  WECHATPAY_MCH_PRIVATE_KEY_PATH: z.string().optional(),
  WECHATPAY_NOTIFY_URL: z.string().url(),
});

const env = envSchema.parse(process.env);
const mchPrivateKeyPem =
  env.WECHATPAY_MCH_PRIVATE_KEY_PEM?.trim() ||
  (env.WECHATPAY_MCH_PRIVATE_KEY_PATH
    ? readFileSync(env.WECHATPAY_MCH_PRIVATE_KEY_PATH, "utf8")
    : "");
if (!mchPrivateKeyPem) {
  throw new Error("WECHATPAY_MCH_PRIVATE_KEY_PEM 或 WECHATPAY_MCH_PRIVATE_KEY_PATH 必须配置其一");
}
const db = createDb(env.DB_PATH);

const wechatPay = new WechatPayV3Client({
  mchid: env.WECHATPAY_MCHID,
  appid: env.WECHATPAY_APPID,
  apiV3Key: env.WECHATPAY_API_V3_KEY,
  mchCertSerial: env.WECHATPAY_MCH_CERT_SERIAL,
  mchPrivateKeyPem,
  notifyUrl: env.WECHATPAY_NOTIFY_URL,
});

const RECHARGE_PACKAGES = [
  { packageId: "pkg_500", points: 500, amountFen: 1 },
  { packageId: "pkg_2000", points: 2000, amountFen: 1 },
  { packageId: "pkg_5000", points: 5000, amountFen: 1 },
  { packageId: "pkg_12000", points: 12000, amountFen: 1 },
] as const;

const createRechargeOrderSchema = z.object({
  userId: z.string().min(1),
  packageId: z.string().min(1),
});

const app = express();
app.use(
  cors({
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",") : true,
    credentials: true,
  }),
);
const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.path === "/api/wechatpay/notify") {
    next();
    return;
  }
  jsonParser(req, res, next);
});

app.get("/healthz", (_, res) => {
  res.json({ ok: true });
});

app.post("/api/recharge/native/create", async (req, res) => {
  const parsed = createRechargeOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误" });
    return;
  }

  const { userId, packageId } = parsed.data;
  const pkg = RECHARGE_PACKAGES.find((p) => p.packageId === packageId);
  if (!pkg) {
    res.status(400).json({ success: false, error: "套餐不存在" });
    return;
  }

  const orderId = buildOutTradeNo();
  const attach = JSON.stringify({
    type: "RECHARGE_POINTS",
    userId,
    packageId,
    points: pkg.points,
  });

  try {
    const { codeUrl } = await wechatPay.createNativeOrder({
      description: `积分充值 ${pkg.points}`,
      outTradeNo: orderId,
      amountFen: pkg.amountFen,
      attach,
    });

    const now = Date.now();
    await db.insertOrder({
      id: orderId,
      userId,
      packageId,
      points: pkg.points,
      amountFen: pkg.amountFen,
      codeUrl,
      status: "CREATED",
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    });

    res.json({
      success: true,
      data: {
        orderId,
        codeUrl,
        points: pkg.points,
        amountFen: pkg.amountFen,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || "创建订单失败",
    });
  }
});

app.get("/api/recharge/native/status", async (req, res) => {
  const orderId = String(req.query.orderId || "");
  if (!orderId) {
    res.status(400).json({ success: false, error: "orderId 不能为空" });
    return;
  }

  const order = await db.getOrder(orderId);
  if (!order) {
    res.status(404).json({ success: false, error: "订单不存在" });
    return;
  }

  if (order.status === "PAID") {
    res.json({ success: true, data: { orderId, status: order.status } });
    return;
  }

  try {
    const { tradeState } = await wechatPay.queryOrderByOutTradeNo(orderId);
    const mapped = mapTradeStateToOrderStatus(tradeState);

    if (mapped !== order.status) {
      await db.updateOrderStatus({
        id: orderId,
        status: mapped,
        updatedAt: Date.now(),
        paidAt: mapped === "PAID" ? Date.now() : null,
      });
    }

    res.json({
      success: true,
      data: { orderId, status: mapped, tradeState },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || "查询订单失败",
    });
  }
});

app.post(
  "/api/wechatpay/notify",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : "";

    try {
      const { transaction } = await wechatPay.verifyAndDecryptNotify({
        rawBody,
        headers: req.headers,
      });

      const orderId = transaction.out_trade_no;
      const order = await db.getOrder(orderId);
      if (!order) {
        res.status(200).json({ code: "SUCCESS", message: "OK" });
        return;
      }

      if (transaction.trade_state === "SUCCESS") {
        const existingLedger = await db.getLedgerByOrder(orderId);
        if (!existingLedger) {
          await db.insertLedger({
            id: randomUUID(),
            userId: order.userId,
            orderId,
            points: order.points,
            createdAt: Date.now(),
          });
        }

        await db.updateOrderStatus({
          id: orderId,
          status: "PAID",
          updatedAt: Date.now(),
          paidAt: Date.now(),
        });
      } else {
        const mapped = mapTradeStateToOrderStatus(transaction.trade_state);
        await db.updateOrderStatus({
          id: orderId,
          status: mapped,
          updatedAt: Date.now(),
          paidAt: null,
        });
      }

      res.status(200).json({ code: "SUCCESS", message: "OK" });
    } catch {
      res.status(200).json({ code: "FAIL", message: "验签失败" });
    }
  },
);

app.listen(env.PORT, () => {
  console.log(`pay server listening on http://localhost:${env.PORT}`);
});

function buildOutTradeNo() {
  const date = new Date();
  const y = date.getFullYear().toString();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const rand = randomUUID().replaceAll("-", "").slice(0, 8);

  // 微信支付 out_trade_no 要求：
  // - 仅能包含数字、大小写字母、_、-
  // - 长度 <= 32
  // 这里固定 25 位：rcg + YYYYMMDDHHMMSS + 8 位随机
  return `rcg${y}${m}${d}${hh}${mm}${ss}${rand}`;
}

function mapTradeStateToOrderStatus(tradeState: TradeState) {
  if (tradeState === "SUCCESS") {
    return "PAID" as const;
  }

  if (tradeState === "CLOSED" || tradeState === "REVOKED") {
    return "CLOSED" as const;
  }

  return "CREATED" as const;
}
