// 埋点领域服务 - 日志落地，真实上报由前端 HTTP 拦截器处理
use crate::models::{AIVideoTrackData, TrackingResult};

pub fn send(data: &AIVideoTrackData) -> TrackingResult {
    log::info!("[Tracking] send: taskId={} status={}", data.task_id, data.status);
    TrackingResult { success: true, error: None }
}

pub fn update_status(
    task_id: &str,
    status: &str,
    error_message: Option<&str>,
) -> TrackingResult {
    log::info!("[Tracking] updateStatus: taskId={} status={} error={:?}", task_id, status, error_message);
    TrackingResult { success: true, error: None }
}
