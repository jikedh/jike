use serde::{Deserialize, Serialize};

/// 图片下载结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageBufferResult {
    /// PNG/JPEG 字节流
    pub data: Vec<u8>,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageBase64Result {
    pub base64: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageToFileResult {
    pub path: String,
}
