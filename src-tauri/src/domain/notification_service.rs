// 系统通知领域服务
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct ShowNotificationParams {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(rename = "whenWindowFocused", default)]
    pub when_window_focused: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub const DEFAULT_TITLE: &str = "即刻";

pub fn build_notification(params: &ShowNotificationParams) -> NotificationResult {
    NotificationResult { success: true, skipped: None, error: None }
}
