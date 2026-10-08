use crate::models::browser::{BrowserKey, BrowserLayout};
use url::Url;

pub fn validate_url(value: &str, app_origin: &Url) -> Result<Url, String> {
    if value.len() > 8192 { return Err("网址过长".into()); }
    let url = Url::parse(value).map_err(|_| "网址格式不正确")?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none()
        || !url.username().is_empty() || url.password().is_some() {
        return Err("仅支持不含登录凭据的 HTTP / HTTPS 网址".into());
    }
    let host = url.host_str().unwrap_or_default();
    if matches!(host, "localhost" | "tauri.localhost" | "asset.localhost" | "ipc.localhost" | "127.0.0.1" | "::1")
        || url.origin() == app_origin.origin() {
        return Err("不允许浏览应用内部页面".into());
    }
    Ok(url)
}

pub fn validate_key(key: &BrowserKey) -> Result<(), String> {
    if [&key.project_id, &key.node_id, &key.session_id].iter().any(|s| s.is_empty() || s.len() > 256 || s.chars().any(char::is_control)) {
        return Err("浏览器节点标识无效".into());
    }
    Ok(())
}

pub fn same_key(a: &BrowserKey, b: &BrowserKey) -> bool {
    a.project_id == b.project_id && a.node_id == b.node_id && a.session_id == b.session_id
}

pub fn validate_layout(layout: &BrowserLayout) -> Result<(), String> {
    validate_key(&layout.key)?;
    let b = layout.bounds;
    if [b.x, b.y, b.width, b.height, layout.zoom].iter().any(|v| !v.is_finite())
        || b.x < 0.0 || b.y < 0.0 || b.x > 32768.0 || b.y > 32768.0
        || !(1.0..=8192.0).contains(&b.width) || !(1.0..=8192.0).contains(&b.height)
        || !(0.25..=5.0).contains(&layout.zoom) {
        return Err("浏览器显示区域无效，请调整画布缩放或节点尺寸".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn browser_url_policy() {
        let origin = Url::parse("http://localhost:3004").unwrap();
        for value in ["javascript:alert(1)", "file:///C:/secret", "data:text/html,test", "https://u:p@example.com", "http://localhost:3004/other", "http://127.0.0.1:3004/other", "http://tauri.localhost", "http://asset.localhost"] {
            assert!(validate_url(value, &origin).is_err(), "{value}");
        }
        assert!(validate_url("https://example.com/path", &origin).is_ok());
        assert!(validate_url("http://example.com", &origin).is_ok());
    }
    #[test]
    fn rejects_invalid_bounds_and_stale_sessions() {
        let key = BrowserKey { project_id: "p".into(), node_id: "browser-1".into(), session_id: "1".into() };
        let mut layout = BrowserLayout { key: key.clone(), bounds: crate::models::browser::BrowserBounds { x: 0.0, y: 0.0, width: 800.0, height: 400.0 }, zoom: 1.0, visible: true };
        assert!(validate_layout(&layout).is_ok());
        layout.bounds.width = f64::NAN;
        assert!(validate_layout(&layout).is_err());
        let mut other = key.clone(); other.session_id = "2".into();
        assert!(!same_key(&key, &other));
    }
}
