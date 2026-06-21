use serde::{Deserialize, Serialize};

/// 与前端 StorageApi 完全对等的领域模型。

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectMeta {
    pub name: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "updatedAt")]
    pub updated_at: u64,
    #[serde(rename = "coverUrl", skip_serializing_if = "Option::is_none", default)]
    pub cover_url: Option<String>,
    #[serde(rename = "coverLocalPath", skip_serializing_if = "Option::is_none", default)]
    pub cover_local_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectIndex {
    pub version: u32,
    pub projects: std::collections::BTreeMap<String, ProjectMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    #[serde(rename = "mediaType")]
    pub media_type: String,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    pub size: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetDiskFileInfo {
    #[serde(rename = "projectName")]
    pub project_name: String,
    #[serde(rename = "categoryName")]
    pub category_name: String,
    pub name: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub size: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetDiskProjectInfo {
    pub name: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StorageResult<T = ()> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(flatten)]
    pub data: T,
}

impl<T: Default> StorageResult<T> {
    pub fn ok() -> Self {
        Self { success: true, error: None, data: T::default() }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        Self { success: false, error: Some(msg.into()), data: T::default() }
    }
}
