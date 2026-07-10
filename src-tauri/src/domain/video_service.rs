// 视频裁剪领域服务
// 原 ipc/video-processing/service.ts 用阿里云 ICE + ffmpeg + 后端上传
// Rust 端等价实现：调用阿里云 ICE REST API 提交裁剪作业，等待完成，下载到本地，
// 通过后端 /v1/oss/upload 上传。ffmpeg 方案降级为调用本地 ffmpeg 二进制。

use crate::models::{
    FetchShot4uPlaylistRequest, FetchShot4uPlaylistResult, FetchVideoPageRequest,
    FetchVideoPageResult, HongguoApiRequest, HongguoDecryptRequest, M3u8ToMp4Request,
    M3u8ToMp4Result, Mp4DownloadRequest, Mp4DownloadResult, SplitMp4Request, SplitMp4Result,
    VideoTrimRequest, VideoTrimResult,
};
use reqwest::{
    header::{HeaderMap, HeaderValue, ORIGIN, REFERER, USER_AGENT},
    Client,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    process::Command,
};
use tokio::time::{sleep, Duration};
use url::Url;

#[cfg(windows)]
use winreg::{enums::*, RegKey};

const FFMPEG_PATH_ENV: &str = "JIKE_FFMPEG_PATH";
const HLS_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const HLS_REFERER: &str = "https://www.hongguostudio.com/";
const HLS_ORIGIN: &str = "https://www.hongguostudio.com";

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

pub async fn trim_video(
    req: VideoTrimRequest,
    bundled_ffmpeg_dirs: Vec<PathBuf>,
) -> Result<VideoTrimResult, VideoError> {
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
    trim_via_ffmpeg(&req, bundled_ffmpeg_dirs).await
}

pub async fn download_m3u8_to_mp4(
    req: M3u8ToMp4Request,
    bundled_ffmpeg_dirs: Vec<PathBuf>,
) -> Result<M3u8ToMp4Result, VideoError> {
    let m3u8_url = req.m3u8_url.trim().to_string();
    if m3u8_url.is_empty() {
        return Err(VideoError::Config("m3u8Url is empty".into()));
    }
    if !m3u8_url.starts_with("http://") && !m3u8_url.starts_with("https://") {
        return Err(VideoError::Config("仅支持 http/https m3u8 地址".into()));
    }
    if !m3u8_url.contains(".m3u8") {
        return Err(VideoError::Config("输入地址不是 m3u8 播放列表".into()));
    }

    let output_path = ensure_mp4_output_path(&req.output_path)?;
    let result_path = output_path.clone();
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let ffmpeg = resolve_ffmpeg_path(req.ffmpeg_path.as_deref(), bundled_ffmpeg_dirs)?;
    let skipped_urls = download_hls_segments_and_mux(
        &m3u8_url,
        &output_path,
        &ffmpeg,
        req.referer.as_deref(),
        req.origin.as_deref(),
    )
    .await?;
    let skipped_segments = skipped_urls.len();

    Ok(M3u8ToMp4Result {
        path: result_path.to_string_lossy().to_string(),
        format: "mp4".to_string(),
        method: "ffmpeg-segmented".to_string(),
        skipped_segments: (skipped_segments > 0).then_some(skipped_segments),
        skipped_urls: (!skipped_urls.is_empty()).then_some(skipped_urls),
    })
}

pub async fn download_mp4_url(req: Mp4DownloadRequest) -> Result<Mp4DownloadResult, VideoError> {
    let url = req.url.trim().to_string();
    if url.is_empty() {
        return Err(VideoError::Config("url is empty".into()));
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(VideoError::Config("仅支持 http/https MP4 地址".into()));
    }

    let output_path = ensure_mp4_output_path(&req.output_path)?;
    let result_path = output_path.clone();
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let client = build_http_client(req.referer.as_deref(), req.origin.as_deref())?;
    let bytes = fetch_bytes_with_retry(&client, &url, 8).await?;
    std::fs::write(&output_path, bytes)?;

    Ok(Mp4DownloadResult {
        path: result_path.to_string_lossy().to_string(),
        format: "mp4".to_string(),
        method: "direct-http".to_string(),
    })
}

pub async fn split_mp4_by_seconds(
    req: SplitMp4Request,
    bundled_ffmpeg_dirs: Vec<PathBuf>,
) -> Result<SplitMp4Result, VideoError> {
    let input_path = normalize_existing_file_path(&req.input_path, "inputPath")?;
    let segment_seconds = req.segment_seconds.unwrap_or(15.0);
    if segment_seconds < 1.0 {
        return Err(VideoError::Config("切片时长不能小于 1 秒".into()));
    }

    let output_dir = resolve_split_output_dir(&input_path, req.output_dir.as_deref())?;
    std::fs::create_dir_all(&output_dir)?;
    clear_existing_clip_outputs(&output_dir)?;

    let ffmpeg = resolve_ffmpeg_path(req.ffmpeg_path.as_deref(), bundled_ffmpeg_dirs)?;
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

pub async fn fetch_video_play_page(
    req: FetchVideoPageRequest,
) -> Result<FetchVideoPageResult, VideoError> {
    let url = req.url.trim();
    if !url.starts_with("https://www.hongguostudio.com/vodplay/") {
        return Err(VideoError::Config("只允许读取 hongguostudio 播放页".into()));
    }

    let client = build_http_client(Some(HLS_REFERER), Some(HLS_ORIGIN))?;
    let html = fetch_text_with_retry(&client, url, 3).await?;
    Ok(FetchVideoPageResult { html })
}

pub async fn fetch_shot4u_playlist(
    req: FetchShot4uPlaylistRequest,
) -> Result<FetchShot4uPlaylistResult, VideoError> {
    let page_url = req.url.trim();
    let (vid, vfrom, vpart) = parse_shot4u_play_url(page_url)?;
    let ass_url =
        format!("https://m.shot4u.com/ass.php?url=dp&vid={vid}&vfrom={vfrom}&vpart={vpart}");

    let client = build_http_client(Some(page_url), Some("https://m.shot4u.com"))?;
    let text = fetch_text_with_retry(&client, &ass_url, 3).await?;
    let m3u8_urls = extract_m3u8_urls_from_ass_response(&text);
    if m3u8_urls.is_empty() {
        return Err(VideoError::Config("ass.php 响应中未找到 index.m3u8".into()));
    }

    Ok(FetchShot4uPlaylistResult { ass_url, m3u8_urls })
}

pub async fn fetch_hongguo_api(req: HongguoApiRequest) -> Result<Value, VideoError> {
    let key = req.key.trim();
    if key.is_empty() {
        return Err(VideoError::Config("红果 API key 为空".into()));
    }

    let client = build_http_client(None, None)?;
    let mut params = vec![
        ("key".to_string(), key.to_string()),
        ("type".to_string(), req.action.trim().to_string()),
    ];
    if let Some(value) = req.keyword.filter(|value| !value.trim().is_empty()) {
        params.push(("keyword".to_string(), value));
    }
    if let Some(value) = req.page.filter(|value| !value.trim().is_empty()) {
        params.push(("page".to_string(), value));
    }
    if let Some(value) = req.id.filter(|value| !value.trim().is_empty()) {
        params.push(("id".to_string(), value));
    }
    if let Some(value) = req.video_id.filter(|value| !value.trim().is_empty()) {
        params.push(("video_id".to_string(), value));
    }

    let response = client
        .get("https://www.52api.cn/api/hg_new")
        .query(&params)
        .send()
        .await
        .map_err(|e| VideoError::Http(e.to_string()))?;
    if !response.status().is_success() {
        return Err(VideoError::Http(format!("HTTP {}", response.status())));
    }

    response
        .json::<Value>()
        .await
        .map_err(|e| VideoError::Http(e.to_string()))
}

pub async fn decrypt_hongguo_video(req: HongguoDecryptRequest) -> Result<Value, VideoError> {
    let key = req.key.trim();
    if key.is_empty() {
        return Err(VideoError::Config("红果 API key 为空".into()));
    }
    if req.url.trim().is_empty() || req.decrypt_key.trim().is_empty() {
        return Err(VideoError::Config("云解析参数不完整".into()));
    }

    let client = build_http_client(None, None)?;
    let response = client
        .post("https://www.52api.cn/api/hg_decrypt")
        .form(&[
            ("key", key),
            ("url", req.url.trim()),
            ("decrypt_key", req.decrypt_key.trim()),
        ])
        .send()
        .await
        .map_err(|e| VideoError::Http(e.to_string()))?;
    if !response.status().is_success() {
        return Err(VideoError::Http(format!("HTTP {}", response.status())));
    }

    response
        .json::<Value>()
        .await
        .map_err(|e| VideoError::Http(e.to_string()))
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
    stderr
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("ffmpeg exit non-zero")
        .to_string()
}

async fn download_hls_segments_and_mux(
    m3u8_url: &str,
    output_path: &Path,
    ffmpeg: &Path,
    referer: Option<&str>,
    origin: Option<&str>,
) -> Result<Vec<String>, VideoError> {
    let tmp_dir = std::env::temp_dir().join(format!("jike-hls-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&tmp_dir)?;

    let client = build_http_client(referer.or(Some(HLS_REFERER)), origin.or(Some(HLS_ORIGIN)))?;
    let master_text = fetch_text_with_retry(&client, m3u8_url, 8).await?;
    let media_url = select_media_playlist_url(m3u8_url, &master_text)?;
    let media_text = if media_url == m3u8_url {
        master_text
    } else {
        fetch_text_with_retry(&client, &media_url, 8).await?
    };
    let segment_urls = parse_segment_urls(&media_url, &media_text)?;
    if segment_urls.is_empty() {
        return Err(VideoError::Config("m3u8 播放列表中没有视频分片".into()));
    }

    let mut concat_list = String::new();
    let mut downloaded_segments = 0usize;
    let mut skipped_urls = Vec::new();
    for (index, segment_url) in segment_urls.iter().enumerate() {
        let bytes = match fetch_bytes_with_retry(&client, segment_url, 12).await {
            Ok(bytes) => bytes,
            Err(_) => {
                skipped_urls.push(segment_url.clone());
                continue;
            }
        };
        let segment_path = tmp_dir.join(format!("segment-{index:06}.ts"));
        std::fs::write(&segment_path, &bytes)?;
        downloaded_segments += 1;
        concat_list.push_str("file '");
        concat_list.push_str(
            &segment_path
                .to_string_lossy()
                .replace('\\', "/")
                .replace('\'', "'\\''"),
        );
        concat_list.push_str("'\n");
    }

    if downloaded_segments == 0 {
        return Err(VideoError::Http("所有视频分片都下载失败".into()));
    }

    let concat_path = tmp_dir.join("concat.txt");
    std::fs::write(&concat_path, concat_list)?;
    mux_segments_to_mp4(ffmpeg, &concat_path, output_path).await?;

    let _ = std::fs::remove_dir_all(&tmp_dir);
    Ok(skipped_urls)
}

fn build_http_client(referer: Option<&str>, origin: Option<&str>) -> Result<Client, VideoError> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(HLS_USER_AGENT));
    if let Some(referer) = referer.filter(|value| !value.trim().is_empty()) {
        headers.insert(
            REFERER,
            HeaderValue::from_str(referer.trim()).map_err(|e| VideoError::Config(e.to_string()))?,
        );
    }
    if let Some(origin) = origin.filter(|value| !value.trim().is_empty()) {
        headers.insert(
            ORIGIN,
            HeaderValue::from_str(origin.trim()).map_err(|e| VideoError::Config(e.to_string()))?,
        );
    }

    Client::builder()
        .default_headers(headers)
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|e| VideoError::Http(e.to_string()))
}

fn parse_shot4u_play_url(page_url: &str) -> Result<(String, String, String), VideoError> {
    let parsed = Url::parse(page_url).map_err(|e| VideoError::Config(e.to_string()))?;
    if parsed.scheme() != "https" || parsed.host_str() != Some("m.shot4u.com") {
        return Err(VideoError::Config("只允许读取 m.shot4u.com 播放页".into()));
    }

    let path = parsed.path();
    let file_name = path
        .strip_prefix("/play/")
        .and_then(|value| value.strip_suffix(".html"))
        .ok_or_else(|| {
            VideoError::Config("Shot4u 链接格式应为 /play/{vid}-{vfrom}-{vpart}.html".into())
        })?;
    let parts = file_name.split('-').collect::<Vec<_>>();
    if parts.len() != 3 || parts.iter().any(|part| part.is_empty()) {
        return Err(VideoError::Config("Shot4u 播放页参数无法解析".into()));
    }

    Ok((
        parts[0].to_string(),
        parts[1].to_string(),
        parts[2].to_string(),
    ))
}

fn extract_m3u8_urls_from_ass_response(text: &str) -> Vec<String> {
    if let Some(json_text) = extract_jsonp_json(text) {
        if let Ok(value) = serde_json::from_str::<Value>(json_text) {
            if let Some(video) = value
                .get("s")
                .and_then(|s| s.get("video"))
                .and_then(|video| video.as_array())
            {
                let urls = video
                    .iter()
                    .filter_map(|item| item.as_str())
                    .map(|url| url.replace("\\/", "/"))
                    .filter(|url| url.contains("index.m3u8"))
                    .collect::<Vec<_>>();
                if !urls.is_empty() {
                    return urls;
                }
            }
        }
    }

    scan_m3u8_urls(&text.replace("\\/", "/"))
}

fn extract_jsonp_json(text: &str) -> Option<&str> {
    let trimmed = text.trim();
    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        return Some(trimmed);
    }

    let start = trimmed.find('(')?;
    let end = trimmed.rfind(')')?;
    (end > start).then_some(&trimmed[(start + 1)..end])
}

fn scan_m3u8_urls(text: &str) -> Vec<String> {
    let mut urls = Vec::new();
    let mut rest = text;

    while let Some(start) = rest.find("https://") {
        let after_start = &rest[start..];
        if let Some(end) = after_start.find("index.m3u8") {
            let url_end = end + "index.m3u8".len();
            urls.push(after_start[..url_end].to_string());
            rest = &after_start[url_end..];
        } else {
            break;
        }
    }

    urls
}

async fn fetch_text_with_retry(
    client: &Client,
    url: &str,
    attempts: usize,
) -> Result<String, VideoError> {
    let bytes = fetch_bytes_with_retry(client, url, attempts).await?;
    String::from_utf8(bytes).map_err(|e| VideoError::Http(e.to_string()))
}

async fn fetch_bytes_with_retry(
    client: &Client,
    url: &str,
    attempts: usize,
) -> Result<Vec<u8>, VideoError> {
    let mut last_error = String::new();
    for attempt in 1..=attempts {
        match client.get(url).send().await {
            Ok(response) if response.status().is_success() => match response.bytes().await {
                Ok(bytes) => return Ok(bytes.to_vec()),
                Err(error) => last_error = error.to_string(),
            },
            Ok(response) => {
                last_error = format!("HTTP {}", response.status());
            }
            Err(error) => {
                last_error = error.to_string();
            }
        }

        if attempt < attempts {
            let delay_ms = (attempt as u64 * 700).min(5_000);
            sleep(Duration::from_millis(delay_ms)).await;
        }
    }

    Err(VideoError::Http(format!(
        "下载失败：{} ({})",
        url, last_error
    )))
}

fn select_media_playlist_url(master_url: &str, playlist: &str) -> Result<String, VideoError> {
    let mut expect_variant = false;
    for line in playlist.lines().map(str::trim) {
        if line.starts_with("#EXT-X-STREAM-INF") {
            expect_variant = true;
            continue;
        }
        if expect_variant && !line.is_empty() && !line.starts_with('#') {
            return join_hls_url(master_url, line);
        }
    }

    Ok(master_url.to_string())
}

fn parse_segment_urls(media_url: &str, playlist: &str) -> Result<Vec<String>, VideoError> {
    for line in playlist.lines().map(str::trim) {
        if line.starts_with("#EXT-X-KEY") && !line.contains("METHOD=NONE") {
            return Err(VideoError::Config("暂不支持加密 HLS 播放列表".into()));
        }
        if line.starts_with("#EXT-X-MAP") {
            return Err(VideoError::Config("暂不支持 fMP4 HLS 播放列表".into()));
        }
    }

    playlist
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| join_hls_url(media_url, line))
        .collect()
}

fn join_hls_url(base_url: &str, value: &str) -> Result<String, VideoError> {
    Url::parse(base_url)
        .map_err(|e| VideoError::Config(e.to_string()))?
        .join(value)
        .map(|url| url.to_string())
        .map_err(|e| VideoError::Config(e.to_string()))
}

async fn mux_segments_to_mp4(
    ffmpeg: &Path,
    concat_path: &Path,
    output_path: &Path,
) -> Result<(), VideoError> {
    let ffmpeg = ffmpeg.to_path_buf();
    let concat_path = concat_path.to_path_buf();
    let output_path = output_path.to_path_buf();

    let ffmpeg_output = tokio::task::spawn_blocking(move || {
        Command::new(&ffmpeg)
            .args([
                "-y",
                "-hide_banner",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                concat_path.to_string_lossy().as_ref(),
                "-c",
                "copy",
                "-bsf:a",
                "aac_adtstoasc",
                "-movflags",
                "+faststart",
                output_path.to_string_lossy().as_ref(),
            ])
            .output()
    })
    .await
    .map_err(|e| VideoError::JobFailed(e.to_string()))?
    .map_err(|e| VideoError::JobFailed(e.to_string()))?;

    if ffmpeg_output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&ffmpeg_output.stderr);
    let message = stderr
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("ffmpeg exit non-zero");
    Err(VideoError::JobFailed(message.to_string()))
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

async fn trim_via_ffmpeg(
    req: &VideoTrimRequest,
    bundled_ffmpeg_dirs: Vec<PathBuf>,
) -> Result<VideoTrimResult, VideoError> {
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
    let ffmpeg = resolve_ffmpeg_path(req.ffmpeg_path.as_deref(), bundled_ffmpeg_dirs)?;
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

fn resolve_ffmpeg_path(
    request_path: Option<&str>,
    bundled_ffmpeg_dirs: Vec<PathBuf>,
) -> Result<PathBuf, VideoError> {
    if let Some(configured) = request_path.filter(|value| !value.trim().is_empty()) {
        return normalize_and_validate_configured_ffmpeg_path("请求参数 ffmpegPath", configured);
    }

    if let Some(configured) = env_or(FFMPEG_PATH_ENV) {
        return normalize_and_validate_configured_ffmpeg_path(
            "环境变量 JIKE_FFMPEG_PATH",
            &configured,
        );
    }

    for candidate in ffmpeg_candidates(bundled_ffmpeg_dirs) {
        if is_usable_ffmpeg_path(&candidate) {
            return Ok(candidate);
        }
    }

    Err(VideoError::JobFailed(
        "未找到 ffmpeg。请安装 ffmpeg 后重启应用，或设置环境变量 JIKE_FFMPEG_PATH 为 ffmpeg.exe 的完整路径".into(),
    ))
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

fn ensure_mp4_output_path(value: &str) -> Result<PathBuf, VideoError> {
    let trimmed = value.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err(VideoError::Config("outputPath is empty".into()));
    }

    let mut path = PathBuf::from(trimmed);
    if path.extension().and_then(|ext| ext.to_str()) != Some("mp4") {
        path.set_extension("mp4");
    }
    Ok(path)
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

fn ffmpeg_candidates(bundled_ffmpeg_dirs: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    for dir in bundled_ffmpeg_dirs {
        push_ffmpeg_dir_candidates(&mut candidates, dir);
    }

    if let Some(path_var) = env::var_os("PATH") {
        push_path_candidates(&mut candidates, path_var);
    }

    #[cfg(windows)]
    for path_var in windows_registry_path_values() {
        push_path_candidates(&mut candidates, path_var);
    }

    for dir in runtime_candidate_dirs() {
        push_ffmpeg_dir_candidates(&mut candidates, dir);
    }

    #[cfg(windows)]
    push_windows_common_ffmpeg_candidates(&mut candidates);

    candidates
}

fn push_ffmpeg_dir_candidates(candidates: &mut Vec<PathBuf>, dir: PathBuf) {
    push_candidate(candidates, dir.join(ffmpeg_executable_name()));
    push_candidate(candidates, dir.join("bin").join(ffmpeg_executable_name()));
    push_candidate(
        candidates,
        dir.join("ffmpeg").join(ffmpeg_executable_name()),
    );
    push_candidate(
        candidates,
        dir.join("ffmpeg")
            .join("bin")
            .join(ffmpeg_executable_name()),
    );
    push_candidate(
        candidates,
        dir.join("ffmpeg")
            .join("windows-x86_64")
            .join("bin")
            .join(ffmpeg_executable_name()),
    );
    push_candidate(
        candidates,
        dir.join("resources")
            .join("ffmpeg")
            .join("windows-x86_64")
            .join("bin")
            .join(ffmpeg_executable_name()),
    );
}

fn push_path_candidates(candidates: &mut Vec<PathBuf>, path_var: OsString) {
    for dir in env::split_paths(&path_var) {
        push_candidate(candidates, dir.join(ffmpeg_executable_name()));
    }
}

fn runtime_candidate_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            push_candidate(&mut dirs, dir);
            if let Some(parent) = dir.parent() {
                push_candidate(&mut dirs, parent);
                push_candidate(&mut dirs, parent.join("resources"));
                push_candidate(&mut dirs, parent.join("Resources"));
            }
        }
    }

    if let Ok(current_dir) = env::current_dir() {
        push_candidate(&mut dirs, &current_dir);
        push_candidate(&mut dirs, current_dir.join("resources"));
        push_candidate(&mut dirs, current_dir.join("src-tauri").join("binaries"));
        push_candidate(&mut dirs, current_dir.join("src-tauri").join("resources"));
        if let Some(parent) = current_dir.parent() {
            push_candidate(&mut dirs, parent.join("resources"));
        }
    }

    dirs
}

fn push_candidate(candidates: &mut Vec<PathBuf>, candidate: impl Into<PathBuf>) {
    let candidate = candidate.into();
    if !candidates.iter().any(|item| item == &candidate) {
        candidates.push(candidate);
    }
}

#[cfg(windows)]
fn windows_registry_path_values() -> Vec<OsString> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Environment")
        .ok()
        .and_then(|key| key.get_value::<String, _>("Path").ok());
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
        .ok()
        .and_then(|key| key.get_value::<String, _>("Path").ok());

    [hkcu, hklm]
        .into_iter()
        .flatten()
        .map(|value| OsString::from(expand_windows_env_vars(&value)))
        .collect()
}

#[cfg(windows)]
fn expand_windows_env_vars(value: &str) -> String {
    let mut expanded = String::new();
    let mut rest = value;

    while let Some(start) = rest.find('%') {
        expanded.push_str(&rest[..start]);
        let after_start = &rest[(start + 1)..];
        if let Some(end) = after_start.find('%') {
            let key = &after_start[..end];
            if let Ok(env_value) = env::var(key) {
                expanded.push_str(&env_value);
            } else {
                expanded.push('%');
                expanded.push_str(key);
                expanded.push('%');
            }
            rest = &after_start[(end + 1)..];
        } else {
            expanded.push_str(&rest[start..]);
            rest = "";
        }
    }

    expanded.push_str(rest);
    expanded
}

#[cfg(windows)]
fn push_windows_common_ffmpeg_candidates(candidates: &mut Vec<PathBuf>) {
    push_candidate(
        candidates,
        PathBuf::from(r"C:\ffmpeg\bin").join(ffmpeg_executable_name()),
    );
    push_candidate(
        candidates,
        PathBuf::from(r"C:\ProgramData\chocolatey\bin").join(ffmpeg_executable_name()),
    );

    for key in [
        "ProgramFiles",
        "ProgramFiles(x86)",
        "LOCALAPPDATA",
        "USERPROFILE",
    ] {
        if let Some(base) = env::var_os(key) {
            let base = PathBuf::from(base);
            push_candidate(
                candidates,
                base.join("ffmpeg")
                    .join("bin")
                    .join(ffmpeg_executable_name()),
            );
            push_candidate(
                candidates,
                base.join("Programs")
                    .join("ffmpeg")
                    .join("bin")
                    .join(ffmpeg_executable_name()),
            );
        }
    }

    if let Some(home) = env::var_os("USERPROFILE") {
        let home = PathBuf::from(home);
        push_candidate(
            candidates,
            home.join("scoop")
                .join("shims")
                .join(ffmpeg_executable_name()),
        );
    }
}

#[allow(dead_code)]
fn _sleep_ms_unused() {}
