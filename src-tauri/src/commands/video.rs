use crate::domain;
use crate::models::{
    FetchShot4uPlaylistRequest, FetchVideoPageRequest, HongguoApiRequest, HongguoDecryptRequest,
    HongguoPlayRequest, M3u8ToMp4Request, Mp4DownloadRequest, SplitMp4Request, VideoTrimRequest,
};
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
pub async fn video_processing_trim(
    app: tauri::AppHandle,
    request: VideoTrimRequest,
) -> Result<serde_json::Value, String> {
    match domain::trim_video(request, ffmpeg_resource_dirs(&app)).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn video_download_m3u8_to_mp4(
    app: tauri::AppHandle,
    request: M3u8ToMp4Request,
) -> Result<serde_json::Value, String> {
    match domain::download_m3u8_to_mp4(request, ffmpeg_resource_dirs(&app)).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn video_download_mp4_url(
    request: Mp4DownloadRequest,
) -> Result<serde_json::Value, String> {
    match domain::download_mp4_url(request).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn video_split_mp4_by_seconds(
    app: tauri::AppHandle,
    request: SplitMp4Request,
) -> Result<serde_json::Value, String> {
    match domain::split_mp4_by_seconds(request, ffmpeg_resource_dirs(&app)).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn video_fetch_play_page(
    request: FetchVideoPageRequest,
) -> Result<serde_json::Value, String> {
    match domain::fetch_video_play_page(request).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn video_fetch_shot4u_playlist(
    request: FetchShot4uPlaylistRequest,
) -> Result<serde_json::Value, String> {
    match domain::fetch_shot4u_playlist(request).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn video_fetch_hongguo_api(
    request: HongguoApiRequest,
) -> Result<serde_json::Value, String> {
    match domain::fetch_hongguo_api(request).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn video_fetch_hongguo_play(
    request: HongguoPlayRequest,
) -> Result<serde_json::Value, String> {
    match domain::fetch_hongguo_play(request).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn video_decrypt_hongguo_video(
    request: HongguoDecryptRequest,
) -> Result<serde_json::Value, String> {
    match domain::decrypt_hongguo_video(request).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

fn ffmpeg_resource_dirs(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        dirs.push(resource_dir.join("ffmpeg").join("windows-x86_64"));
        dirs.push(
            resource_dir
                .join("resources")
                .join("ffmpeg")
                .join("windows-x86_64"),
        );
    }

    dirs
}
