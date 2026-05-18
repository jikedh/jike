import IceClient, {
  GetMediaProducingJobRequest,
  SubmitMediaProducingJobRequest,
} from "@alicloud/ice20201109";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import { app } from "electron";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export type VideoTrimRequest = {
  videoUrl: string;
  start: number;
  end: number;
  authToken?: string;
  backendBaseUrl?: string;
};

export type VideoTrimResult = {
  url: string;
  format: "mp4";
  duration: number;
  method: "cloud" | "ffmpeg";
  jobId?: string;
};

type AliyunRuntimeConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  ossRegion: string;
  ossBucket: string;
  imsRegionId?: string;
  imsEndpoint?: string;
};

const CLOUD_POLL_INTERVAL_MS = 5000;
const CLOUD_TIMEOUT_MS = 10 * 60 * 1000;
const MIN_TRIM_DURATION_SECONDS = 0.5;

const normalizeSeconds = (value: number) =>
  Math.max(0, Number.isFinite(value) ? value : 0);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getEnvValue = (key: string) => {
  const metaEnv = import.meta.env as Record<string, string | undefined>;
  return process.env[key] || metaEnv[key] || "";
};

const getAliyunConfig = (): AliyunRuntimeConfig | null => {
  const accessKeyId = getEnvValue("VITE_OSS_ACCESS_KEY_ID");
  const accessKeySecret = getEnvValue("VITE_OSS_ACCESS_KEY_SECRET");
  const ossRegion = getEnvValue("VITE_OSS_REGION");
  const ossBucket = getEnvValue("VITE_OSS_BUCKET");
  const imsRegionId =
    getEnvValue("VITE_IMS_REGION_ID") || ossRegion.replace(/^oss-/, "");
  const imsEndpoint =
    getEnvValue("VITE_IMS_ENDPOINT") || `ice.${imsRegionId}.aliyuncs.com`;

  if (!accessKeyId || !accessKeySecret || !ossRegion || !ossBucket) {
    return null;
  }

  return {
    accessKeyId,
    accessKeySecret,
    ossRegion,
    ossBucket,
    imsRegionId: imsRegionId || undefined,
    imsEndpoint: imsEndpoint || undefined,
  };
};

const createIceClient = (config: AliyunRuntimeConfig) => {
  if (!config.imsRegionId || !config.imsEndpoint) {
    throw new Error("缺少阿里云 IMS 配置，无法使用云端裁剪");
  }

  return new IceClient({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    regionId: config.imsRegionId,
    endpoint: config.imsEndpoint,
  } as any);
};

const createOutputObjectKey = () => {
  const random = Math.random().toString(36).slice(2, 8);
  return `video/video-trim-${Date.now()}-${random}.mp4`;
};

const createPublicOssUrl = (config: AliyunRuntimeConfig, objectKey: string) =>
  `https://${config.ossBucket}.${config.ossRegion}.aliyuncs.com/${objectKey}`;

const resolveBackendBaseUrl = (override?: string) => {
  const baseUrl = override || getEnvValue("VITE_JIKE_GO_BASE_URL");
  return (baseUrl || "http://localhost:9181").replace(/\/$/, "");
};

const uploadLocalVideoToBackend = async (
  buffer: Buffer,
  fileName: string,
  authToken: string,
  backendBaseUrl: string,
) => {
  const url = `${backendBaseUrl}/v1/oss/upload`;
  const formData = new FormData();
  const contentType = "video/mp4";
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: contentType });
  formData.append("file", blob, fileName);

  const token = authToken.startsWith("Bearer ")
    ? authToken
    : `Bearer ${authToken}`;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: token,
    },
  });

  if (!response.ok) {
    throw new Error(
      `后端上传失败：${response.status} ${response.statusText}`,
    );
  }

  const payload = await response.json().catch(() => null);
  const data = payload?.data ?? payload;
  const uploadedUrl = data?.url || data?.URL;
  if (!uploadedUrl) {
    throw new Error("后端未返回上传地址");
  }

  return uploadedUrl as string;
};

const uploadTrimmedVideo = async (options: {
  buffer: Buffer;
  filePath: string;
  authToken?: string;
  backendBaseUrl?: string;
}) => {
  const { buffer, filePath, authToken, backendBaseUrl } = options;

  if (!authToken) {
    throw new Error("缺少登录凭证，无法通过后端上传裁剪后的视频");
  }

  return uploadLocalVideoToBackend(
    buffer,
    basename(filePath),
    authToken,
    resolveBackendBaseUrl(backendBaseUrl),
  );
};

const assertValidRange = ({ videoUrl, start, end }: VideoTrimRequest) => {
  if (!videoUrl) {
    throw new Error("缺少视频地址");
  }

  if (end - start < MIN_TRIM_DURATION_SECONDS) {
    throw new Error("裁剪时长不能小于 0.5 秒");
  }
};

const canUseImsInput = (videoUrl: string) => {
  try {
    const url = new URL(videoUrl);
    return url.hostname.includes(".oss-") && url.hostname.includes("aliyuncs.com");
  } catch {
    return false;
  }
};

const buildTrimTimeline = (videoUrl: string, start: number, end: number) => {
  const safeStart = normalizeSeconds(start);
  const safeEnd = Math.max(safeStart + MIN_TRIM_DURATION_SECONDS, end);

  return JSON.stringify({
    VideoTracks: [
      {
        VideoTrackClips: [
          {
            MediaURL: videoUrl.split("?")[0],
            In: Number(safeStart.toFixed(3)),
            Out: Number(safeEnd.toFixed(3)),
            TimelineIn: 0,
            TimelineOut: Number((safeEnd - safeStart).toFixed(3)),
          },
        ],
      },
    ],
  });
};

const trimVideoByCloud = async (
  request: VideoTrimRequest,
  config: AliyunRuntimeConfig,
): Promise<VideoTrimResult> => {
  if (!canUseImsInput(request.videoUrl)) {
    throw new Error("IMS 云端裁剪只支持 OSS 视频地址");
  }

  const client = createIceClient(config);
  const outputKey = createOutputObjectKey();
  const outputUrl = createPublicOssUrl(config, outputKey);
  const duration = request.end - request.start;

  const submitResponse = await client.submitMediaProducingJob(
    new SubmitMediaProducingJobRequest({
      source: "OpenAPI",
      outputMediaTarget: "oss-object",
      outputMediaConfig: JSON.stringify({
        MediaURL: outputUrl,
      }),
      editingProduceConfig: JSON.stringify({
        AutoRegisterInputVodMedia: true,
      }),
      timeline: buildTrimTimeline(request.videoUrl, request.start, request.end),
    }),
  );

  const jobId = submitResponse.body?.jobId;
  if (!jobId) {
    throw new Error("阿里云 IMS 未返回裁剪任务 ID");
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < CLOUD_TIMEOUT_MS) {
    const jobResponse = await client.getMediaProducingJob(
      new GetMediaProducingJobRequest({ jobId }),
    );
    const job = jobResponse.body?.mediaProducingJob;
    const status = String(job?.status || "").toLowerCase();

    if (status === "success") {
      return {
        url: job?.mediaURL || outputUrl,
        format: "mp4",
        duration,
        method: "cloud",
        jobId,
      };
    }

    if (status === "failed") {
      throw new Error(job?.message || "阿里云 IMS 裁剪失败");
    }

    await sleep(CLOUD_POLL_INTERVAL_MS);
  }

  throw new Error("阿里云 IMS 裁剪超时");
};

const resolveFfmpegPath = () => {
  const executablePath = ffmpeg.path;
  if (app.isPackaged) {
    return executablePath.replace("app.asar", "app.asar.unpacked");
  }
  return executablePath;
};

const runFfmpeg = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(resolveFfmpegPath(), args, {
      windowsHide: true,
    });
    const stderr: Buffer[] = [];

    child.stderr.on("data", (chunk) => {
      stderr.push(Buffer.from(chunk));
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          Buffer.concat(stderr).toString("utf8").trim() ||
          `ffmpeg 退出码 ${code}`,
        ),
      );
    });
  });

const downloadToTempFile = async (url: string, filePath: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载源视频失败：${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error("下载源视频为空");
  }

  await writeFile(filePath, buffer);
};

const trimVideoByFfmpeg = async (
  request: VideoTrimRequest,
): Promise<VideoTrimResult> => {
  const tempDir = join(app.getPath("temp"), "jike-video-trim", `${Date.now()}`);
  const inputPath = join(tempDir, "source-video");
  const outputPath = join(tempDir, "trimmed.mp4");
  const duration = request.end - request.start;

  await mkdir(tempDir, { recursive: true });

  try {
    await downloadToTempFile(request.videoUrl, inputPath);

    const commonArgs = [
      "-y",
      "-ss",
      request.start.toFixed(3),
      "-i",
      inputPath,
      "-t",
      duration.toFixed(3),
      "-map",
      "0:v:0?",
      "-map",
      "0:a:0?",
      "-movflags",
      "+faststart",
      outputPath,
    ];

    try {
      await runFfmpeg([...commonArgs.slice(0, -1), "-c", "copy", outputPath]);
    } catch {
      await runFfmpeg([
        ...commonArgs.slice(0, -1),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        outputPath,
      ]);
    }

    const data = await readFile(outputPath);
    if (!data.length) {
      throw new Error("ffmpeg 裁剪结果为空");
    }

    const url = await uploadTrimmedVideo({
      buffer: data,
      filePath: outputPath,
      authToken: request.authToken,
      backendBaseUrl: request.backendBaseUrl,
    });
    return {
      url,
      format: "mp4",
      duration,
      method: "ffmpeg",
    };
  } finally {
    void rm(tempDir, { recursive: true, force: true });
  }
};

export const videoProcessingService = {
  async trimVideo(request: VideoTrimRequest): Promise<VideoTrimResult> {
    assertValidRange(request);

    const normalizedRequest = {
      ...request,
      start: normalizeSeconds(request.start),
      end: normalizeSeconds(request.end),
    };
    const config = getAliyunConfig();

    if (config?.imsRegionId && config.imsEndpoint) {
      try {
        return await trimVideoByCloud(normalizedRequest, config);
      } catch (cloudError) {
        console.warn("[video-processing] cloud trim failed, fallback to ffmpeg", {
          message:
            cloudError instanceof Error
              ? cloudError.message
              : String(cloudError),
        });
      }
    }

    return await trimVideoByFfmpeg(normalizedRequest);
  },
};
