use crate::models::browser::{BrowserCapture, BrowserKey, BrowserLayout, BrowserOpen};
use tauri::Webview;

#[tauri::command]
pub async fn browser_open(webview: Webview, request: BrowserOpen) -> Result<(), String> {
    super::browser_native::open(webview, request).await
}

#[tauri::command]
pub async fn browser_sync(webview: Webview, request: BrowserLayout) -> Result<(), String> {
    super::browser_native::sync(webview, request).await
}

#[tauri::command]
pub async fn browser_close(webview: Webview, key: BrowserKey) -> Result<(), String> {
    super::browser_native::close(webview, key).await
}

#[tauri::command]
pub async fn browser_go_back(webview: Webview, key: BrowserKey) -> Result<(), String> {
    super::browser_native::go_back(webview, key).await
}

#[tauri::command]
pub async fn browser_go_forward(webview: Webview, key: BrowserKey) -> Result<(), String> {
    super::browser_native::go_forward(webview, key).await
}

#[tauri::command]
pub async fn browser_capture(webview: Webview, key: BrowserKey) -> Result<BrowserCapture, String> {
    super::browser_native::capture(webview, key).await
}
