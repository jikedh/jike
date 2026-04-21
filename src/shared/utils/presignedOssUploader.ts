import OSS from "ali-oss";

/**
 * 预签名上传目标结构
 * 与现有业务字段保持一致，方便直接接入已有流程。
 */
export interface PresignedOssUploadTarget {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  uploadHeaders: Record<string, string>;
}

/**
 * 创建预签名上传地址时的参数
 */
export interface CreatePresignedTargetOptions {
  /** OSS 目录 */
  directory?: "video" | "image" | "audio";
  /** 文件扩展名，支持带或不带 . ，如 mp4 / .mp4 */
  extension?: string;
  /** 文件名（不含扩展名），不传时自动生成 */
  fileName?: string;
  /** Content-Type，可选 */
  contentType?: string;
  /** 过期时间（秒），默认 24 小时 */
  expiresSeconds?: number;
}

/**
 * 执行 PUT 上传时的参数
 */
export interface UploadWithPresignedUrlOptions {
  /** 预签名目标 */
  target: Pick<PresignedOssUploadTarget, "uploadUrl" | "publicUrl" | "uploadHeaders">;
  /** 上传内容 */
  data: Blob | ArrayBuffer | Uint8Array | string;
  /** 上传内容类型，可覆盖 target.uploadHeaders 中的 Content-Type */
  contentType?: string;
  /** 超时时间（毫秒），默认读取 VITE_REQUEST_TIMEOUT，兜底 300000 */
  timeoutMs?: number;
}

/**
 * 阿里云 OSS 预签名上传工具类
 *
 * 功能：
 * 1. 生成 PUT 预签名上传地址
 * 2. 使用预签名地址执行上传
 */
export class PresignedOssUploader {
  /**
   * 使用懒初始化避免模块加载即创建实例
   */
  private static client: OSS | null = null;

  /**
   * 获取 OSS 客户端实例
   */
  private static getClient() {
    if (this.client) {
      return this.client;
    }

    this.client = new OSS({
      region: import.meta.env.VITE_OSS_REGION,
      accessKeyId: import.meta.env.VITE_OSS_ACCESS_KEY_ID,
      accessKeySecret: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET,
      bucket: import.meta.env.VITE_OSS_BUCKET,
    });

    return this.client;
  }

  /**
   * 生成对象 key
   */
  private static buildObjectKey(options: CreatePresignedTargetOptions) {
    const directory = options.directory ?? "video";
    const extension = (options.extension ?? "mp4").replace(/^\./, "").toLowerCase();

    if (options.fileName?.trim()) {
      const pureName = options.fileName.replace(/\.[^/.]+$/, "").trim();
      return `${directory}/${pureName}.${extension}`;
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `${directory}/${timestamp}-${random}.${extension}`;
  }

  /**
   * 生成 PUT 预签名上传目标
   */
  static async createTarget(options: CreatePresignedTargetOptions = {}) {
    const client = this.getClient();
    const objectKey = this.buildObjectKey(options);
    const uploadHeaders: Record<string, string> = {};

    // 若设置 contentType，则签名时带上该 header，上传时需保持一致
    if (options.contentType) {
      uploadHeaders["Content-Type"] = options.contentType;
    }

    const uploadUrl = client.signatureUrl(
      objectKey,
      {
        method: "PUT",
        expires: options.expiresSeconds ?? 24 * 60 * 60,
        headers: uploadHeaders,
      } as any,
    );

    return {
      objectKey,
      uploadUrl,
      publicUrl: this.getPublicUrl(uploadUrl),
      uploadHeaders,
    } satisfies PresignedOssUploadTarget;
  }

  /**
   * 使用预签名 URL 执行 PUT 上传
   */
  static async upload(options: UploadWithPresignedUrlOptions) {
    const timeoutMs =
      options.timeoutMs ??
      Number(import.meta.env.VITE_REQUEST_TIMEOUT || 300000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = {
        ...(options.target.uploadHeaders ?? {}),
      } as Record<string, string>;

      if (options.contentType) {
        headers["Content-Type"] = options.contentType;
      }

      const response = await fetch(options.target.uploadUrl, {
        method: "PUT",
        body: options.data as any,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(
          `[OSS Presigned Upload] 上传失败: ${response.status} ${response.statusText}${message ? ` - ${message}` : ""}`,
        );
      }

      return {
        success: true,
        publicUrl: options.target.publicUrl || this.getPublicUrl(options.target.uploadUrl),
      };
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new Error(`[OSS Presigned Upload] 上传超时（${timeoutMs}ms）`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 从预签名 URL 提取可公开访问的基础 URL
   */
  static getPublicUrl(uploadUrl: string) {
    return uploadUrl.split("?")[0];
  }
}

/**
 * 兼容函数式调用：创建预签名目标
 */
export const createPresignedOssUploadTarget = (
  options?: CreatePresignedTargetOptions,
) => PresignedOssUploader.createTarget(options);

/**
 * 兼容函数式调用：执行预签名上传
 */
export const uploadWithPresignedOssUrl = (
  options: UploadWithPresignedUrlOptions,
) => PresignedOssUploader.upload(options);
