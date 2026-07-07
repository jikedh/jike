use crate::domain;

fn append_default_extension_if_missing(path: String, default_name: &str) -> String {
    let Some(default_extension) = std::path::Path::new(default_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .filter(|extension| !extension.is_empty())
    else {
        return path;
    };

    let path_buffer = std::path::PathBuf::from(&path);
    if path_buffer
        .extension()
        .and_then(|extension| extension.to_str())
        .filter(|extension| !extension.is_empty())
        .is_some()
    {
        return path;
    }

    path_buffer
        .with_extension(default_extension)
        .to_string_lossy()
        .to_string()
}

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
    let dialog = app.dialog()
        .file()
        .set_title("保存文件")
        .set_file_name(&default_name);
    let dialog = match std::path::Path::new(&default_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => dialog.add_filter("PNG 图片", &["png"]),
        Some("jpg") | Some("jpeg") => dialog.add_filter("JPEG 图片", &["jpg", "jpeg"]),
        Some("webp") => dialog.add_filter("WebP 图片", &["webp"]),
        Some("gif") => dialog.add_filter("GIF 图片", &["gif"]),
        Some("mp4") => dialog.add_filter("MP4 视频", &["mp4"]),
        Some("webm") => dialog.add_filter("WebM 视频", &["webm"]),
        Some("mov") => dialog.add_filter("MOV 视频", &["mov"]),
        _ => dialog.add_filter("图片文件", &["png", "jpg", "jpeg", "webp", "gif"]),
    };
    let default_name_for_path = default_name.clone();
    dialog.save_file(move |path| {
        let s = path
            .and_then(|p| p.into_path().ok())
            .map(|pb| {
                append_default_extension_if_missing(
                    pb.to_string_lossy().to_string(),
                    &default_name_for_path,
                )
            });
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
