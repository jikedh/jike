use serde::{Deserialize, Serialize};

/// AI 视频生成埋点数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIVideoTrackData {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "userUuid", skip_serializing_if = "Option::is_none", default)]
    pub user_uuid: Option<String>,
    #[serde(rename = "apiName")]
    pub api_name: String,
    pub model: String,
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration: Option<f64>,
    #[serde(
        rename = "referenceImageUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub reference_image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub provider: Option<String>,
    #[serde(
        rename = "requestParams",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub request_params: Option<serde_json::Value>,
    #[serde(
        rename = "generatedVideoUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub generated_video_url: Option<String>,
    pub status: String, // SUCCESS | FAIL | PENDING
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TrackingResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
