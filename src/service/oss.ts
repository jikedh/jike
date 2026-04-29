import OSS from "ali-oss";

const client = new OSS({
  region: import.meta.env.VITE_OSS_REGION,
  accessKeyId: import.meta.env.VITE_OSS_ACCESS_KEY_ID,
  accessKeySecret: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET,
  bucket: import.meta.env.VITE_OSS_BUCKET,
});

// ===================== 预设缩略图尺寸 =====================

/** 常用缩略图尺寸比例 */
export const THUMBNAIL_SIZES = {
  /** 1:1 正方形 */
  SQUARE: { width: 100, height: 100 },
  /** 4:3 横版 */
  RATIO_4_3: { width: 200, height: 150 },
  /** 16:9 横版宽屏 */
  RATIO_16_9: { width: 320, height: 180 },
  /** 9:16 竖版 */
  RATIO_9_16: { width: 180, height: 320 },
  /** 缩放至宽度 200 */
  WIDTH_200: { width: 200 },
  /** 缩放至宽度 400 */
  WIDTH_400: { width: 400 },
} as const;

/**
 * 缩略图操作类型
 * - resize: 缩放
 * - format: 格式转换
 * - ignore-error: 忽略错误
 */
export type ImageActionType = "resize" | "format" | "ignore-error";

/** 缩放模式 */
export type ResizeMode = "m_fill" | "m_fit" | "m_lfit";

/** 缩放操作参数 */
export interface ResizeOptions {
  type: "resize";
  mode?: ResizeMode;
  width?: number;
  height?: number;
}

/** 格式转换操作参数 */
export interface FormatOptions {
  type: "format";
  format: "webp" | "jpg" | "png" | "gif";
}

/** 忽略错误操作参数 */
export interface IgnoreErrorOptions {
  type: "ignore-error";
  value: 1;
}

/** 链式操作单元 */
export type ImageAction = ResizeOptions | FormatOptions | IgnoreErrorOptions;

/**
 * 生成阿里云 OSS 图片处理 URL（支持链式操作）
 * 利用 OSS 原生图片处理能力，无需额外 API 调用
 *
 * @param ossUrl 原始 OSS 图片 URL
 * @param actions 操作链（如 [{ type: 'resize', width: 200 }, { type: 'format', format: 'webp' }]）
 * @returns 带图片处理参数的 OSS URL
 *
 * @example
 * // 原图: http://xxx.oss-cn-hangzhou.aliyuncs.com/image/xxx.jpg
 *
 * // 单操作：缩放至宽度 200
 * generateImageUrl(url, [{ type: 'resize', width: 200 }])
 * // -> http://xxx.oss-cn-hangzhou.aliyuncs.com/image/xxx.jpg?x-oss-process=image/resize,w_200
 *
 * // 链式操作：缩放 + 转 webp + 忽略错误
 * generateImageUrl(url, [
 *   { type: 'resize', mode: 'm_fill', width: 100, height: 100 },
 *   { type: 'format', format: 'webp' },
 *   { type: 'ignore-error', value: 1 }
 * ])
 * // -> http://xxx.oss-cn-hangzhou.aliyuncs.com/image/xxx.jpg?x-oss-process=image/resize,m_fill,w_100,h_100/format,webp/ignore-error,1
 */
export function generateImageUrl(
  ossUrl: string,
  actions: ImageAction[],
): string {
  if (!actions || actions.length === 0) {
    return ossUrl;
  }

  // 清理 URL 中的现有查询参数
  const [baseUrl] = ossUrl.split("?");

  // 构建操作链
  const actionParts = actions
    .map((action) => {
      switch (action.type) {
        case "resize": {
          const { mode = "m_fit", width, height } = action;
          if (width && height) {
            return `resize,${mode},w_${width},h_${height}`;
          } else if (width) {
            return `resize,w_${width}`;
          } else if (height) {
            return `resize,h_${height}`;
          }
          return "resize";
        }
        case "format":
          return `format,${action.format}`;
        case "ignore-error":
          return `ignore-error,${action.value}`;
        default:
          return "";
      }
    })
    .filter(Boolean);

  if (actionParts.length === 0) {
    return baseUrl;
  }

  return `${baseUrl}?x-oss-process=image/${actionParts.join("/")}`;
}

/**
 * 快捷方法：使用预设尺寸 + 格式转换生成缩略图 URL
 * @example
 * generateThumbnailWithFormat(url, 'SQUARE', 'webp')
 * // -> http://xxx.oss-cn-hangzhou.aliyuncs.com/image/xxx.jpg?x-oss-process=image/resize,m_fit,w_100,h_100/format,webp/ignore-error,1
 */
export function generateThumbnailWithFormat(
  ossUrl: string,
  preset: keyof typeof THUMBNAIL_SIZES,
  format: "webp" | "jpg" | "png" = "webp",
  mode: ResizeMode = "m_fit",
): string {
  const size = THUMBNAIL_SIZES[preset];
  if (!size) {
    console.warn(`[OSS] Unknown thumbnail preset: ${preset}`);
    return ossUrl;
  }

  const actions: ImageAction[] = [];

  // 添加 resize 操作
  if ("width" in size && "height" in size) {
    actions.push({
      type: "resize",
      mode,
      width: size.width,
      height: size.height,
    });
  } else if ("width" in size) {
    actions.push({ type: "resize", mode, width: size.width });
  }

  // 添加 format 操作
  actions.push({ type: "format", format });

  // 添加 ignore-error
  actions.push({ type: "ignore-error", value: 1 });

  return generateImageUrl(ossUrl, actions);
}

// ===================== 视频截帧 =====================

/**
 * 视频截帧操作参数
 * @see https://help.aliyun.com/document_detail/64572.html
 */
export interface VideoSnapshotOptions {
  /** 时间点，单位毫秒（ms），如 5000 表示第 5 秒 */
  time?: number;
  /** 输出宽度 */
  width?: number;
  /** 输出高度 */
  height?: number;
  /** 输出格式：jpg | png */
  format?: "jpg" | "png";
}

/**
 * 生成阿里云 OSS 视频截帧 URL
 * 利用 OSS 原生视频处理能力，无需额外 API 调用
 *
 * @param ossUrl 原始 OSS 视频 URL（支持 mp4、mov 等格式）
 * @param options 截帧参数
 * @returns 带截帧参数的 OSS URL
 *
 * @example
 * // 截取第 5 秒的帧
 * generateVideoSnapshotUrl(videoUrl, { time: 5000 })
 * // -> http://xxx.oss-cn-hangzhou.aliyuncs.com/video/xxx.mp4?x-oss-process=video/snapshot,t_5000,m_fast
 *
 * // 截取第 10 秒的帧，指定输出尺寸和格式
 * generateVideoSnapshotUrl(videoUrl, { time: 10000, width: 1280, height: 720, format: 'jpg' })
 * // -> http://xxx.oss-cn-hangzhou.aliyuncs.com/video/xxx.mp4?x-oss-process=video/snapshot,t_10000,m_fast,w_1280,h_720/format,jpg
 */
export function generateVideoSnapshotUrl(
  ossUrl: string,
  options: VideoSnapshotOptions = {},
): string {
  const { time, width, height, format = "jpg" } = options;

  // 清理 URL 中的现有查询参数
  const [baseUrl] = ossUrl.split("?");

  // 构建截帧操作链，格式参考：
  // https://zhaojingnan.oss-cn-hangzhou.aliyuncs.com/videos/1775508606208-q0xjjh.mp4?x-oss-process=video/snapshot,t_5000,f_jpg,w_0,h_0,interlace_1
  const actionParts: string[] = [];

  // 时间点（必填，使用 0 作为默认值表示尾帧）
  actionParts.push(`t_${time ?? 0}`);

  // 格式：f_jpg
  actionParts.push(`f_${format}`);

  // 宽高：w_0,h_0 表示使用原视频宽高
  actionParts.push(`w_${width ?? 0}`);
  actionParts.push(`h_${height ?? 0}`);

  // 交错格式
  actionParts.push("interlace_1");

  return `${baseUrl}?x-oss-process=video/snapshot,${actionParts.join(",")}`;
}

/**
 * 生成视频尾帧 URL
 * 实际上是截取最后一帧，等价于 time=0 但 OSS 会自动取最后一帧
 *
 * @param ossUrl 原始 OSS 视频 URL
 * @param options 截帧参数（time 会被忽略）
 * @returns 带尾帧截取参数的 OSS URL
 *
 * @example
 * generateVideoLastFrameUrl(videoUrl)
 * // -> http://xxx.oss-cn-hangzhou.aliyuncs.com/video/xxx.mp4?x-oss-process=video/snapshot,t_0,m_fast/format,jpg
 */
export function generateVideoLastFrameUrl(
  ossUrl: string,
  options: Omit<VideoSnapshotOptions, "time"> = {},
): string {
  const { width, height, format = "jpg" } = options;

  // 清理 URL 中的现有查询参数
  const [baseUrl] = ossUrl.split("?");

  // 构建截帧操作链，格式参考：
  // https://zhaojingnan.oss-cn-hangzhou.aliyuncs.com/videos/1775508606208-q0xjjh.mp4?x-oss-process=video/snapshot,t_5000,f_jpg,w_0,h_0,interlace_1
  const actionParts: string[] = [];

  // t_0 在 OSS 中表示最后一帧
  actionParts.push("t_0");

  // 格式：f_jpg
  actionParts.push(`f_${format}`);

  // 宽高：w_0,h_0 表示使用原视频宽高
  actionParts.push(`w_${width ?? 0}`);
  actionParts.push(`h_${height ?? 0}`);

  // 交错格式
  actionParts.push("interlace_1");

  return `${baseUrl}?x-oss-process=video/snapshot,${actionParts.join(",")}`;
}

// ===================== 文件上传 =====================

export async function uploadFileToOSS(file: File) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  // 根据扩展名自动判断目录
  const videoExts = ["mp4", "mov", "avi", "mkv", "webm", "flv"];
  const audioExts = ["mp3", "wav", "ogg", "aac", "flac"];

  let directory = "image";
  if (videoExts.includes(ext)) {
    directory = "video";
  } else if (audioExts.includes(ext)) {
    directory = "audio";
  }

  const fileName = `${directory}/${timestamp}-${random}.${ext}`;

  const result = await client.put(fileName, file);

  return { url: result.url, name: file.name };
}

/**
 * 将远程视频 URL 转存到用户 OSS
 * 1. 从源 URL 获取视频 blob
 * 2. 上传到用户 OSS
 * 3. 返回转存后的 OSS URL（失败返回 null）
 */
export async function copyVideoUrlToOss(videoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error("[OSS] Failed to fetch video for copy:", response.statusText);
      return null;
    }

    const blob = await response.blob();
    const ext = blob.type.split("/")[1]?.toLowerCase() || "mp4";
    const fileName = `copied-video-${Date.now()}.${ext}`;
    const file = new File([blob], fileName, { type: blob.type });

    const uploadResult = await uploadFileToOSS(file);
    if (!uploadResult.url) {
      console.error("[OSS] Failed to upload copied video");
      return null;
    }

    return uploadResult.url;
  } catch (error) {
    console.error("[OSS] copyVideoUrlToOss error:", error);
    return null;
  }
}

export type OssSignedUploadTarget = {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  uploadHeaders: Record<string, string>;
};

/**
 * 创建一个可供第三方服务 PUT 上传的 OSS 预签名目标。
 * 典型场景：异步视频处理平台在完成处理后，直接把结果上传回该地址。
 */
export async function createSignedUploadTargetToOSS(options?: {
  directory?: "video" | "image" | "audio";
  extension?: string;
  contentType?: string;
}) {
  const directory = options?.directory ?? "video";
  const extension = (options?.extension ?? "mp4").replace(/^\./, "").toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const objectKey = `${directory}/${timestamp}-${random}.${extension}`;
  const uploadHeaders: Record<string, string> = {};

  const uploadUrl = client.signatureUrl(
    objectKey,
    {
      method: "PUT",
      expires: 24 * 60 * 60,
    } as any,
  );

  return {
    objectKey,
    uploadUrl,
    publicUrl: uploadUrl.split("?")[0],
    uploadHeaders,
  } satisfies OssSignedUploadTarget;
}
