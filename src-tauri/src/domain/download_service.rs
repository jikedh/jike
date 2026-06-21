// 图片下载领域服务 - 对应原 ipc/download
use crate::models::{ImageBase64Result, ImageBufferResult, ImageToFileResult};
use base64::Engine;
use reqwest::Client;

#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
    #[error("http error: {0}")]
    Http(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

pub async fn image_as_buffer(url: &str) -> Result<ImageBufferResult, DownloadError> {
    let client = Client::new();
    let resp = client.get(url).send().await.map_err(|e| DownloadError::Http(e.to_string()))?;
    let bytes = resp.bytes().await.map_err(|e| DownloadError::Http(e.to_string()))?;
    Ok(ImageBufferResult {
        data: bytes.to_vec(),
        mime_type: "image/png".to_string(),
    })
}

pub async fn image_as_base64(url: &str) -> Result<ImageBase64Result, DownloadError> {
    let r = image_as_buffer(url).await?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&r.data);
    Ok(ImageBase64Result { base64: b64, mime_type: r.mime_type })
}

pub async fn image_to_file(url: &str, target_path: &str) -> Result<ImageToFileResult, DownloadError> {
    let r = image_as_buffer(url).await?;
    if let Some(p) = std::path::Path::new(target_path).parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(target_path, &r.data)?;
    Ok(ImageToFileResult { path: target_path.to_string() })
}
