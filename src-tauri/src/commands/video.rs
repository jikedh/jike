use crate::domain;
use crate::models::VideoTrimRequest;

pub fn register(_app: &tauri::AppHandle) {}

#[tauri::command]
pub async fn video_processing_trim(request: VideoTrimRequest) -> Result<serde_json::Value, String> {
    match domain::trim_video(request).await {
        Ok(r) => Ok(serde_json::json!({ "success": true, "data": r })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}
