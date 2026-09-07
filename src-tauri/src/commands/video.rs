use crate::domain;
use crate::models::{SplitMp4Request, VideoAnnotationBurnRequest, VideoTrimRequest};

#[tauri::command]
pub async fn video_processing_trim(request: VideoTrimRequest) -> Result<serde_json::Value, String> {
    match domain::trim_video(request).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn video_processing_burn_annotations(
    request: VideoAnnotationBurnRequest,
) -> Result<serde_json::Value, String> {
    match domain::burn_annotations(request).await {
        Ok(result) => Ok(serde_json::json!({ "success": true, "data": result })),
        Err(error) => Ok(serde_json::json!({ "success": false, "error": error.to_string() })),
    }
}

#[tauri::command]
pub async fn video_processing_cleanup_annotation_webview_fallback(
    path: String,
) -> Result<(), String> {
    domain::cleanup_annotation_webview_fallback(&path)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn video_split_mp4_by_seconds(
    request: SplitMp4Request,
) -> Result<serde_json::Value, String> {
    match domain::split_mp4_by_seconds(request).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}
