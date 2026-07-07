use crate::domain;

#[tauri::command]
pub async fn copy_video_url_to_oss(
    video_url: String,
    upload_api_url: String,
    auth_token: Option<String>,
) -> Result<serde_json::Value, String> {
    domain::copy_video_url_to_oss(&video_url, &upload_api_url, auth_token)
        .await
        .map(|url| serde_json::json!({ "success": true, "url": url }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn copy_media_url_to_oss(
    media_url: String,
    upload_api_url: String,
    auth_token: Option<String>,
) -> Result<serde_json::Value, String> {
    domain::copy_media_url_to_oss(&media_url, &upload_api_url, auth_token)
        .await
        .map(|url| serde_json::json!({ "success": true, "url": url }))
        .map_err(|e| e.to_string())
}
