// 托盘领域服务 - 业务规则与 Tauri 托盘 API 解耦
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayMenuItem {
    pub id: String,
    pub label: String,
    pub visible: bool,
}

pub fn build_default_menu(visible: bool) -> Vec<TrayMenuItem> {
    vec![
        TrayMenuItem { id: "show".into(), label: "显示主窗口".into(), visible: !visible },
        TrayMenuItem { id: "hide".into(), label: "隐藏主窗口".into(), visible: visible },
        TrayMenuItem { id: "quit".into(), label: "退出应用".into(), visible: true },
    ]
}
