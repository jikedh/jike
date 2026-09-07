use crate::domain;

#[tauri::command]
pub async fn get_local_file_info(path: String) -> Result<serde_json::Value, String> {
    domain::get_local_file_info(&path)
        .await
        .map(|file| serde_json::json!(file))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn upload_local_file_to_backend(
    path: String,
    upload_api_url: String,
    auth_token: Option<String>,
    content_type: Option<String>,
    max_size: u64,
) -> Result<serde_json::Value, String> {
    domain::upload_local_file_to_backend(
        &path,
        &upload_api_url,
        auth_token,
        content_type,
        max_size,
    )
    .await
    .map(|file| serde_json::json!(file))
    .map_err(|error| error.to_string())
}

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
