use crate::domain::tracking_service;
use crate::models::AIVideoTrackData;

#[tauri::command]
pub async fn tracking_send(data: AIVideoTrackData) -> Result<serde_json::Value, String> {
    Ok(serde_json::to_value(tracking_service::send(&data)).unwrap())
}

#[tauri::command]
pub async fn tracking_update_status(
    task_id: String,
    status: String,
    error_message: Option<String>,
    _generated_video_url: Option<String>,
) -> Result<serde_json::Value, String> {
    Ok(serde_json::to_value(tracking_service::update_status(
        &task_id,
        &status,
        error_message.as_deref(),
    ))
    .unwrap())
}
