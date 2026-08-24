use reqwest::{header, multipart, Body, Client, Url};
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::time::Duration;
use tokio_util::io::ReaderStream;
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum OssCopyError {
    #[error("invalid media url")]
    InvalidUrl,
    #[error("unsupported media url protocol")]
    UnsupportedProtocol,
    #[error("unsafe media url host")]
    UnsafeHost,
    #[error("download media failed: {0}")]
    Download(String),
    #[error("upload media failed: {0}")]
    Upload(String),
    #[error("upload response missing url")]
    MissingUrl,
    #[error("invalid local file")]
    InvalidLocalFile,
    #[error("local file is too large")]
    FileTooLarge,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFileInfo {
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Deserialize)]
struct UploadEnvelope {
    code: Option<u16>,
    msg: Option<String>,
    data: Option<UploadData>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UploadData {
    url: Option<String>,
}

pub async fn copy_video_url_to_oss(
    video_url: &str,
    upload_api_url: &str,
    auth_token: Option<String>,
) -> Result<String, OssCopyError> {
    copy_media_url_to_oss(video_url, upload_api_url, auth_token).await
}

pub async fn copy_media_url_to_oss(
    media_url: &str,
    upload_api_url: &str,
    auth_token: Option<String>,
) -> Result<String, OssCopyError> {
    let source_url = validate_remote_media_url(media_url)?;
    let upload_url = validate_upload_api_url(upload_api_url)?;

    let client = Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(600))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| OssCopyError::Download(e.to_string()))?;

    let response = client
        .get(source_url.clone())
        .send()
        .await
        .map_err(|e| OssCopyError::Download(e.to_string()))?;

    if !response.status().is_success() {
        return Err(OssCopyError::Download(format!(
            "http status {}",
            response.status()
        )));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("video/mp4")
        .split(';')
        .next()
        .unwrap_or("video/mp4")
        .trim()
        .to_string();
    let file_name = build_media_file_name(&source_url, &content_type);

    let stream = response.bytes_stream();
    let part = multipart::Part::stream(Body::wrap_stream(stream))
        .file_name(file_name)
        .mime_str(&content_type)
        .map_err(|e| OssCopyError::Upload(e.to_string()))?;
    let form = multipart::Form::new().part("file", part);

    let mut request = client.post(upload_url).multipart(form);
    if let Some(token) = auth_token.filter(|token| !token.trim().is_empty()) {
        request = request.bearer_auth(token);
    }

    let upload_response = request
        .send()
        .await
        .map_err(|e| OssCopyError::Upload(e.to_string()))?;
    let status = upload_response.status();
    let body = upload_response
        .text()
        .await
        .map_err(|e| OssCopyError::Upload(e.to_string()))?;

    if !status.is_success() {
        return Err(OssCopyError::Upload(format!(
            "http status {status}: {body}"
        )));
    }

    let envelope: UploadEnvelope = serde_json::from_str(&body)
        .map_err(|e| OssCopyError::Upload(format!("invalid response: {e}")))?;
    if let Some(code) = envelope.code {
        if code >= 400 {
            return Err(OssCopyError::Upload(
                envelope
                    .msg
                    .unwrap_or_else(|| format!("server code {code}")),
            ));
        }
    }

    envelope
        .data
        .and_then(|data| data.url)
        .or(envelope.url)
        .filter(|url| !url.is_empty())
        .ok_or(OssCopyError::MissingUrl)
}

/// 读取本地文件元信息，不将文件内容经 IPC 传给 WebView。
pub async fn get_local_file_info(path: &str) -> Result<LocalFileInfo, OssCopyError> {
    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|_| OssCopyError::InvalidLocalFile)?;
    if !metadata.is_file() {
        return Err(OssCopyError::InvalidLocalFile);
    }

    let name = std::path::Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .ok_or(OssCopyError::InvalidLocalFile)?
        .to_string();

    Ok(LocalFileInfo {
        name,
        size: metadata.len(),
    })
}

/// 将本地文件作为 HTTP 流上传至由服务端签发的 OSS PUT URL。
/// 文件数据始终保留在 Rust 流中，避免大文件占用 WebView 内存。
pub async fn upload_local_file_to_signed_url(
    path: &str,
    put_url: &str,
    headers: std::collections::HashMap<String, String>,
    max_size: u64,
) -> Result<LocalFileInfo, OssCopyError> {
    let file_info = get_local_file_info(path).await?;
    if file_info.size > max_size {
        return Err(OssCopyError::FileTooLarge);
    }

    let upload_url = validate_signed_oss_url(put_url)?;
    let file = tokio::fs::File::open(path)
        .await
        .map_err(|_| OssCopyError::InvalidLocalFile)?;
    let stream = ReaderStream::new(file);
    let body = Body::wrap_stream(stream);
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(600))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| OssCopyError::Upload(error.to_string()))?;

    let mut request = client.put(upload_url).header(header::CONTENT_LENGTH, file_info.size);
    for (name, value) in headers {
        let normalized = name.to_ascii_lowercase();
        if normalized == "content-type" || normalized.starts_with("x-oss-") {
            let header_name = header::HeaderName::from_bytes(normalized.as_bytes())
                .map_err(|_| OssCopyError::Upload("invalid upload header".to_string()))?;
            let header_value = header::HeaderValue::from_str(&value)
                .map_err(|_| OssCopyError::Upload("invalid upload header".to_string()))?;
            request = request.header(header_name, header_value);
        }
    }

    let response = request
        .body(body)
        .send()
        .await
        .map_err(|error| OssCopyError::Upload(error.to_string()))?;
    if !response.status().is_success() {
        return Err(OssCopyError::Upload(format!(
            "http status {}",
            response.status()
        )));
    }

    Ok(file_info)
}

pub(crate) fn validate_remote_media_url(media_url: &str) -> Result<Url, OssCopyError> {
    let url = Url::parse(media_url).map_err(|_| OssCopyError::InvalidUrl)?;
    if url.scheme() != "https" {
        return Err(OssCopyError::UnsupportedProtocol);
    }
    validate_safe_host(&url)?;
    Ok(url)
}

fn validate_upload_api_url(upload_api_url: &str) -> Result<Url, OssCopyError> {
    let url = Url::parse(upload_api_url).map_err(|_| OssCopyError::InvalidUrl)?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        _ => Err(OssCopyError::UnsupportedProtocol),
    }
}

fn validate_signed_oss_url(put_url: &str) -> Result<Url, OssCopyError> {
    let url = Url::parse(put_url).map_err(|_| OssCopyError::InvalidUrl)?;
    if url.scheme() != "https" {
        return Err(OssCopyError::UnsupportedProtocol);
    }
    let host = url.host_str().ok_or(OssCopyError::UnsafeHost)?;
    let normalized = host.trim_end_matches('.').to_ascii_lowercase();
    if normalized != "aliyuncs.com" && !normalized.ends_with(".aliyuncs.com") {
        return Err(OssCopyError::UnsafeHost);
    }
    Ok(url)
}

fn validate_safe_host(url: &Url) -> Result<(), OssCopyError> {
    let host = url.host_str().ok_or(OssCopyError::UnsafeHost)?;
    let normalized = host.trim_end_matches('.').to_ascii_lowercase();
    if normalized == "localhost" || normalized.ends_with(".localhost") {
        return Err(OssCopyError::UnsafeHost);
    }

    if let Ok(ip) = normalized.parse::<IpAddr>() {
        if is_unsafe_ip(ip) {
            return Err(OssCopyError::UnsafeHost);
        }
    }

    Ok(())
}

fn is_unsafe_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_broadcast()
                || ip.is_documentation()
                || ip.octets()[0] == 0
        }
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip.segments()[0] & 0xfe00 == 0xfc00
                || ip.segments()[0] & 0xffc0 == 0xfe80
        }
    }
}

fn build_media_file_name(source_url: &Url, content_type: &str) -> String {
    let ext = source_url
        .path_segments()
        .and_then(|mut segments| segments.next_back())
        .and_then(|name| name.rsplit_once('.').map(|(_, ext)| ext.to_string()))
        .filter(|ext| !ext.is_empty())
        .unwrap_or_else(|| default_media_ext(content_type).to_string());

    format!("copied-media-{}.{}", Uuid::new_v4(), ext)
}

fn default_media_ext(content_type: &str) -> &'static str {
    match content_type {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "video/webm" => "webm",
        "video/quicktime" => "mov",
        "video/x-msvideo" => "avi",
        _ => "mp4",
    }
}
