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
    #[serde(
        rename = "ffmpegPath",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub ffmpeg_path: Option<String>,
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
pub struct M3u8ToMp4Request {
    #[serde(rename = "m3u8Url")]
    pub m3u8_url: String,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub referer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub origin: Option<String>,
    #[serde(
        rename = "ffmpegPath",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub ffmpeg_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct M3u8ToMp4Result {
    pub path: String,
    pub format: String,
    pub method: String,
    #[serde(
        rename = "skippedSegments",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub skipped_segments: Option<usize>,
    #[serde(
        rename = "skippedUrls",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub skipped_urls: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mp4DownloadRequest {
    pub url: String,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub referer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub origin: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mp4DownloadResult {
    pub path: String,
    pub format: String,
    pub method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HongguoApiRequest {
    pub key: String,
    #[serde(rename = "type")]
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub keyword: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub page: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,
    #[serde(rename = "video_id", skip_serializing_if = "Option::is_none", default)]
    pub video_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HongguoPlayRequest {
    pub key: String,
    #[serde(rename = "video_id")]
    pub video_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HongguoDecryptRequest {
    pub key: String,
    pub url: String,
    #[serde(rename = "decrypt_key")]
    pub decrypt_key: String,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchVideoPageRequest {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchVideoPageResult {
    pub html: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchShot4uPlaylistRequest {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchShot4uPlaylistResult {
    #[serde(rename = "assUrl")]
    pub ass_url: String,
    #[serde(rename = "m3u8Urls")]
    pub m3u8_urls: Vec<String>,
}
