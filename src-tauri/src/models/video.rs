use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoTrimRequest {
    #[serde(rename = "videoUrl")]
    pub video_url: String,
    pub start: f64,
    pub end: f64,
    #[serde(rename = "authToken", skip_serializing_if = "Option::is_none", default)]
    pub auth_token: Option<String>,
    #[serde(
        rename = "backendBaseUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFrameCaptureRequest {
    #[serde(rename = "videoUrl")]
    pub video_url: String,
    pub time: f64,
    pub mode: String,
    #[serde(
        rename = "authToken",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub auth_token: Option<String>,
    #[serde(
        rename = "backendBaseUrl",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub backend_base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFrameCaptureResult {
    pub url: String,
    pub format: String,
    pub method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitMp4Request {
    #[serde(rename = "inputPath")]
    pub input_path: String,
    #[serde(rename = "outputDir", skip_serializing_if = "Option::is_none", default)]
    pub output_dir: Option<String>,
    #[serde(
        rename = "segmentSeconds",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub segment_seconds: Option<f64>,
    #[serde(
        rename = "ffmpegPath",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub ffmpeg_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitMp4Result {
    #[serde(rename = "outputDir")]
    pub output_dir: String,
    #[serde(rename = "clipCount")]
    pub clip_count: usize,
    pub clips: Vec<String>,
    #[serde(rename = "segmentSeconds")]
    pub segment_seconds: f64,
    pub method: String,
}
