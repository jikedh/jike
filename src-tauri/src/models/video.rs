use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoTrimRequest {
    #[serde(rename = "videoUrl")]
    pub video_url: String,
    pub start: f64,
    pub end: f64,
    #[serde(rename = "authToken", skip_serializing_if = "Option::is_none", default)]
    pub auth_token: Option<String>,
    #[serde(rename = "backendBaseUrl", skip_serializing_if = "Option::is_none", default)]
    pub backend_base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoTrimResult {
    pub url: String,
    pub format: String, // "mp4"
    pub duration: f64,
    pub method: String, // "cloud" | "ffmpeg"
    #[serde(rename = "jobId", skip_serializing_if = "Option::is_none", default)]
    pub job_id: Option<String>,
}
