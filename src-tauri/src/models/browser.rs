use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserKey {
    pub project_id: String,
    pub node_id: String,
    pub session_id: String,
}

#[derive(Clone, Copy, Debug, Deserialize)]
pub struct BrowserBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserLayout {
    pub key: BrowserKey,
    pub bounds: BrowserBounds,
    pub zoom: f64,
    pub visible: bool,
}

#[derive(Debug, Deserialize)]
pub struct BrowserOpen {
    pub layout: BrowserLayout,
    pub url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserEvent {
    pub project_id: String,
    pub node_id: String,
    pub session_id: String,
    pub url: String,
    pub loading: bool,
    pub title: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserCapture {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}
