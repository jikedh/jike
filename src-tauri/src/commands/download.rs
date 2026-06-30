use crate::domain;

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

#[tauri::command]
pub async fn download_image_with_save_dialog(url: String, default_name: String, app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("保存文件")
        .set_file_name(&default_name)
        .save_file(move |path| {
            let s = path.and_then(|p| p.into_path().ok()).map(|pb| pb.to_string_lossy().to_string());
            let _ = tx.send(s);
        });

    let target = rx.await.map_err(|e| e.to_string())?;
    match target {
        None => Ok(serde_json::json!({ "success": false, "canceled": true })),
        Some(p) => domain::image_to_file(&url, &p).await
            .map(|r| serde_json::json!({ "success": true, "data": r }))
            .map_err(|e| e.to_string()),
    }
}
