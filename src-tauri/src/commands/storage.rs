// storage:* 命令注册
// 与原 src/main/ipc/storage 通道名严格一致：前端可继续用 invoke('storage:xxx')
// 这里采用统一命名风格 "storage_xxx" 命令，前端通过 prefix 路由层调用
// 实际 Tauri 2 推荐做法：使用 tauri::generate_handler! 并由前端直接 invoke
// 为兼容原 30+ 处 window.storage.xxx 调用，我们把 storage 域命令集中到
// 前端 src/renderer/services/tauri-bridge.ts 中做 channel → command 名映射

use crate::domain;
use tauri::AppHandle;

pub fn register(_app: &AppHandle) {
    // 命令函数由 generate_handler! 集中注册在 lib.rs
    // 此函数保留用于未来插件化注册
}

#[tauri::command]
pub async fn storage_select_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("选择项目存储路径")
        .pick_folder(move |path| {
            let s = path.and_then(|p| p.into_path().ok()).map(|pb| pb.to_string_lossy().to_string());
            let _ = tx.send(s);
        });
    rx.await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_ensure_project(base: String, project: String) -> Result<serde_json::Value, String> {
    domain::ensure_project_handler(&base, &project).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_list_projects(base: String) -> Result<serde_json::Value, String> {
    domain::list_projects_handler(&base).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_canvas(base: String, project: String, data: serde_json::Value) -> Result<serde_json::Value, String> {
    domain::save_canvas_handler(&base, &project, data).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_load_canvas(base: String, project: String) -> Result<serde_json::Value, String> {
    domain::load_canvas_handler(&base, &project).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_media(base: String, relative_path: String, buffer: Vec<u8>) -> Result<serde_json::Value, String> {
    domain::save_media_handler(&base, &relative_path, buffer).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_read_media(base: String, relative_path: String) -> Result<serde_json::Value, String> {
    domain::read_media_handler(&base, &relative_path).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_write_raw_file(base: String, relative_path: String, buffer: Vec<u8>) -> Result<serde_json::Value, String> {
    domain::write_raw_file_handler(&base, &relative_path, buffer).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_read_raw_file(base: String, relative_path: String) -> Result<serde_json::Value, String> {
    domain::read_raw_file_handler(&base, &relative_path).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_scan_asset_library(base: String) -> Result<serde_json::Value, String> {
    domain::scan_asset_library_handler(&base).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete_raw_path(base: String, relative_path: String) -> Result<serde_json::Value, String> {
    domain::delete_raw_path_handler(&base, &relative_path).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_rename_raw_path(base: String, old_path: String, new_path: String) -> Result<serde_json::Value, String> {
    domain::rename_raw_path_handler(&base, &old_path, &new_path).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_list_media(base: String, project: String, media_type: String) -> Result<serde_json::Value, String> {
    domain::list_media_handler(&base, &project, &media_type).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete_media(base: String, relative_path: String) -> Result<serde_json::Value, String> {
    domain::delete_media_handler(&base, &relative_path).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_download_media(base: String, url: String, relative_path: String) -> Result<serde_json::Value, String> {
    domain::download_media_handler(&base, &url, &relative_path).await.map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_buffer_to_file(default_name: String, buffer: Vec<u8>, app: tauri::AppHandle) -> Result<serde_json::Value, String> {
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
        Some(p) => {
            domain::write_bytes_to_path(&p, &buffer).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
pub async fn storage_media_exists(base: String, relative_path: String) -> Result<bool, String> {
    Ok(domain::media_exists_handler(&base, &relative_path))
}

#[tauri::command]
pub async fn storage_rename_project(base: String, old_name: String, new_name: String) -> Result<serde_json::Value, String> {
    domain::rename_project_handler(&base, &old_name, &new_name).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete_project(base: String, project: String) -> Result<serde_json::Value, String> {
    domain::delete_project_handler(&base, &project).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_copy_project(base: String, src: String, dest: String) -> Result<serde_json::Value, String> {
    domain::copy_project_handler(&base, &src, &dest).map(|r| serde_json::to_value(r).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_export_project(base: String, project: String, app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("选择导出位置")
        .pick_folder(move |path| {
            let s = path.and_then(|p| p.into_path().ok()).map(|pb| pb.to_string_lossy().to_string());
            let _ = tx.send(s);
        });
    let target = rx.await.map_err(|e| e.to_string())?;
    match target {
        None => Ok(serde_json::json!({ "success": false, "canceled": true })),
        Some(p) => domain::export_project_handler(&base, &project, &p)
            .map(|r| serde_json::to_value(r).unwrap())
            .map_err(|e| e.to_string()),
    }
}

#[tauri::command]
pub async fn storage_import_project(base: String, app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("选择要导入的项目文件夹")
        .pick_folder(move |path| {
            let s = path.and_then(|p| p.into_path().ok()).map(|pb| pb.to_string_lossy().to_string());
            let _ = tx.send(s);
        });
    let target = rx.await.map_err(|e| e.to_string())?;
    match target {
        None => Ok(serde_json::json!({ "success": false, "canceled": true })),
        Some(p) => domain::import_project_handler(&base, &p)
            .map(|r| serde_json::to_value(r).unwrap())
            .map_err(|e| e.to_string()),
    }
}

#[tauri::command]
pub async fn storage_get_default_path(_app: tauri::AppHandle) -> Result<String, String> {
    // tauri-plugin-os 2.3.x 未暴露文档目录 API；通过 tauri::path::PathResolver 取
    use tauri::Manager;
    let resolver = _app.path();
    let home = resolver.document_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    Ok(domain::get_default_path_handler(&home))
}

// Legacy aliases - 兼容既有 service 层调用
#[tauri::command]
pub async fn storage_ensure_project_dir(base: String, project: String) -> Result<serde_json::Value, String> {
    storage_ensure_project(base, project).await
}

#[tauri::command]
pub async fn storage_write_file(base: String, relative_path: String, buffer: Vec<u8>) -> Result<serde_json::Value, String> {
    storage_save_media(base, relative_path, buffer).await
}

#[tauri::command]
pub async fn storage_read_file(base: String, relative_path: String) -> Result<serde_json::Value, String> {
    storage_read_media(base, relative_path).await
}

#[tauri::command]
pub async fn storage_delete_file(base: String, relative_path: String) -> Result<serde_json::Value, String> {
    storage_delete_media(base, relative_path).await
}

#[tauri::command]
pub async fn storage_list_files(base: String, project: String, media_type: String) -> Result<serde_json::Value, String> {
    storage_list_media(base, project, media_type).await
}

#[tauri::command]
pub async fn storage_download_file(base: String, url: String, relative_path: String) -> Result<serde_json::Value, String> {
    storage_download_media(base, url, relative_path).await
}

#[tauri::command]
pub async fn storage_file_exists(base: String, relative_path: String) -> Result<bool, String> {
    storage_media_exists(base, relative_path).await
}
