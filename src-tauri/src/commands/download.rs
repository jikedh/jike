use crate::domain;

pub fn register(_app: &tauri::AppHandle) {}

#[tauri::command]
pub async fn download_image_as_buffer(url: String) -> Result<serde_json::Value, String> {
    domain::image_as_buffer(&url).await
        .map(|r| serde_json::json!({ "success": true, "data": r }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_image_as_base64(url: String) -> Result<serde_json::Value, String> {
    domain::image_as_base64(&url).await
        .map(|r| serde_json::json!({ "success": true, "data": r }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_image_to_file(url: String, file_path: String) -> Result<serde_json::Value, String> {
    domain::image_to_file(&url, &file_path).await
        .map(|r| serde_json::json!({ "success": true, "data": r }))
        .map_err(|e| e.to_string())
}
