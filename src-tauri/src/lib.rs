// 即刻 Tauri 应用入口
// 重构要点：
// 1. 注册 Tauri 2 官方插件（dialog/fs/http/notification/shell/store/os/process/opener/global-shortcut）
// 2. 通过 generate_handler! 集中注册所有 commands
// 3. 窗口全屏启动、最大化（保持与原 Electron 一致）

mod commands;
mod domain;
mod models;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::try_init();

    tauri::Builder::default()
        .manage(tray::AppLifecycle::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            tray::setup_tray(app)?;

            // 启动时最大化（保持与原 Electron 一致）
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.maximize();
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 关闭窗口时不退出，仅隐藏（与原 Electron window-all-closed 行为一致）
                let lifecycle = window.state::<tray::AppLifecycle>();
                if window.label() == "main" && !lifecycle.is_exiting() {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::storage_select_directory,
            commands::storage_ensure_project,
            commands::storage_list_projects,
            commands::storage_save_canvas,
            commands::storage_load_canvas,
            commands::storage_save_media,
            commands::storage_read_media,
            commands::storage_write_raw_file,
            commands::storage_read_raw_file,
            commands::storage_scan_asset_library,
            commands::storage_delete_raw_path,
            commands::storage_rename_raw_path,
            commands::storage_list_media,
            commands::storage_delete_media,
            commands::storage_download_media,
            commands::storage_save_buffer_to_file,
            commands::storage_media_exists,
            commands::storage_rename_project,
            commands::storage_delete_project,
            commands::storage_copy_project,
            commands::storage_export_project,
            commands::storage_import_project,
            commands::storage_get_default_path,
            commands::storage_ensure_project_dir,
            commands::storage_write_file,
            commands::storage_read_file,
            commands::storage_delete_file,
            commands::storage_list_files,
            commands::storage_download_file,
            commands::storage_file_exists,
            commands::storage_read_absolute_file,
            commands::download_image_as_buffer,
            commands::download_image_as_base64,
            commands::download_image_to_file,
            commands::download_image_with_save_dialog,
            commands::notification_show,
            commands::notification_is_supported,
            commands::tracking_send,
            commands::tracking_update_status,
            commands::debug_toggle_dev_tools,
            commands::debug_is_dev,
            commands::debug_get_app_version,
            commands::debug_capture_page,
            commands::video_processing_trim,
            commands::video_split_mp4_by_seconds,
            commands::get_local_file_info,
            commands::upload_local_file_to_signed_url,
            commands::copy_video_url_to_oss,
            commands::copy_media_url_to_oss,
            // 剧本Agent
            commands::script_agent_create_session,
            commands::script_agent_list_sessions,
            commands::script_agent_delete_session,
            commands::script_agent_rename_session,
            commands::script_agent_get_messages,
            commands::script_agent_send_message,
            commands::script_agent_list_memories,
            commands::script_agent_upsert_memory,
            commands::script_agent_delete_memory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
