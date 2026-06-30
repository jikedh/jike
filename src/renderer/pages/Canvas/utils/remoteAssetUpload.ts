/**
 * Canvas 远程资产上传流水线
 *
 * 流程：
 *   1. 从 File / URL 拿到 Blob + 元数据（mediaType、宽高、时长、mime、size）
 *   2. SHA-256 哈希文件，调用 checkAssetDuplicate
 *      - 若重复且当前用户可见：直接复用已有资产
 *   3. POST /v1/oss/upload（multipart）由后端转存到 OSS，返回 fileKey 与访问 URL
 *      - 上传链路全程走自家后端，无需预签名 URL
 *   4. createAsset 落库（携带 scope / projectId / 媒体元数据 / 标签）
 *
 * 安全注意：
 * - 预签名 URL 已移除：上传链路完全在后端控制，文件仅通过受信任的反向代理流转。
 * - fileKey / access URL 仅采用 `uploadOssFile` 接口返回值，不允许任意 URL。
 * - 名称、描述、标签依赖 React 自动转义防止 XSS。
 */

import { toast } from "sonner";
import {
  checkAssetDuplicate,
  createAsset,
} from "@/api/assets";
import type {
  ApiEnvelope,
  AssetConditions,
  AssetDetail,
  AssetScope,
  CheckDuplicateResponse,
  MediaType,
  PrimaryCategory,
  UploadOssFileResult,
} from "shared/types/api/assets";
import { getJikeingToken } from "shared/utils/utils";

const JIKE_GO_BASE_URL = import.meta.env.VITE_JIKE_GO_BASE_URL;

/**
 * 后端 envelope 判定 + 解包：
 * - `code ∈ {0, 200}` 视为成功，返回 `data`
 * - 其他抛 `Error(msg)`；此处不再自定义错误类型，调用方用原生 Error 处理即可
 */
const unwrapEnvelope = <T>(envelope: ApiEnvelope<T> | undefined | null): T => {
  if (!envelope) {
    throw new Error("请求无响应数据");
  }
  if (envelope.code !== 0 && envelope.code !== 200) {
    throw new Error(envelope.msg || envelope.message || "请求失败");
  }
  return envelope.data;
};

// ===================== 文件大小限制（与后端一致） =====================

const MAX_SIZE_BY_MEDIA: Record<MediaType, number> = {
  image: 50 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
};

const NAME_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 1024;
const TAG_MAX_LENGTH = 64;
const TAG_MAX_COUNT = 20;

// ===================== Hash =====================

/**
 * 使用 Web Crypto SHA-256 计算文件哈希（hex）。
 * 后端 `fileHash` 支持 MD5 / SHA-256，浏览器原生 crypto 没有 MD5，因此采用 SHA-256。
 */
export const computeFileHashSha256 = async (file: Blob): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
};

// ===================== Blob 获取与元数据 =====================

export interface BlobMetadata {
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
}

const inferMimeType = (file: Blob | File, fallback: string): string => {
  if ((file as File).type) return (file as File).type;
  return fallback;
};

const getImageDimensions = (blob: Blob) =>
  new Promise<{ width: number; height: number } | null>((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const result = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });

const getVideoMetadata = (blob: Blob) =>
  new Promise<{ width: number; height: number; duration: number } | null>(
    (resolve) => {
      const url = URL.createObjectURL(blob);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      const finish = (
        result: { width: number; height: number; duration: number } | null,
      ) => {
        URL.revokeObjectURL(url);
        resolve(result);
      };
      video.onloadedmetadata = () => {
        finish({
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
      };
      video.onerror = () => finish(null);
      video.src = url;
    },
  );

const getAudioDuration = (blob: Blob) =>
  new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });

/** 提取 Blob 的媒体元数据。失败时返回 null 字段，不抛错。 */
export const extractBlobMetadata = async (
  blob: Blob,
  mediaType: MediaType,
  fileName: string,
  mimeFallback = "application/octet-stream",
): Promise<BlobMetadata> => {
  const metadata: BlobMetadata = {
    blob,
    fileName,
    mimeType: inferMimeType(blob, mimeFallback),
    size: blob.size,
    width: null,
    height: null,
    duration: null,
  };

  try {
    if (mediaType === "image") {
      const dims = await getImageDimensions(blob);
      if (dims) {
        metadata.width = dims.width;
        metadata.height = dims.height;
      }
    } else if (mediaType === "video") {
      const meta = await getVideoMetadata(blob);
      if (meta) {
        metadata.width = meta.width;
        metadata.height = meta.height;
        metadata.duration = meta.duration;
      }
    } else if (mediaType === "audio") {
      metadata.duration = await getAudioDuration(blob);
    }
  } catch (error) {
    console.warn("[remoteAssetUpload] extract metadata failed", error);
  }

  return metadata;
};

/**
 * 从远程 URL 拉取 Blob（用于把节点已生成的媒体保存为远程资产）。
 * 注意：跨域可能导致失败，调用方需要捕获。
 */
export const fetchBlobFromUrl = async (
  url: string,
  defaultName: string,
): Promise<{ blob: Blob; fileName: string }> => {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error(`下载媒体失败：${response.status}`);
  }
  const blob = await response.blob();
  const lastSegment = url.split("?")[0].split("#")[0].split("/").pop() || "";
  const fileName = lastSegment || defaultName;
  return { blob, fileName };
};

// ===================== 校验 =====================

export const validateAssetName = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return "请输入资产名称";
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `资产名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
  }
  return null;
};

export const validateDescription = (description: string): string | null => {
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return `描述不能超过 ${DESCRIPTION_MAX_LENGTH} 个字符`;
  }
  return null;
};

export const validateTags = (tags: string[]): string | null => {
  if (tags.length > TAG_MAX_COUNT) return `标签数量不能超过 ${TAG_MAX_COUNT} 个`;
  for (const tag of tags) {
    if (tag.length > TAG_MAX_LENGTH) {
      return `单个标签长度不能超过 ${TAG_MAX_LENGTH} 个字符`;
    }
  }
  return null;
};

export const validateFileSize = (
  size: number,
  mediaType: MediaType,
): string | null => {
  const max = MAX_SIZE_BY_MEDIA[mediaType];
  if (size > max) {
    const mb = (max / 1024 / 1024).toFixed(0);
    return `文件超过 ${mb}MB 限制`;
  }
  return null;
};

// ===================== 上传 =====================

interface UploadOptions {
  blob: Blob;
  fileName: string;
  mimeType: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

interface UploadResult {
  fileKey: string;
  url: string;
}

/**
 * 直接调用后端 `POST /v1/oss/upload`（multipart/form-data）。
 * 浏览器 axios 不支持上传进度，因此走 XHR + FormData 单独实现，便于：
 * - 携带文件
 * - 携带鉴权 token（与 jikeingService 行为一致）
 * - 透传进度回调与取消信号
 *
 * 后端响应 envelope：`{ code, msg, data: UploadOssFileResult, timestamp }`。
 */
const uploadViaOssEndpoint = (
  blob: Blob,
  fileName: string,
  mimeType: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<UploadOssFileResult> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${JIKE_GO_BASE_URL}/v1/oss/upload`, true);

    const token = getJikeingToken();
    if (token) {
      // 与 jikeGo.uploadOssFile 保持一致：使用 Authorization Bearer
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`上传失败：${xhr.status}`));
        return;
      }
      let parsed: any = null;
      try {
        parsed = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("上传失败：响应格式错误"));
        return;
      }
      if (
        !parsed ||
        typeof parsed.code !== "number" ||
        (parsed.code !== 0 && parsed.code !== 200)
      ) {
        reject(new Error(parsed?.msg || parsed?.message || "上传失败"));
        return;
      }
      const data = parsed.data || {};
      if (!data.key) {
        reject(new Error("上传失败：缺少 fileKey"));
        return;
      }
      resolve({
        url: data.url || "",
        key: String(data.key),
        filename: data.filename || fileName,
        size: typeof data.size === "number" ? data.size : blob.size,
        content_type: data.content_type || mimeType,
      });
    };

    xhr.onerror = () => reject(new Error("上传失败：网络异常"));
    xhr.onabort = () => reject(new Error("上传已取消"));

    if (signal) {
      const handleAbort = () => xhr.abort();
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([blob], { type: mimeType || blob.type || "application/octet-stream" }),
      fileName,
    );
    xhr.send(formData);
  });

/**
 * 上传资产二进制（服务端直传 OSS），返回 fileKey 与 access URL。
 *
 * 与旧的预签名 PUT 链路相比：上传不再走客户端预签名 URL，
 * 全部通过 jike-go 的 `POST /v1/oss/upload` 处理，简化前端实现并降低暴露面。
 */
export const uploadAssetBinary = async (
  options: UploadOptions,
): Promise<UploadResult> => {
  const { blob, fileName, mimeType, onProgress, signal } = options;
  const result = await uploadViaOssEndpoint(
    blob,
    fileName,
    mimeType || blob.type || "application/octet-stream",
    onProgress,
    signal,
  );
  return { fileKey: result.key, url: result.url };
};

// ===================== 全流程：上传并创建资产 =====================

export interface UploadAndCreateInput {
  blob: Blob;
  fileName: string;
  mediaType: MediaType;
  primaryCategory: PrimaryCategory;
  scope: AssetScope;
  projectId?: string | null;
  name: string;
  description?: string;
  tags?: string[];
  conditions?: AssetConditions | null;
  sourceProjectId?: string | null;
  sourceCanvasId?: string | null;
  sourceNodeId?: string | null;
  sourceTaskId?: string | null;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface UploadAndCreateResult {
  asset: AssetDetail;
  /** 是否复用已有资产（重复检测命中） */
  reused: boolean;
}

export const uploadAndCreateAsset = async (
  input: UploadAndCreateInput,
): Promise<UploadAndCreateResult> => {
  const {
    blob,
    fileName,
    mediaType,
    primaryCategory,
    scope,
    projectId,
    name,
    description,
    tags,
    conditions,
    sourceProjectId,
    sourceCanvasId,
    sourceNodeId,
    sourceTaskId,
    onProgress,
    signal,
  } = input;

  // 1. 字段校验
  const nameError = validateAssetName(name);
  if (nameError) throw new Error(nameError);
  const descError = validateDescription(description || "");
  if (descError) throw new Error(descError);
  const tagError = validateTags(tags || []);
  if (tagError) throw new Error(tagError);
  const sizeError = validateFileSize(blob.size, mediaType);
  if (sizeError) throw new Error(sizeError);
  if (scope === "project" && !projectId) {
    throw new Error("项目资产必须指定项目");
  }

  // 2. 元数据 + 哈希
  const metadata = await extractBlobMetadata(blob, mediaType, fileName);

  let fileHash = "";
  try {
    fileHash = await computeFileHashSha256(blob);
  } catch (error) {
    console.warn("[remoteAssetUpload] hash failed", error);
  }

  // 3. 重复检测：命中且对当前用户可见 → 直接复用，不再上传
  if (fileHash) {
    try {
      const dup: CheckDuplicateResponse = unwrapEnvelope(
        await checkAssetDuplicate({ fileHash }),
      );
      if (dup.isDuplicate && dup.existingAsset) {
        toast.info("已存在相同资产，已自动复用");
        // 复用：使用现有资产的最小展示信息构造 AssetDetail-like 结构
        return {
          asset: {
            id: dup.existingAsset.id,
            userId: "",
            scope: dup.existingAsset.scope,
            projectId: null,
            name: dup.existingAsset.name,
            mediaType: dup.existingAsset.mediaType,
            primaryCategory: dup.existingAsset.primaryCategory,
            conditions: null,
            description: null,
            fileKey: "",
            fileUrl: dup.existingAsset.fileUrl,
            fileHash,
            fileSize: metadata.size,
            fileName: metadata.fileName,
            mimeType: metadata.mimeType,
            width: metadata.width,
            height: metadata.height,
            duration: metadata.duration,
            thumbnailKey: "",
            thumbnailUrl: dup.existingAsset.thumbnailUrl,
            sourceProjectId: null,
            sourceCanvasId: null,
            sourceNodeId: null,
            sourceTaskId: null,
            status: 1,
            createTime: Date.now(),
            updateTime: Date.now(),
            tags: [],
            refCount: 0,
          },
          reused: true,
        };
      }
    } catch (error) {
      // 重复检测失败不阻断主流程
      console.warn("[remoteAssetUpload] duplicate check failed", error);
    }
  }

  // 4. 上传
  const { fileKey } = await uploadAssetBinary({
    blob,
    fileName: metadata.fileName,
    mimeType: metadata.mimeType,
    onProgress,
    signal,
  });

  // 5. 创建
  const asset: AssetDetail = unwrapEnvelope(
    await createAsset({
      name: name.trim(),
      mediaType,
      primaryCategory,
      scope,
      projectId: scope === "project" ? projectId || undefined : undefined,
      conditions: conditions || undefined,
      description: description?.trim() || undefined,
      fileKey,
      fileHash: fileHash || undefined,
      fileSize: metadata.size,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      width: metadata.width || undefined,
      height: metadata.height || undefined,
      duration: metadata.duration || undefined,
      sourceProjectId: sourceProjectId || undefined,
      sourceCanvasId: sourceCanvasId || undefined,
      sourceNodeId: sourceNodeId || undefined,
      sourceTaskId: sourceTaskId || undefined,
      tags: tags && tags.length > 0 ? tags : undefined,
    }),
  );

  return { asset, reused: false };
};
