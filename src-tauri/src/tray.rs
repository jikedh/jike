use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager,
};

const SHOW_MENU_ID: &str = "show_jike";
const QUIT_MENU_ID: &str = "quit_jike";

#[derive(Clone)]
pub struct AppLifecycle {
    is_exiting: Arc<AtomicBool>,
}

impl AppLifecycle {
    pub fn new() -> Self {
        Self {
            is_exiting: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn begin_exit(&self) {
        self.is_exiting.store(true, Ordering::SeqCst);
    }

    pub fn is_exiting(&self) -> bool {
        self.is_exiting.load(Ordering::SeqCst)
    }
}

pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, SHOW_MENU_ID, "显示 即刻", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, QUIT_MENU_ID, "关闭 即刻", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("application window icon is required for tray");

    TrayIconBuilder::with_id("main-tray")
        .tooltip("即刻")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            SHOW_MENU_ID => show_main_window(app),
            QUIT_MENU_ID => quit_app(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(&tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn quit_app(app: &AppHandle) {
    app.state::<AppLifecycle>().begin_exit();

    for (_, window) in app.webview_windows() {
        let _ = window.close();
    }

    app.exit(0);
}
