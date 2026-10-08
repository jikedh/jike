use std::{collections::HashMap, sync::Mutex};
use tauri::{Manager, Webview};
use crate::{domain::browser_service::{same_key, validate_key, validate_layout, validate_url}, models::browser::*};

#[derive(Clone)]
struct Session {
    key: BrowserKey,
    label: String,
    url: String,
    loading: bool,
    visible: bool,
}

#[derive(Default)]
pub struct BrowserRegistry {
    sessions: Mutex<HashMap<String, Session>>,
    operation: tokio::sync::Mutex<()>,
}

fn trusted(webview: &Webview) -> Result<url::Url, String> {
    let owner = webview.window().label().to_string();
    if webview.label() != owner || !(owner == "main" || owner.starts_with("canvas-")) {
        return Err("浏览器命令只允许应用画布调用".into());
    }
    let current = webview.url().map_err(|e| e.to_string())?;
    let allowed = if cfg!(debug_assertions) {
        webview.app_handle().config().build.dev_url.as_ref().is_some_and(|url| url.origin() == current.origin())
    } else {
        (current.scheme() == "tauri" && current.host_str() == Some("localhost"))
            || (current.scheme() == "http" && current.host_str() == Some("tauri.localhost"))
    };
    if !allowed { return Err("浏览器命令来源无效".into()); }
    Ok(current)
}

fn get_session(webview: &Webview, key: &BrowserKey) -> Result<Session, String> {
    trusted(webview)?;
    validate_key(key)?;
    let registry = webview.state::<BrowserRegistry>();
    let sessions = registry.sessions.lock().map_err(|_| "浏览器状态不可用")?;
    sessions.get(webview.label()).filter(|s| same_key(&s.key, key)).cloned().ok_or_else(|| "浏览器会话已关闭或变更".into())
}

#[cfg(windows)]
fn publish(app: &tauri::AppHandle, owner: &str, key: &BrowserKey, url: Option<String>, loading: Option<bool>, title: Option<String>, error: Option<String>) {
    use tauri::Emitter;
    let registry = app.state::<BrowserRegistry>();
    let Ok(mut sessions) = registry.sessions.lock() else { return; };
    let Some(session) = sessions.get_mut(owner).filter(|s| same_key(&s.key, key)) else { return; };
    if let Some(url) = url { session.url = url; }
    if let Some(loading) = loading { session.loading = loading; }
    let payload = BrowserEvent { project_id: key.project_id.clone(), node_id: key.node_id.clone(), session_id: key.session_id.clone(), url: session.url.clone(), loading: session.loading, title, error };
    drop(sessions);
    let _ = app.emit_to(tauri::EventTarget::webview(owner), "browser:state", payload);
}

pub fn cleanup(app: &tauri::AppHandle, owner: &str) {
    let registry = app.state::<BrowserRegistry>();
    let session = registry.sessions.lock().ok().and_then(|mut sessions| sessions.remove(owner));
    if let Some(session) = session {
        if let Some(view) = app.get_webview(&session.label) { let _ = view.close(); }
    }
}

pub async fn open(webview: Webview, request: BrowserOpen) -> Result<(), String> {
    let origin = trusted(&webview)?;
    validate_layout(&request.layout)?;
    let url = validate_url(&request.url, &origin)?;
    #[cfg(not(windows))]
    { let _ = url; return Err("浏览器节点仅支持 Windows 桌面端".into()); }
    #[cfg(windows)]
    {
        use tauri::{webview::{WebviewBuilder, NewWindowResponse, PageLoadEvent}, LogicalPosition, LogicalSize, WebviewUrl};
        let registry = webview.state::<BrowserRegistry>();
        let _operation = registry.operation.lock().await;
        let owner = webview.label().to_string();
        cleanup(webview.app_handle(), &owner);
        let key = request.layout.key.clone();
        let label = format!("browser-{}", uuid::Uuid::new_v4());
        registry.sessions.lock().map_err(|_| "浏览器状态不可用")?.insert(owner.clone(), Session { key: key.clone(), label: label.clone(), url: url.to_string(), loading: true, visible: false });
        let app = webview.app_handle().clone();
        let nav_app = app.clone(); let nav_owner = owner.clone(); let nav_key = key.clone();
        let load_app = app.clone(); let load_owner = owner.clone(); let load_key = key.clone();
        let title_app = app.clone(); let title_owner = owner.clone(); let title_key = key.clone();
        let directory = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("browser-profile");
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let builder = WebviewBuilder::new(&label, WebviewUrl::External(url))
            .data_directory(directory)
            .disable_drag_drop_handler()
            .on_navigation(move |url| {
                let allowed = validate_url(url.as_str(), &origin).is_ok();
                if !allowed { publish(&nav_app, &nav_owner, &nav_key, None, Some(false), None, Some("已阻止不安全或应用内部地址".into())); }
                allowed
            })
            .on_new_window(|_, _| NewWindowResponse::Deny)
            .on_download(|_, _| false)
            .on_page_load(move |_, payload| {
                if payload.event() == PageLoadEvent::Started {
                    publish(&load_app, &load_owner, &load_key, Some(payload.url().to_string()), Some(true), None, None);
                }
            })
            .on_document_title_changed(move |_, title| {
                publish(&title_app, &title_owner, &title_key, None, None, Some(title.chars().take(512).collect()), None);
            });
        // 子 WebView 创建会等待 UI 线程，因此只能从异步命令调用。
        let child = match webview.window().add_child(builder, LogicalPosition::new(-10000.0, -10000.0), LogicalSize::new(request.layout.bounds.width, request.layout.bounds.height)) {
            Ok(child) => child,
            Err(error) => { cleanup(&app, &owner); return Err(error.to_string()); }
        };
        child.hide().map_err(|e| e.to_string())?;
        if let Err(error) = configure(&child, app.clone(), owner.clone(), key.clone(), request.layout.zoom).await {
            cleanup(&app, &owner); return Err(error);
        }
        apply_layout(&child, &request.layout).await?;
        if let Ok(mut sessions) = registry.sessions.lock() {
            if let Some(session) = sessions.get_mut(&owner) { session.visible = request.layout.visible; }
        }
        Ok(())
    }
}

pub async fn sync(webview: Webview, request: BrowserLayout) -> Result<(), String> {
    validate_layout(&request)?;
    let registry = webview.state::<BrowserRegistry>();
    let _operation = registry.operation.lock().await;
    let session = get_session(&webview, &request.key)?;
    #[cfg(windows)]
    {
        let child = webview.app_handle().get_webview(&session.label).ok_or("网页已关闭")?;
        apply_layout(&child, &request).await?;
        if let Ok(mut sessions) = registry.sessions.lock() {
            if let Some(current) = sessions.get_mut(webview.label()).filter(|s| same_key(&s.key, &request.key)) { current.visible = request.visible; }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    { let _ = session; Err("浏览器节点仅支持 Windows 桌面端".into()) }
}

pub async fn close(webview: Webview, key: BrowserKey) -> Result<(), String> {
    trusted(&webview)?; validate_key(&key)?;
    let registry = webview.state::<BrowserRegistry>();
    let _operation = registry.operation.lock().await;
    if get_session(&webview, &key).is_ok() { cleanup(webview.app_handle(), webview.label()); }
    Ok(())
}

#[cfg(windows)]
async fn apply_layout(child: &Webview, layout: &BrowserLayout) -> Result<(), String> {
    if !layout.visible { return child.hide().map_err(|e| e.to_string()); }
    let b = layout.bounds;
    child.set_position(tauri::LogicalPosition::new(b.x, b.y)).map_err(|e| e.to_string())?;
    child.set_size(tauri::LogicalSize::new(b.width, b.height)).map_err(|e| e.to_string())?;
    let zoom = layout.zoom;
    let (tx, rx) = tokio::sync::oneshot::channel();
    child.with_webview(move |platform| {
        let result = unsafe { platform.controller().SetZoomFactor(zoom) }.map_err(|e| e.to_string());
        let _ = tx.send(result);
    }).map_err(|e| e.to_string())?;
    rx.await.map_err(|_| "网页布局更新已取消")??;
    child.show().map_err(|e| e.to_string())
}

#[cfg(windows)]
async fn configure(child: &Webview, app: tauri::AppHandle, owner: String, key: BrowserKey, zoom: f64) -> Result<(), String> {
    use webview2_com::{PermissionRequestedEventHandler, NavigationCompletedEventHandler, Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PERMISSION_STATE_DENY};
    let (tx, rx) = tokio::sync::oneshot::channel();
    child.with_webview(move |platform| {
        let result = (|| unsafe {
            let controller = platform.controller();
            controller.SetZoomFactor(zoom)?;
            let core = controller.CoreWebView2()?;
            let settings = core.Settings()?;
            settings.SetAreDevToolsEnabled(false)?;
            settings.SetAreDefaultContextMenusEnabled(false)?;
            let mut token = 0;
            core.add_PermissionRequested(&PermissionRequestedEventHandler::create(Box::new(|_, args| {
                if let Some(args) = args { args.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY)?; }
                Ok(())
            })), &mut token)?;
            core.add_NavigationCompleted(&NavigationCompletedEventHandler::create(Box::new(move |_, args| {
                let mut success = windows::core::BOOL(0);
                if let Some(args) = args { args.IsSuccess(&mut success)?; }
                publish(&app, &owner, &key, None, Some(false), None, if success.as_bool() { None } else { Some("网页加载失败，请检查网址、网络或网站限制".into()) });
                Ok(())
            })), &mut token)?;
            Ok::<(), windows::core::Error>(())
        })().map_err(|e| e.to_string());
        let _ = tx.send(result);
    }).map_err(|e| e.to_string())?;
    rx.await.map_err(|_| "网页初始化已取消")?
}

pub async fn capture(webview: Webview, key: BrowserKey) -> Result<BrowserCapture, String> {
    let session = get_session(&webview, &key)?;
    if session.loading || !session.visible { return Err("请等待网页加载并显示后再截图".into()); }
    #[cfg(not(windows))]
    { Err("浏览器截图仅支持 Windows 桌面端".into()) }
    #[cfg(windows)]
    {
        use base64::Engine;
        use webview2_com::{CapturePreviewCompletedHandler, Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG};
        use windows::Win32::{Foundation::HGLOBAL, System::Com::{StructuredStorage::CreateStreamOnHGlobal, STATSTG, STATFLAG_NONAME, STREAM_SEEK_SET}};
        let child = webview.app_handle().get_webview(&session.label).ok_or("网页已关闭")?;
        let (tx, rx) = tokio::sync::oneshot::channel();
        child.with_webview(move |platform| {
            let sender = std::sync::Arc::new(Mutex::new(Some(tx)));
            let done = sender.clone();
            let result = (|| unsafe {
                let stream = CreateStreamOnHGlobal(HGLOBAL::default(), true)?;
                let output = stream.clone();
                let callback = CapturePreviewCompletedHandler::create(Box::new(move |status| {
                    let result = (|| {
                        status?;
                        let mut stat = STATSTG::default();
                        output.Stat(&mut stat, STATFLAG_NONAME)?;
                        if stat.cbSize == 0 || stat.cbSize > 32 * 1024 * 1024 { return Err(windows::core::Error::from_hresult(windows::core::HRESULT(0x80070057u32 as i32))); }
                        output.Seek(0, STREAM_SEEK_SET, None)?;
                        let mut bytes = vec![0u8; stat.cbSize as usize];
                        let mut read = 0;
                        output.Read(bytes.as_mut_ptr().cast(), bytes.len() as u32, Some(&mut read)).ok()?;
                        bytes.truncate(read as usize);
                        Ok(bytes)
                    })().map_err(|e: windows::core::Error| e.to_string());
                    if let Some(tx) = done.lock().ok().and_then(|mut sender| sender.take()) { let _ = tx.send(result); }
                    Ok(())
                }));
                platform.controller().CoreWebView2()?.CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG, &stream, &callback)?;
                Ok::<(), windows::core::Error>(())
            })();
            if let Err(error) = result {
                if let Some(tx) = sender.lock().ok().and_then(|mut sender| sender.take()) { let _ = tx.send(Err(error.to_string())); }
            }
        }).map_err(|e| e.to_string())?;
        let bytes = tokio::time::timeout(std::time::Duration::from_secs(15), rx).await.map_err(|_| "网页截图超时，请重试")?.map_err(|_| "网页截图已取消")??;
        get_session(&webview, &key)?;
        if bytes.len() < 24 || !bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Err("截图数据无效".into()); }
        let width = u32::from_be_bytes(bytes[16..20].try_into().map_err(|_| "截图尺寸无效")?);
        let height = u32::from_be_bytes(bytes[20..24].try_into().map_err(|_| "截图尺寸无效")?);
        if width == 0 || height == 0 { return Err("截图内容为空".into()); }
        Ok(BrowserCapture { data_url: format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)), width, height })
    }
}
