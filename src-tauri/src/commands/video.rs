use crate::domain;
use crate::models::{M3u8ToMp4Request, VideoTrimRequest};
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
