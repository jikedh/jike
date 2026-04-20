import axios from "axios";
import {
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  createVerify,
  randomBytes,
  sign,
} from "node:crypto";

type WechatPayConfig = {
  mchid: string;
  appid: string;
  apiV3Key: string;
  mchCertSerial: string;
  mchPrivateKeyPem: string;
  notifyUrl: string;
};

type WechatCertificatesResponse = {
  data: Array<{
    serial_no: string;
    effective_time: string;
    expire_time: string;
    encrypt_certificate: {
      algorithm: "AEAD_AES_256_GCM";
      nonce: string;
      associated_data: string;
      ciphertext: string;
    };
  }>;
};

type PlatformCert = {
  serial: string;
  publicKeyPem: string;
  expiresAtMs: number;
};

export type NativeOrderResult = {
  codeUrl: string;
};

export type TradeState =
  | "SUCCESS"
  | "REFUND"
  | "NOTPAY"
  | "CLOSED"
  | "REVOKED"
  | "USERPAYING"
  | "PAYERROR";

export type QueryOrderResult = {
  tradeState: TradeState;
};

export type NotifyEvent = {
  id: string;
  create_time: string;
  event_type: string;
  resource_type: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    associated_data: string;
    nonce: string;
  };
  summary: string;
};

export type NotifyTransaction = {
  out_trade_no: string;
  trade_state: TradeState;
  trade_state_desc: string;
  success_time?: string;
  amount: { total: number; payer_total: number; currency: string; payer_currency: string };
  attach?: string;
};

const WECHAT_API_BASE = "https://api.mch.weixin.qq.com";

export class WechatPayV3Client {
  private readonly config: WechatPayConfig;
  private platformCertCache = new Map<string, PlatformCert>();
  private lastCertFetchMs = 0;

  constructor(config: WechatPayConfig) {
    this.config = config;
  }

  async createNativeOrder(params: {
    description: string;
    outTradeNo: string;
    amountFen: number;
    attach: string;
  }): Promise<NativeOrderResult> {
    const urlPath = "/v3/pay/transactions/native";
    const body = {
      appid: this.config.appid,
      mchid: this.config.mchid,
      description: params.description,
      out_trade_no: params.outTradeNo,
      notify_url: this.config.notifyUrl,
      amount: {
        total: params.amountFen,
        currency: "CNY",
      },
      attach: params.attach,
    };

    const data = await this.request<{ code_url: string }>({
      method: "POST",
      urlPath,
      body,
    });

    return { codeUrl: data.code_url };
  }

  async queryOrderByOutTradeNo(outTradeNo: string): Promise<QueryOrderResult> {
    const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(
      outTradeNo,
    )}?mchid=${encodeURIComponent(this.config.mchid)}`;

    const data = await this.request<{ trade_state: TradeState }>({
      method: "GET",
      urlPath,
    });

    return { tradeState: data.trade_state };
  }

  async verifyAndDecryptNotify(params: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<{ event: NotifyEvent; transaction: NotifyTransaction }> {
    const timestamp = getHeader(params.headers, "wechatpay-timestamp");
    const nonce = getHeader(params.headers, "wechatpay-nonce");
    const signature = getHeader(params.headers, "wechatpay-signature");
    const serial = getHeader(params.headers, "wechatpay-serial");

    if (!timestamp || !nonce || !signature || !serial) {
      throw new Error("缺少微信回调签名头");
    }

    const platformPublicKey = await this.getPlatformPublicKeyBySerial(serial);
    const message = `${timestamp}\n${nonce}\n${params.rawBody}\n`;
    const verified = verifySignature(platformPublicKey, message, signature);
    if (!verified) {
      throw new Error("微信回调验签失败");
    }

    const event = JSON.parse(params.rawBody) as NotifyEvent;
    const decrypted = decryptAes256GcmBase64({
      apiV3Key: this.config.apiV3Key,
      associatedData: event.resource.associated_data,
      nonce: event.resource.nonce,
      ciphertext: event.resource.ciphertext,
    });

    const transaction = JSON.parse(decrypted) as NotifyTransaction;
    return { event, transaction };
  }

  private async request<T>(params: {
    method: "GET" | "POST";
    urlPath: string;
    body?: unknown;
  }): Promise<T> {
    const url = `${WECHAT_API_BASE}${params.urlPath.startsWith("/") ? "" : "/"}${params.urlPath}`;
    const bodyString = params.body ? JSON.stringify(params.body) : "";
    const authorization = this.buildAuthorization({
      method: params.method,
      urlPath: params.urlPath,
      body: bodyString,
    });

    try {
      const response = await axios.request<T>({
        method: params.method,
        url,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        data: params.body,
        timeout: 15000,
      });

      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const body = error?.response?.data;
      const detail =
        typeof body === "string" ? body : body ? JSON.stringify(body) : error?.message;
      throw new Error(`微信支付请求失败(${status ?? "unknown"}): ${detail}`);
    }
  }

  private buildAuthorization(params: {
    method: "GET" | "POST";
    urlPath: string;
    body: string;
  }) {
    const nonceStr = randomBytes(16).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const urlPath = params.urlPath.startsWith("/") ? params.urlPath : `/${params.urlPath}`;

    const message = `${params.method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${params.body}\n`;
    const signature = signMessageWithPrivateKey(message, this.config.mchPrivateKeyPem);

    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${this.config.mchCertSerial}",signature="${signature}"`;
  }

  private async getPlatformPublicKeyBySerial(serial: string) {
    const cached = this.platformCertCache.get(serial);
    if (cached && cached.expiresAtMs > Date.now() + 60_000) {
      return cached.publicKeyPem;
    }

    await this.refreshPlatformCertificatesIfNeeded();
    const next = this.platformCertCache.get(serial);
    if (!next) {
      throw new Error("未找到对应 serial 的微信平台证书");
    }
    return next.publicKeyPem;
  }

  private async refreshPlatformCertificatesIfNeeded() {
    const now = Date.now();
    if (now - this.lastCertFetchMs < 5 * 60_000 && this.platformCertCache.size > 0) {
      return;
    }

    this.lastCertFetchMs = now;
    const urlPath = "/v3/certificates";
    const data = await this.request<WechatCertificatesResponse>({
      method: "GET",
      urlPath,
    });

    const nextCache = new Map<string, PlatformCert>();
    for (const item of data.data) {
      const publicKeyPem = decryptAes256GcmBase64({
        apiV3Key: this.config.apiV3Key,
        associatedData: item.encrypt_certificate.associated_data,
        nonce: item.encrypt_certificate.nonce,
        ciphertext: item.encrypt_certificate.ciphertext,
      });

      nextCache.set(item.serial_no, {
        serial: item.serial_no,
        publicKeyPem,
        expiresAtMs: new Date(item.expire_time).getTime(),
      });
    }

    this.platformCertCache = nextCache;
  }
}

function signMessageWithPrivateKey(message: string, privateKeyPem: string) {
  const key = createPrivateKey(privateKeyPem);
  const signature = sign("RSA-SHA256", Buffer.from(message, "utf8"), key);
  return signature.toString("base64");
}

function verifySignature(publicKeyPem: string, message: string, signatureBase64: string) {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(message, "utf8");
  verifier.end();
  const key = createPublicKey(publicKeyPem);
  return verifier.verify(key, Buffer.from(signatureBase64, "base64"));
}

function decryptAes256GcmBase64(params: {
  apiV3Key: string;
  associatedData: string;
  nonce: string;
  ciphertext: string;
}) {
  const apiV3Key = Buffer.from(params.apiV3Key, "utf8");
  const nonce = Buffer.from(params.nonce, "utf8");
  const ciphertextBuffer = Buffer.from(params.ciphertext, "base64");

  const authTag = ciphertextBuffer.subarray(ciphertextBuffer.length - 16);
  const data = ciphertextBuffer.subarray(0, ciphertextBuffer.length - 16);

  const decipher = createDecipheriv("aes-256-gcm", apiV3Key, nonce);
  decipher.setAAD(Buffer.from(params.associatedData, "utf8"));
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

function getHeader(headers: Record<string, string | string[] | undefined>, name: string) {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  const value = key ? headers[key] : undefined;
  return Array.isArray(value) ? value[0] : value;
}
