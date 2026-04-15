import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { ipcMain } from "electron";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { tmpdir } from "os";
import { extname, join } from "path";
import { fileURLToPath } from "url";

type ExtractVideoFrameRequest = {
  videoUrl: string;
  timeMs?: number;
  mode?: "time" | "last";
  format?: "png" | "jpg";
};

type ProbeVideoMetadata = {
  width?: number;
  height?: number;
  duration?: number;
  avgFrameRate?: number;
};

const TEMP_DIR_NAME = "jike-video-frame";
const DEFAULT_FRAME_RATE = 25;
const LAST_FRAME_FALLBACK_OFFSETS_MS = [0, 40, 80, 160, 320, 640, 1280];

export function registerMediaHandlers(): void {
  ipcMain.handle(
    "media:extractVideoFrame",
    async (_, payload: ExtractVideoFrameRequest) => {
      try {
        const result = await extractVideoFrame(payload);
        return {
          success: true,
          data: {
            bytes: new Uint8Array(result.buffer),
            mimeType: result.mimeType,
            width: result.width,
            height: result.height,
            duration: result.duration,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error?.message || "提取视频帧失败",
        };
      }
    },
  );
}

async function extractVideoFrame({
  videoUrl,
  timeMs = 0,
  mode = "time",
  format = "png",
}: ExtractVideoFrameRequest) {
  if (!videoUrl) {
    throw new Error("视频地址不能为空");
  }

  if (!ffmpegPath) {
    throw new Error("ffmpeg 不可用");
  }

  const workDir = join(tmpdir(), TEMP_DIR_NAME, randomUUID());
  await mkdir(workDir, { recursive: true });

  let inputPath: string | null = null;
  let outputPath: string | null = null;
  let shouldCleanupInput = false;

  try {
    inputPath = await ensureLocalVideoFile(videoUrl, workDir);
    shouldCleanupInput = !isLocalFileReference(videoUrl);
    const metadata = await probeVideoMetadata(inputPath);

    outputPath = join(workDir, `frame.${format}`);
    const commandCandidates =
      mode === "last"
        ? buildLastFrameCommandCandidates(inputPath, outputPath, metadata)
        : buildTimeFrameCommandCandidates(inputPath, outputPath, timeMs);

    await extractFrameWithFallbacks(ffmpegPath, commandCandidates, outputPath);

    const buffer = await readFile(outputPath);
    return {
      buffer,
      mimeType: format === "png" ? "image/png" : "image/jpeg",
      ...metadata,
    };
  } finally {
    if (outputPath && existsSync(outputPath)) {
      await rm(outputPath, { force: true });
    }
    if (inputPath && shouldCleanupInput && existsSync(inputPath)) {
      await rm(inputPath, { force: true });
    }
    if (existsSync(workDir)) {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

async function ensureLocalVideoFile(videoUrl: string, workDir: string) {
  if (isHttpUrl(videoUrl)) {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`下载视频失败: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const url = new URL(videoUrl);
    const ext = extname(url.pathname) || ".mp4";
    const inputPath = join(workDir, `input${ext}`);
    await writeFile(inputPath, Buffer.from(arrayBuffer));
    return inputPath;
  }

  if (videoUrl.startsWith("file://")) {
    return fileURLToPath(videoUrl);
  }

  return videoUrl;
}

function buildTimeFrameArgs(
  inputPath: string,
  outputPath: string,
  timeMs: number,
) {
  const seconds = Math.max(timeMs, 0) / 1000;
  return [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    seconds.toFixed(3),
    "-i",
    inputPath,
    "-an",
    "-frames:v",
    "1",
    "-f",
    "image2",
    outputPath,
  ];
}

function buildTimeFrameCommandCandidates(
  inputPath: string,
  outputPath: string,
  timeMs: number,
) {
  const normalizedTimeMs = Math.max(timeMs, 0);

  // 优先使用精确抽帧 (Accurate Seek: -i 放在 -ss 之前)
  // 如果失败，回退到快速关键帧抽帧 (Fast Seek: -ss 放在 -i 之前)
  return [
    buildAccurateTimeFrameArgs(inputPath, outputPath, normalizedTimeMs),
    buildTimeFrameArgs(inputPath, outputPath, normalizedTimeMs),
  ];
}

function buildAccurateTimeFrameArgs(
  inputPath: string,
  outputPath: string,
  timeMs: number,
) {
  const seconds = Math.max(timeMs, 0) / 1000;
  return [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-ss",
    seconds.toFixed(3),
    "-an",
    "-frames:v",
    "1",
    "-f",
    "image2",
    outputPath,
  ];
}

function buildLastFrameCommandCandidates(
  inputPath: string,
  outputPath: string,
  metadata: ProbeVideoMetadata,
) {
  if (metadata.duration && metadata.duration > 0) {
    const frameRate = metadata.avgFrameRate || DEFAULT_FRAME_RATE;
    const frameDuration = 1 / Math.max(frameRate, 1);
    const baseOffsetMs = Math.max(
      Math.round(frameDuration * 1000),
      1,
    );

    return LAST_FRAME_FALLBACK_OFFSETS_MS.flatMap((extraOffsetMs) => {
      const targetMs = Math.max(
        Math.round(metadata.duration * 1000) - baseOffsetMs - extraOffsetMs,
        0,
      );

      return buildTimeFrameCommandCandidates(inputPath, outputPath, targetMs);
    });
  }

  return [
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-sseof",
      "-0.2",
      "-i",
      inputPath,
      "-an",
      "-frames:v",
      "1",
      "-f",
      "image2",
      outputPath,
    ],
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-sseof",
      "-1",
      "-i",
      inputPath,
      "-an",
      "-frames:v",
      "1",
      "-f",
      "image2",
      outputPath,
    ],
  ];
}

async function extractFrameWithFallbacks(
  ffmpegExecutable: string,
  commandCandidates: string[][],
  outputPath: string,
) {
  let lastError: Error | null = null;

  for (const args of commandCandidates) {
    try {
      if (existsSync(outputPath)) {
        await rm(outputPath, { force: true });
      }

      await execFileAsync(ffmpegExecutable, args);

      if (existsSync(outputPath)) {
        return;
      }

      lastError = new Error("ffmpeg 未生成截图文件");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("ffmpeg 执行失败");
    }
  }

  throw lastError || new Error("提取视频帧失败");
}

async function probeVideoMetadata(filePath: string): Promise<ProbeVideoMetadata> {
  const ffprobePath = ffprobeStatic.path;
  if (!ffprobePath) {
    return {};
  }

  const { stdout } = await execFileAsync(ffprobePath, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,avg_frame_rate,r_frame_rate:format=duration",
    "-of",
    "json",
    filePath,
  ]);

  const parsed = JSON.parse(stdout || "{}") as {
    streams?: Array<{
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      r_frame_rate?: string;
    }>;
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];

  return {
    width: stream?.width,
    height: stream?.height,
    duration: parsed.format?.duration
      ? Number.parseFloat(parsed.format.duration)
      : undefined,
    avgFrameRate:
      parseFrameRate(stream?.avg_frame_rate) ||
      parseFrameRate(stream?.r_frame_rate),
  };
}

function execFileAsync(file: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            stderr?.trim() || stdout?.trim() || error.message || "命令执行失败",
          ),
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function isHttpUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function isLocalFileReference(url: string) {
  return url.startsWith("file://") || !isHttpUrl(url);
}

function parseFrameRate(value?: string) {
  if (!value || value === "0/0") {
    return undefined;
  }

  const [numeratorStr, denominatorStr] = value.split("/");
  const numerator = Number.parseFloat(numeratorStr || "0");
  const denominator = Number.parseFloat(denominatorStr || "1");

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return undefined;
  }

  const frameRate = numerator / denominator;
  return Number.isFinite(frameRate) && frameRate > 0 ? frameRate : undefined;
}
