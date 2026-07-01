// 视频裁剪领域服务
// 原 ipc/video-processing/service.ts 用阿里云 ICE + ffmpeg + 后端上传
// Rust 端等价实现：调用阿里云 ICE REST API 提交裁剪作业，等待完成，下载到本地，
// 通过后端 /v1/oss/upload 上传。ffmpeg 方案降级为调用本地 ffmpeg 二进制。

use crate::models::{VideoTrimRequest, VideoTrimResult};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    process::Command,
};

#[cfg(windows)]
use winreg::{enums::*, RegKey};

const FFMPEG_PATH_ENV: &str = "JIKE_FFMPEG_PATH";

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

async fn trim_via_ice(cfg: &AliyunRuntimeConfig, _req: &VideoTrimRequest) -> Result<VideoTrimResult, VideoError> {
    let _ = (cfg.access_key_id.as_str(), cfg.ims_region_id.as_ref());
    // 真实接入阿里云 ICE 需要 aliyun-openapi-core SDK；
    // 此处作为可运行骨架的占位（提交-轮询-下载链路在 .cargo 锁文件中已含 reqwest + serde）。
    // 后续可在 domain/video_service.rs 内补全 SubmitMediaProducingJob / GetMediaProducingJob 调用。
    Err(VideoError::Config("ICE SDK not yet wired in Rust skeleton".into()))
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
            "-ss", &format!("{}", req.start),
            "-i", src.to_string_lossy().as_ref(),
            "-t", &format!("{}", duration),
            "-c", "copy",
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
            .mime_str("video/mp4").map_err(|e| VideoError::Http(e.to_string()))?;
        let mp = reqwest::multipart::Form::new().part("file", form);
        let auth = if token.starts_with("Bearer ") { token.clone() } else { format!("Bearer {}", token) };
        let resp = Client::new()
            .post(&url)
            .header("Authorization", auth)
            .multipart(mp)
            .send()
            .await
            .map_err(|e| VideoError::Http(e.to_string()))?;
        if resp.status().is_success() {
            if let Ok(j) = resp.json::<serde_json::Value>().await {
                if let Some(u) = j.get("data").and_then(|d| d.get("url")).and_then(|u| u.as_str()) {
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
        return normalize_and_validate_configured_ffmpeg_path("环境变量 JIKE_FFMPEG_PATH", &configured);
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

    for key in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA", "USERPROFILE"] {
        if let Some(base) = env::var_os(key) {
            let base = PathBuf::from(base);
            push_candidate(
                candidates,
                base.join("ffmpeg").join("bin").join(ffmpeg_executable_name()),
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
