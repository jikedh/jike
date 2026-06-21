// 系统托盘命令
// 原 Electron 实现位于 src/main/ipc/tray/service.ts
// Tauri 2 中托盘通过 tauri::tray::TrayIconBuilder 在 setup() 中构建并随窗口事件更新菜单
// 本文件仅提供业务规则查询（菜单项列表），菜单构建在 lib.rs 的 setup 阶段完成

use crate::domain::tray_service;

pub fn register(_app: &tauri::AppHandle) {}

#[tauri::command]
pub async fn tray_build_menu(window_visible: bool) -> Result<serde_json::Value, String> {
    let items = tray_service::build_default_menu(window_visible);
    Ok(serde_json::to_value(items).unwrap())
}

#[tauri::command]
pub async fn tray_quit(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}
