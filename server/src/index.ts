import "dotenv/config";

import axios from "axios";
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

  WUHEI_API_BASE_URL: z.string().default("https://api.wuhenai.com/v2"),
  WUHEI_API_KEY: z.string().optional(),
  WUHEI_NOTIFY_CALLBACK_URL: z.string().optional(),

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

type WuhenVideoRemovalTaskStatus =
  | "created"
  | "queued"
  | "processing"
  | "success"
  | "failed"
  | "paused";

type WuhenRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type WuhenVideoRemovalTaskRecord = {
  taskId: string;
  sourceVideoUrl: string;
  resultVideoUrl: string;
  uploadUrl: string;
  model: string;
  rect: WuhenRect;
  status: WuhenVideoRemovalTaskStatus;
  progress: number;
  message?: string;
  description?: string;
  credits?: number | null;
  metering?: number | null;
  createdAt: number;
  updatedAt: number;
  completedAt?: number | null;
};

const wuhenTasks = new Map<string, WuhenVideoRemovalTaskRecord>();

const wuhenCreateSchema = z.object({
  sourceVideoUrl: z.string().url(),
  uploadUrl: z.string().url(),
  uploadHeaders: z.record(z.string()).optional(),
  resultVideoUrl: z.string().url(),
  rect: z.object({
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
  }),
  model: z.enum(["video_removal_std", "video_removal_pro"]).optional(),
});

app.post("/api/wuhen/video-removal/create", async (req, res) => {
  const parsed = wuhenCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误" });
    return;
  }

  const payload = parsed.data;
  const now = Date.now();

  if (!env.WUHEI_API_KEY) {
    const taskId = `mock_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const record: WuhenVideoRemovalTaskRecord = {
      taskId,
      sourceVideoUrl: payload.sourceVideoUrl,
      resultVideoUrl: payload.sourceVideoUrl,
      uploadUrl: payload.uploadUrl,
      model: payload.model ?? "video_removal_std",
      rect: payload.rect,
      status: "success",
      progress: 100,
      message: "mock",
      credits: null,
      metering: null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    };
    wuhenTasks.set(taskId, record);
    res.json({
      success: true,
      data: {
        taskId,
        status: record.status,
        resultVideoUrl: record.resultVideoUrl,
      },
    });
    return;
  }

  try {
    const accessToken = await exchangeWuhenAccessToken({
      apiBaseUrl: env.WUHEI_API_BASE_URL,
      apiKey: env.WUHEI_API_KEY,
    });

    if (env.WUHEI_NOTIFY_CALLBACK_URL) {
      await setWuhenNotifyCallback({
        apiBaseUrl: env.WUHEI_API_BASE_URL,
        accessToken,
        callbackUrl: env.WUHEI_NOTIFY_CALLBACK_URL,
      });
    }

    const taskId = await createWuhenVideoRemovalTask({
      apiBaseUrl: env.WUHEI_API_BASE_URL,
      accessToken,
      videoUrl: payload.sourceVideoUrl,
      model: payload.model ?? "video_removal_std",
      rect: payload.rect,
      uploadUrl: payload.uploadUrl,
      uploadHeaders: payload.uploadHeaders ?? {},
    });

    const record: WuhenVideoRemovalTaskRecord = {
      taskId,
      sourceVideoUrl: payload.sourceVideoUrl,
      resultVideoUrl: payload.resultVideoUrl,
      uploadUrl: payload.uploadUrl,
      model: payload.model ?? "video_removal_std",
      rect: payload.rect,
      status: "queued",
      progress: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    wuhenTasks.set(taskId, record);

    res.json({
      success: true,
      data: {
        taskId,
        status: record.status,
        resultVideoUrl: record.resultVideoUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || "创建任务失败",
    });
  }
});

app.get("/api/wuhen/video-removal/status", async (req, res) => {
  const taskId = String(req.query.taskId || "");
  if (!taskId) {
    res.status(400).json({ success: false, error: "taskId 不能为空" });
    return;
  }

  const record = wuhenTasks.get(taskId);
  if (!record) {
    res.status(404).json({ success: false, error: "任务不存在" });
    return;
  }

  res.json({ success: true, data: record });
});

const wuhenNotifySchema = z.object({
  type: z.number().optional(),
  msg: z.string().optional(),
  data: z
    .object({
      task_id: z.string().min(1),
      task_type: z.string().optional(),
      status: z.string().min(1),
      progress: z.number().optional(),
      metering: z.number().optional(),
      credits: z.number().optional(),
      description: z.string().optional(),
    })
    .passthrough(),
}).passthrough();

app.post("/api/wuhen/notify", async (req, res) => {
  const parsed = wuhenNotifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false });
    return;
  }

  const taskId = parsed.data.data.task_id;
  const record = wuhenTasks.get(taskId);
  if (!record) {
    res.json({ ok: true });
    return;
  }

  const nextStatus = parsed.data.data.status as WuhenVideoRemovalTaskStatus;
  const nextProgress = parsed.data.data.progress ?? record.progress;
  const next: WuhenVideoRemovalTaskRecord = {
    ...record,
    status: nextStatus,
    progress: nextProgress,
    message: parsed.data.msg ?? record.message,
    description: parsed.data.data.description ?? record.description,
    credits:
      typeof parsed.data.data.credits === "number"
        ? parsed.data.data.credits
        : record.credits ?? null,
    metering:
      typeof parsed.data.data.metering === "number"
        ? parsed.data.data.metering
        : record.metering ?? null,
    updatedAt: Date.now(),
    completedAt:
      nextStatus === "success" || nextStatus === "failed"
        ? Date.now()
        : record.completedAt ?? null,
  };

  wuhenTasks.set(taskId, next);
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

async function exchangeWuhenAccessToken(params: {
  apiBaseUrl: string;
  apiKey: string;
}) {
  const nonce = randomUUID().replaceAll("-", "");
  const t = String(Date.now());
  const response = await axios.get(`${params.apiBaseUrl}/user/access_token`, {
    params: { api_key: params.apiKey, nonce, t },
    timeout: 30_000,
  });

  const code = response.data?.code;
  if (code !== 0) {
    const message = response.data?.message || "exchange_access_token failed";
    throw new Error(message);
  }

  const accessToken = String(response.data?.data?.access_token || "").trim();
  if (!accessToken) {
    throw new Error("access_token is empty");
  }
  return accessToken;
}

async function setWuhenNotifyCallback(params: {
  apiBaseUrl: string;
  accessToken: string;
  callbackUrl: string;
}) {
  const nonce = randomUUID().replaceAll("-", "");
  const t = String(Date.now());
  const response = await axios.get(`${params.apiBaseUrl}/user/notify_callback`, {
    params: { callback_url: params.callbackUrl, nonce, t },
    headers: { Authorization: `Bearer ${params.accessToken}` },
    timeout: 30_000,
  });

  const code = response.data?.code;
  if (code !== 0) {
    const message = response.data?.message || "set_notify_callback failed";
    throw new Error(message);
  }
}

async function createWuhenVideoRemovalTask(params: {
  apiBaseUrl: string;
  accessToken: string;
  videoUrl: string;
  model: "video_removal_std" | "video_removal_pro";
  rect: WuhenRect;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
}) {
  const nonce = randomUUID().replaceAll("-", "");
  const t = String(Date.now());
  const response = await axios.post(
    `${params.apiBaseUrl}/video_removal`,
    {
      video_url: params.videoUrl,
      model: params.model,
      method: "sel_area",
      rect: params.rect,
      upload_url: params.uploadUrl,
      upload_headers: params.uploadHeaders,
    },
    {
      params: { nonce, t },
      headers: { Authorization: `Bearer ${params.accessToken}` },
      timeout: 30_000,
    },
  );

  const code = response.data?.code;
  if (code !== 0) {
    const message = response.data?.message || "create video_removal task failed";
    throw new Error(message);
  }

  const taskId = String(response.data?.data?.task_id || "").trim();
  if (!taskId) {
    throw new Error("task_id is empty");
  }
  return taskId;
}
