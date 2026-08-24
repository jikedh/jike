// 视频裁剪领域服务
// 原 ipc/video-processing/service.ts 用阿里云 ICE + ffmpeg + 后端上传
// Rust 端等价实现：调用阿里云 ICE REST API 提交裁剪作业，等待完成，下载到本地，
// 通过后端 /v1/oss/upload 上传。ffmpeg 方案降级为调用本地 ffmpeg 二进制。

use crate::models::{
    SplitMp4Request, SplitMp4Result, VideoFrameCaptureRequest, VideoFrameCaptureResult,
    VideoTrimRequest, VideoTrimResult,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    process::Command,
};
use tokio::io::AsyncWriteExt;

const FFMPEG_PATH_ENV: &str = "JIKE_FFMPEG_PATH";
const MAX_FRAME_SOURCE_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const END_FRAME_PADDING_SECONDS: f64 = 0.2;

#[derive(Debug, thiserror::Error)]
pub enum VideoError {
    #[error("http error: {0}")]
    Http(String),
    #[error("config missing: {0}")]
    Config(String),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("job failed: {0}")]
    JobFailed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AliyunRuntimeConfig {
    access_key_id: String,
    access_key_secret: String,
    oss_region: String,
    oss_bucket: String,
    ims_region_id: Option<String>,
    ims_endpoint: Option<String>,
}

fn env_or(k: &str) -> Option<String> {
    std::env::var(k).ok().filter(|v| !v.is_empty())
}

fn get_aliyun_config() -> Option<AliyunRuntimeConfig> {
    let id = env_or("VITE_OSS_ACCESS_KEY_ID")?;
    let secret = env_or("VITE_OSS_ACCESS_KEY_SECRET")?;
    let region = env_or("VITE_OSS_REGION")?;
    let bucket = env_or("VITE_OSS_BUCKET")?;
    Some(AliyunRuntimeConfig {
        access_key_id: id,
        access_key_secret: secret,
        oss_region: region,
        oss_bucket: bucket,
        ims_region_id: env_or("VITE_IMS_REGION_ID"),
        ims_endpoint: env_or("VITE_IMS_ENDPOINT"),
    })
}

fn resolve_backend(override_base: Option<&str>) -> String {
    let v = override_base
        .map(String::from)
        .or_else(|| env_or("VITE_JIKE_GO_BASE_URL"))
        .unwrap_or_else(|| "http://localhost:9181".to_string());
    v.trim_end_matches('/').to_string()
}

pub async fn trim_video(req: VideoTrimRequest) -> Result<VideoTrimResult, VideoError> {
    if req.video_url.is_empty() {
        return Err(VideoError::Config("videoUrl is empty".into()));
    }
    if (req.end - req.start) < 0.5 {
        return Err(VideoError::Config("裁剪时长不能小于 0.5 秒".into()));
    }

    // 尝试云端 ICE 方案
    if let Some(cfg) = get_aliyun_config() {
        if let Ok(r) = trim_via_ice(&cfg, &req).await {
            return Ok(r);
        }
    }

    // 降级到 ffmpeg sidecar
    trim_via_ffmpeg(&req).await
}

pub async fn capture_video_frame(
    req: VideoFrameCaptureRequest,
) -> Result<VideoFrameCaptureResult, VideoError> {
    if !req.time.is_finite() || req.time < 0.0 {
        return Err(VideoError::Config("截帧时间无效".into()));
    }

    let source_url = crate::domain::oss_service::validate_remote_media_url(&req.video_url)
        .map_err(|error| VideoError::Config(error.to_string()))?;
    let temp_dir = std::env::temp_dir().join(format!("jike-frame-{}", uuid::Uuid::new_v4()));
    let result = async {
        tokio::fs::create_dir_all(&temp_dir).await?;
        let input_path = temp_dir.join("source.mp4");
        let output_path = temp_dir.join("frame.png");
        download_frame_source(&source_url, &input_path).await?;
        let ffmpeg = resolve_ffmpeg_path(None)?;
        let capture_time = match req.mode.as_str() {
            "start" => 0.0,
            "end" => {
                let duration = probe_media_duration(&ffmpeg, &input_path).await?;
                (duration - END_FRAME_PADDING_SECONDS).max(0.0)
            }
            "current" => req.time,
            _ => return Err(VideoError::Config("不支持的截帧模式".into())),
        };
        extract_frame_with_ffmpeg(&ffmpeg, &input_path, &output_path, capture_time).await?;
        let frame = tokio::fs::read(&output_path).await?;
        let url = upload_frame_to_backend(
            frame,
            req.auth_token.as_deref(),
            req.backend_base_url.as_deref(),
        )
        .await?;

        Ok(VideoFrameCaptureResult {
            url,
            format: "png".to_string(),
            method: "ffmpeg".to_string(),
        })
    }
    .await;

    let _ = tokio::fs::remove_dir_all(&temp_dir).await;
    result
}

async fn download_frame_source(source_url: &reqwest::Url, target: &Path) -> Result<(), VideoError> {
    let client = Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(600))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| VideoError::Http(error.to_string()))?;
    let mut response = client
        .get(source_url.clone())
        .send()
        .await
        .map_err(|error| VideoError::Http(error.to_string()))?;

    if !response.status().is_success() {
        return Err(VideoError::Http(format!("视频下载失败：HTTP {}", response.status())));
    }
    if response.content_length().is_some_and(|size| size > MAX_FRAME_SOURCE_BYTES) {
        return Err(VideoError::Config("视频文件超过截帧大小限制".into()));
    }

    let mut file = tokio::fs::File::create(target).await?;
    let mut downloaded = 0u64;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| VideoError::Http(error.to_string()))?
    {
        downloaded += chunk.len() as u64;
        if downloaded > MAX_FRAME_SOURCE_BYTES {
            return Err(VideoError::Config("视频文件超过截帧大小限制".into()));
        }
        file.write_all(&chunk).await?;
    }

    file.flush().await?;
    Ok(())
}

async fn extract_frame_with_ffmpeg(
    ffmpeg: &Path,
    input_path: &Path,
    output_path: &Path,
    time: f64,
) -> Result<(), VideoError> {
    let ffmpeg = ffmpeg.to_path_buf();
    let input_path = input_path.to_path_buf();
    let output_path = output_path.to_path_buf();
    let output_path_for_command = output_path.clone();
    let time = format!("{time:.3}");
    let output = tokio::task::spawn_blocking(move || {
        Command::new(ffmpeg)
            .args([
                "-y",
                "-hide_banner",
                "-ss",
                &time,
                "-i",
                input_path.to_string_lossy().as_ref(),
                "-frames:v",
                "1",
                output_path_for_command.to_string_lossy().as_ref(),
            ])
            .output()
    })
    .await
    .map_err(|error| VideoError::JobFailed(error.to_string()))?
    .map_err(|error| VideoError::JobFailed(error.to_string()))?;

    if output.status.success() && output_path.is_file() {
        Ok(())
    } else {
        Err(VideoError::JobFailed(ffmpeg_stderr_message(&output.stderr)))
    }
}

async fn upload_frame_to_backend(
    frame: Vec<u8>,
    auth_token: Option<&str>,
    backend_base_url: Option<&str>,
) -> Result<String, VideoError> {
    let backend = resolve_backend(backend_base_url);
    let upload_url = format!("{backend}/v1/oss/upload");
    let part = reqwest::multipart::Part::bytes(frame)
        .file_name("video-frame.png")
        .mime_str("image/png")
        .map_err(|error| VideoError::Http(error.to_string()))?;
    let form = reqwest::multipart::Form::new().part("file", part);
    let mut request = Client::new().post(upload_url).multipart(form);
    if let Some(token) = auth_token.filter(|token| !token.trim().is_empty()) {
        let authorization = if token.starts_with("Bearer ") {
            token.to_string()
        } else {
            format!("Bearer {token}")
        };
        request = request.header("Authorization", authorization);
    }

    let response = request
        .send()
        .await
        .map_err(|error| VideoError::Http(error.to_string()))?;
    if !response.status().is_success() {
        return Err(VideoError::Http(format!("截帧图片上传失败：HTTP {}", response.status())));
    }

    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| VideoError::Http(error.to_string()))?;
    payload
        .get("data")
        .and_then(|data| data.get("url"))
        .and_then(|url| url.as_str())
        .or_else(|| payload.get("url").and_then(|url| url.as_str()))
        .filter(|url| !url.is_empty())
        .map(str::to_string)
        .ok_or_else(|| VideoError::Http("截帧图片上传未返回地址".into()))
}

pub async fn split_mp4_by_seconds(req: SplitMp4Request) -> Result<SplitMp4Result, VideoError> {
    let input_path = normalize_existing_file_path(&req.input_path, "inputPath")?;
    let segment_seconds = req.segment_seconds.unwrap_or(15.0);
    if segment_seconds < 1.0 {
        return Err(VideoError::Config("切片时长不能小于 1 秒".into()));
    }

    let output_dir = resolve_split_output_dir(&input_path, req.output_dir.as_deref())?;
    std::fs::create_dir_all(&output_dir)?;
    clear_existing_clip_outputs(&output_dir)?;

    let ffmpeg = resolve_ffmpeg_path(req.ffmpeg_path.as_deref())?;
    let duration = probe_media_duration(&ffmpeg, &input_path).await?;
    split_mp4_fixed_windows(&ffmpeg, &input_path, &output_dir, segment_seconds, duration).await?;

    let clips = list_clip_outputs(&output_dir)?;
    if clips.is_empty() {
        return Err(VideoError::JobFailed("ffmpeg 未生成任何切片文件".into()));
    }

    Ok(SplitMp4Result {
        output_dir: output_dir.to_string_lossy().to_string(),
        clip_count: clips.len(),
        clips,
        segment_seconds,
        method: "ffmpeg-fixed-window-reencode".to_string(),
    })
}

fn normalize_existing_file_path(value: &str, field_name: &str) -> Result<PathBuf, VideoError> {
    let trimmed = value.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err(VideoError::Config(format!("{field_name} is empty")));
    }

    let path = PathBuf::from(trimmed);
    if !path.is_file() {
        return Err(VideoError::Config(format!(
            "本地 MP4 不存在或不是文件：{}",
            path.display()
        )));
    }
    Ok(path)
}

fn resolve_split_output_dir(
    input_path: &Path,
    output_dir: Option<&str>,
) -> Result<PathBuf, VideoError> {
    if let Some(output_dir) = output_dir.filter(|value| !value.trim().is_empty()) {
        return Ok(PathBuf::from(output_dir.trim().trim_matches('"')));
    }

    let parent = input_path.parent().ok_or_else(|| {
        VideoError::Config("无法解析 MP4 所在文件夹，请手动选择有效文件路径".into())
    })?;
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("video");
    Ok(parent.join(format!("{stem}_clips")))
}

fn clear_existing_clip_outputs(output_dir: &Path) -> Result<(), VideoError> {
    if !output_dir.exists() {
        return Ok(());
    }

    for entry in std::fs::read_dir(output_dir)? {
        let entry = entry?;
        let path = entry.path();
        let is_clip = path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|name| name.starts_with("clip_") && name.ends_with(".mp4"))
            .unwrap_or(false);
        if path.is_file() && is_clip {
            std::fs::remove_file(path)?;
        }
    }
    Ok(())
}

async fn split_mp4_fixed_windows(
    ffmpeg: &Path,
    input_path: &Path,
    output_dir: &Path,
    segment_seconds: f64,
    duration: f64,
) -> Result<(), VideoError> {
    if duration <= 0.0 {
        return Err(VideoError::JobFailed("无法读取 MP4 时长".into()));
    }

    let mut start = 0.0;
    let mut clip_index = 1usize;
    while start < duration {
        let clip_duration = (duration - start).min(segment_seconds);
        if clip_duration <= 0.05 {
            break;
        }
        let output_path = output_dir.join(format!("clip_{clip_index:04}.mp4"));
        cut_mp4_window(ffmpeg, input_path, &output_path, start, clip_duration).await?;

        start += segment_seconds;
        clip_index += 1;
    }

    Ok(())
}

async fn cut_mp4_window(
    ffmpeg: &Path,
    input_path: &Path,
    output_path: &Path,
    start: f64,
    duration: f64,
) -> Result<(), VideoError> {
    let ffmpeg = ffmpeg.to_path_buf();
    let input_path = input_path.to_path_buf();
    let output_path = output_path.to_path_buf();
    let start_value = format!("{start:.3}");
    let duration_value = format!("{duration:.3}");

    let ffmpeg_output = tokio::task::spawn_blocking(move || {
        Command::new(&ffmpeg)
            .args([
                "-y",
                "-hide_banner",
                "-ss",
                &start_value,
                "-i",
                input_path.to_string_lossy().as_ref(),
                "-t",
                &duration_value,
                "-map",
                "0",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                "-avoid_negative_ts",
                "make_zero",
                output_path.to_string_lossy().as_ref(),
            ])
            .output()
    })
    .await
    .map_err(|e| VideoError::JobFailed(e.to_string()))?
    .map_err(|e| VideoError::JobFailed(e.to_string()))?;

    if ffmpeg_output.status.success() {
        Ok(())
    } else {
        Err(VideoError::JobFailed(ffmpeg_stderr_message(
            &ffmpeg_output.stderr,
        )))
    }
}

async fn probe_media_duration(ffmpeg: &Path, input_path: &Path) -> Result<f64, VideoError> {
    if let Some(ffprobe) = ffprobe_path_for_ffmpeg(ffmpeg) {
        if let Ok(duration) = probe_duration_with_ffprobe(&ffprobe, input_path).await {
            return Ok(duration);
        }
    }
    probe_duration_with_ffmpeg(ffmpeg, input_path).await
}

fn ffprobe_path_for_ffmpeg(ffmpeg: &Path) -> Option<PathBuf> {
    let ffprobe = ffmpeg.with_file_name(ffprobe_executable_name());
    ffprobe.is_file().then_some(ffprobe)
}

async fn probe_duration_with_ffprobe(ffprobe: &Path, input_path: &Path) -> Result<f64, VideoError> {
    let ffprobe = ffprobe.to_path_buf();
    let input_path = input_path.to_path_buf();

    let output = tokio::task::spawn_blocking(move || {
        Command::new(&ffprobe)
            .args([
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                input_path.to_string_lossy().as_ref(),
            ])
            .output()
    })
    .await
    .map_err(|e| VideoError::JobFailed(e.to_string()))?
    .map_err(|e| VideoError::JobFailed(e.to_string()))?;

    if !output.status.success() {
        return Err(VideoError::JobFailed(ffmpeg_stderr_message(&output.stderr)));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_duration_seconds(stdout.trim())
}

async fn probe_duration_with_ffmpeg(ffmpeg: &Path, input_path: &Path) -> Result<f64, VideoError> {
    let ffmpeg = ffmpeg.to_path_buf();
    let input_path = input_path.to_path_buf();

    let output = tokio::task::spawn_blocking(move || {
        Command::new(&ffmpeg)
            .args(["-hide_banner", "-i", input_path.to_string_lossy().as_ref()])
            .output()
    })
    .await
    .map_err(|e| VideoError::JobFailed(e.to_string()))?
    .map_err(|e| VideoError::JobFailed(e.to_string()))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_ffmpeg_duration(&stderr)
}

fn parse_duration_seconds(value: &str) -> Result<f64, VideoError> {
    value
        .trim()
        .parse::<f64>()
        .ok()
        .filter(|duration| duration.is_finite() && *duration > 0.0)
        .ok_or_else(|| VideoError::JobFailed("无法解析 MP4 时长".into()))
}

fn parse_ffmpeg_duration(stderr: &str) -> Result<f64, VideoError> {
    let marker = "Duration:";
    let start = stderr
        .find(marker)
        .ok_or_else(|| VideoError::JobFailed("无法读取 MP4 时长".into()))?
        + marker.len();
    let value = stderr[start..].split(',').next().unwrap_or("").trim();
    parse_hhmmss_duration(value)
}

fn parse_hhmmss_duration(value: &str) -> Result<f64, VideoError> {
    let parts = value.split(':').collect::<Vec<_>>();
    if parts.len() != 3 {
        return Err(VideoError::JobFailed("无法解析 MP4 时长".into()));
    }

    let hours = parts[0].parse::<f64>().unwrap_or(-1.0);
    let minutes = parts[1].parse::<f64>().unwrap_or(-1.0);
    let seconds = parts[2].parse::<f64>().unwrap_or(-1.0);
    let duration = hours * 3600.0 + minutes * 60.0 + seconds;
    if duration.is_finite() && duration > 0.0 {
        Ok(duration)
    } else {
        Err(VideoError::JobFailed("无法解析 MP4 时长".into()))
    }
}

fn list_clip_outputs(output_dir: &Path) -> Result<Vec<String>, VideoError> {
    let mut clips = Vec::new();
    for entry in std::fs::read_dir(output_dir)? {
        let entry = entry?;
        let path = entry.path();
        let is_clip = path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|name| name.starts_with("clip_") && name.ends_with(".mp4"))
            .unwrap_or(false);
        if path.is_file() && is_clip {
            clips.push(path.to_string_lossy().to_string());
        }
    }
    clips.sort();
    Ok(clips)
}

fn ffmpeg_stderr_message(stderr: &[u8]) -> String {
    let stderr = String::from_utf8_lossy(stderr);
    let lines = stderr
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();

    lines
        .iter()
        .rev()
        .find(|line| {
            let normalized = line.to_ascii_lowercase();
            ["error", "invalid", "failed", "unable", "could not", "conversion failed"]
                .iter()
                .any(|keyword| normalized.contains(keyword))
        })
        .copied()
        .or_else(|| lines.iter().rev().find(|line| !line.starts_with("frame=")) .copied())
        .unwrap_or("ffmpeg exit non-zero")
        .to_string()
}

async fn trim_via_ice(
    cfg: &AliyunRuntimeConfig,
    _req: &VideoTrimRequest,
) -> Result<VideoTrimResult, VideoError> {
    let _ = (cfg.access_key_id.as_str(), cfg.ims_region_id.as_ref());
    // 真实接入阿里云 ICE 需要 aliyun-openapi-core SDK；
    // 此处作为可运行骨架的占位（提交-轮询-下载链路在 .cargo 锁文件中已含 reqwest + serde）。
    // 后续可在 domain/video_service.rs 内补全 SubmitMediaProducingJob / GetMediaProducingJob 调用。
    Err(VideoError::Config(
        "ICE SDK not yet wired in Rust skeleton".into(),
    ))
}

async fn trim_via_ffmpeg(req: &VideoTrimRequest) -> Result<VideoTrimResult, VideoError> {
    // 简化：调用系统 ffmpeg（如已安装）裁剪为 mp4
    let tmp_dir = std::env::temp_dir().join(format!("jike-trim-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&tmp_dir)?;
    let src = tmp_dir.join("src.mp4");
    let dst = tmp_dir.join("out.mp4");

    let bytes = reqwest::get(&req.video_url)
        .await
        .map_err(|e| VideoError::Http(e.to_string()))?
        .bytes()
        .await
        .map_err(|e| VideoError::Http(e.to_string()))?;
    std::fs::write(&src, &bytes)?;

    let duration = req.end - req.start;
    let ffmpeg = resolve_ffmpeg_path(None)?;
    let status = Command::new(&ffmpeg)
        .args([
            "-y",
            "-ss",
            &format!("{}", req.start),
            "-i",
            src.to_string_lossy().as_ref(),
            "-t",
            &format!("{}", duration),
            "-c",
            "copy",
            dst.to_string_lossy().as_ref(),
        ])
        .status()
        .map_err(|e| VideoError::JobFailed(e.to_string()))?;
    if !status.success() {
        return Err(VideoError::JobFailed("ffmpeg exit non-zero".into()));
    }

    let local = std::fs::read(&dst)?;

    // 尝试通过后端上传
    if let Some(token) = req.auth_token.as_ref() {
        let backend = resolve_backend(req.backend_base_url.as_deref());
        let url = format!("{}/v1/oss/upload", backend);
        let form = reqwest::multipart::Part::bytes(local.clone())
            .file_name("trim.mp4")
            .mime_str("video/mp4")
            .map_err(|e| VideoError::Http(e.to_string()))?;
        let mp = reqwest::multipart::Form::new().part("file", form);
        let auth = if token.starts_with("Bearer ") {
            token.clone()
        } else {
            format!("Bearer {}", token)
        };
        let resp = Client::new()
            .post(&url)
            .header("Authorization", auth)
            .multipart(mp)
            .send()
            .await
            .map_err(|e| VideoError::Http(e.to_string()))?;
        if resp.status().is_success() {
            if let Ok(j) = resp.json::<serde_json::Value>().await {
                if let Some(u) = j
                    .get("data")
                    .and_then(|d| d.get("url"))
                    .and_then(|u| u.as_str())
                {
                    return Ok(VideoTrimResult {
                        url: u.to_string(),
                        format: "mp4".to_string(),
                        duration,
                        method: "ffmpeg".to_string(),
                        job_id: None,
                    });
                }
                if let Some(u) = j.get("url").and_then(|u| u.as_str()) {
                    return Ok(VideoTrimResult {
                        url: u.to_string(),
                        format: "mp4".to_string(),
                        duration,
                        method: "ffmpeg".to_string(),
                        job_id: None,
                    });
                }
            }
        }
    }

    // 兜底：返回本地文件（前端可继续处理）
    Ok(VideoTrimResult {
        url: dst.to_string_lossy().to_string(),
        format: "mp4".to_string(),
        duration,
        method: "ffmpeg".to_string(),
        job_id: None,
    })
}

fn resolve_ffmpeg_path(request_path: Option<&str>) -> Result<PathBuf, VideoError> {
    if let Some(configured) = request_path.filter(|value| !value.trim().is_empty()) {
        return normalize_and_validate_configured_ffmpeg_path("请求参数 ffmpegPath", configured);
    }

    if let Some(configured) = env_or(FFMPEG_PATH_ENV) {
        return normalize_and_validate_configured_ffmpeg_path(
            "环境变量 JIKE_FFMPEG_PATH",
            &configured,
        );
    }

    Ok(PathBuf::from(ffmpeg_executable_name()))
}

fn normalize_and_validate_configured_ffmpeg_path(
    source: &str,
    configured: &str,
) -> Result<PathBuf, VideoError> {
    let configured_path = normalize_configured_ffmpeg_path(configured);
    if is_usable_ffmpeg_path(&configured_path) {
        return Ok(configured_path);
    }

    Err(VideoError::JobFailed(format!(
        "未找到 ffmpeg：{} 指向的路径不存在或不是文件：{}",
        source,
        configured_path.display()
    )))
}

fn normalize_configured_ffmpeg_path(value: &str) -> PathBuf {
    let trimmed = value.trim().trim_matches('"');
    let path = PathBuf::from(trimmed);
    if path.is_dir() {
        path.join(ffmpeg_executable_name())
    } else {
        path
    }
}

fn is_usable_ffmpeg_path(path: &Path) -> bool {
    path.is_file()
}

fn ffmpeg_executable_name() -> &'static str {
    if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

fn ffprobe_executable_name() -> &'static str {
    if cfg!(windows) {
        "ffprobe.exe"
    } else {
        "ffprobe"
    }
}
