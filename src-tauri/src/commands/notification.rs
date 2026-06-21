use tauri::Manager;

#[tauri::command]
pub async fn notification_show(app: tauri::AppHandle, title: Option<String>, body: Option<String>, when_window_focused: Option<bool>) -> Result<serde_json::Value, String> {
    use tauri_plugin_notification::NotificationExt;
    let title = title.unwrap_or_else(|| "即刻".to_string());
    let body = body.unwrap_or_else(|| "任务已完成".to_string());
    if let Some(focused) = when_window_focused {
        if focused {
            if let Some(w) = app.get_webview_window("main") {
                if let Ok(true) = w.is_focused() {
                    return Ok(serde_json::json!({ "success": true, "skipped": true }));
                }
            }
        }
    }
    match app.notification().builder().title(title).body(body).show() {
        Ok(_) => Ok(serde_json::json!({ "success": true })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn notification_is_supported(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_notification::NotificationExt;
    Ok(app.notification().permission_state().is_ok())
}
