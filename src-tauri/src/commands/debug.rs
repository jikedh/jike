use tauri::Manager;

#[tauri::command]
pub async fn debug_toggle_dev_tools(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_devtools_open() {
            w.close_devtools();
        } else {
            w.open_devtools();
        }
        Ok(serde_json::json!({ "success": true }))
    } else {
        Ok(serde_json::json!({ "success": false, "error": "Main window not found" }))
    }
}

#[tauri::command]
pub async fn debug_is_dev() -> Result<bool, String> {
    Ok(cfg!(debug_assertions))
}

#[tauri::command]
pub async fn debug_get_app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

#[tauri::command]
pub async fn debug_capture_page(_app: tauri::AppHandle, _rect: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    // 截图能力在 Tauri 2 中需要 webview screenshot 插件（tauri-plugin-screenshot 第三方）
    // 此处先返回不支持错误，调用方会走前端 html2canvas 兜底
    Ok(serde_json::json!({ "success": false, "error": "screenshot not supported in Tauri skeleton" }))
}
