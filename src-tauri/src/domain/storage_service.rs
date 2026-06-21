// 存储领域服务 - 对应原 Electron ipc/storage
// 保留原项目的 canvas.json / project.json / index.json 索引格式
// 项目结构：
//   basePath/
//     index.json
//     <projectName>/
//       project.json
//       canvas.json
//       image/ generate_image/ video/ generate_video/ audio/

use crate::models::{
    AssetDiskFileInfo, AssetDiskProjectInfo, FileInfo, ProjectIndex, ProjectMeta, StorageResult,
};
use serde_json::Value;
use std::path::{Path, PathBuf};

const CANVAS_FILE: &str = "canvas.json";
const PROJECT_META_FILE: &str = "project.json";
const INDEX_FILE: &str = "index.json";

const MEDIA_FOLDERS: &[&str] = &[
    "image",
    "generate_image",
    "video",
    "generate_video",
    "audio",
];

const ASSET_CACHE_DIR: &str = ".jike-assets-cache";
const INTERNAL_ASSET_DIR: &str = "assets";
const SUPPORTED_ASSET_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov", "mp3", "wav", "m4a", "aac", "ogg",
];

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid path: {0}")]
    InvalidPath(String),
}

fn get_extension(name: &str) -> String {
    match name.rfind('.') {
        Some(i) => name[i..].to_lowercase(),
        None => String::new(),
    }
}

fn normalize_rel(p: &str) -> String {
    p.replace('\\', "/").trim_start_matches('/').to_string()
}

fn safe_rel(p: &str) -> Option<String> {
    let n = normalize_rel(p);
    if n.is_empty() || n.split('/').any(|seg| seg == "..") {
        return None;
    }
    Some(n)
}

fn read_json<T: serde::de::DeserializeOwned + Default>(path: &Path) -> Option<T> {
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_json<T: serde::Serialize>(path: &Path, data: &T) -> Result<(), StorageError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(data).map_err(|e| StorageError::InvalidPath(e.to_string()))?;
    std::fs::write(path, raw)?;
    Ok(())
}

fn read_index(base: &Path) -> ProjectIndex {
    let p = base.join(INDEX_FILE);
    read_json(&p).unwrap_or(ProjectIndex { version: 1, projects: Default::default() })
}

fn write_index(base: &Path, idx: &ProjectIndex) -> Result<(), StorageError> {
    write_json(&base.join(INDEX_FILE), idx)
}

fn touch_updated_at(base: &Path, project: &str) -> Result<(), StorageError> {
    let mut idx = read_index(base);
    if let Some(meta) = idx.projects.get_mut(project) {
        meta.updated_at = now_ms();
        write_index(base, &idx)?;
    } else {
        ensure_project(base, project)?;
    }
    Ok(())
}

fn ensure_project(base: &Path, project: &str) -> Result<ProjectMeta, StorageError> {
    let mut idx = read_index(base);
    let now = now_ms();
    let meta = match idx.projects.get(project) {
        Some(m) => ProjectMeta { updated_at: now, ..m.clone() },
        None => ProjectMeta {
            name: project.to_string(),
            created_at: now,
            updated_at: now,
            cover_url: None,
            cover_local_path: None,
        },
    };
    idx.projects.insert(project.to_string(), meta.clone());
    write_index(base, &idx)?;

    let dir = base.join(project);
    std::fs::create_dir_all(&dir)?;
    for f in MEDIA_FOLDERS {
        std::fs::create_dir_all(dir.join(f))?;
    }
    let _ = write_json(&dir.join(PROJECT_META_FILE), &meta);
    Ok(meta)
}

fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn path_to_buf(p: &str) -> PathBuf {
    PathBuf::from(p)
}

pub fn ensure_project_handler(base: &str, project: &str) -> Result<StorageResult<serde_json::Value>, StorageError> {
    if base.is_empty() || project.is_empty() {
        return Ok(StorageResult::err("Missing basePath or projectName"));
    }
    let base_path = path_to_buf(base);
    if !base_path.exists() {
        std::fs::create_dir_all(&base_path)?;
    }
    let meta = ensure_project(&base_path, project)?;
    let mut r = StorageResult::ok();
    r.data = serde_json::json!({ "project": meta });
    Ok(r)
}

pub fn list_projects_handler(base: &str) -> Result<StorageResult<serde_json::Value>, StorageError> {
    if base.is_empty() || !path_to_buf(base).exists() {
        return Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "projects": [] }) });
    }
    let base_path = path_to_buf(base);
    let mut idx = read_index(&base_path);
    let mut disk_only: Vec<ProjectMeta> = Vec::new();
    let mut changed = false;

    // 清理索引中不存在的目录
    let existing: Vec<String> = idx.projects.keys().cloned().collect();
    for k in existing {
        if !base_path.join(&k).exists() {
            idx.projects.remove(&k);
            changed = true;
        }
    }

    if let Ok(entries) = std::fs::read_dir(&base_path) {
        for e in entries.flatten() {
            if !e.file_type().map(|t| t.is_dir()).unwrap_or(false) { continue; }
            let name = e.file_name().to_string_lossy().to_string();
            let dir = e.path();
            let meta_path = dir.join(PROJECT_META_FILE);
            let canvas_path = dir.join(CANVAS_FILE);
            if !meta_path.exists() && !canvas_path.exists() { continue; }
            let meta_disk = read_json::<ProjectMeta>(&meta_path);
            let canvas = read_json::<Value>(&canvas_path);

            if !idx.projects.contains_key(&name) {
                let p = ProjectMeta {
                    name: name.clone(),
                    created_at: meta_disk.as_ref().map(|m| m.created_at).unwrap_or_else(|| {
                        canvas.as_ref().and_then(|c| c.get("savedAt").and_then(|v| v.as_u64())).unwrap_or_else(now_ms)
                    }),
                    updated_at: meta_disk.as_ref().map(|m| m.updated_at).unwrap_or_else(|| {
                        canvas.as_ref().and_then(|c| c.get("savedAt").and_then(|v| v.as_u64())).unwrap_or_else(now_ms)
                    }),
                    cover_url: meta_disk.as_ref().and_then(|m| m.cover_url.clone())
                        .or_else(|| canvas.as_ref().and_then(|c| c.get("coverUrl").and_then(|v| v.as_str()).map(String::from))),
                    cover_local_path: meta_disk.as_ref().and_then(|m| m.cover_local_path.clone())
                        .or_else(|| canvas.as_ref().and_then(|c| c.get("coverLocalPath").and_then(|v| v.as_str()).map(String::from))),
                };
                disk_only.push(p.clone());
                idx.projects.insert(name.clone(), p);
                changed = true;
            } else if let Some(existing) = idx.projects.get_mut(&name) {
                let cu = canvas.as_ref().and_then(|c| c.get("coverUrl").and_then(|v| v.as_str()).map(String::from));
                let cl = canvas.as_ref().and_then(|c| c.get("coverLocalPath").and_then(|v| v.as_str()).map(String::from));
                if existing.cover_url.is_none() && cu.is_some() { existing.cover_url = cu; changed = true; }
                if existing.cover_local_path.is_none() && cl.is_some() { existing.cover_local_path = cl; changed = true; }
            }
        }
    }

    if changed {
        write_index(&base_path, &idx)?;
    }

    let mut all: Vec<ProjectMeta> = idx.projects.values().cloned().collect();
    all.extend(disk_only);
    all.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    all.dedup_by(|a, b| a.name == b.name);

    let r = StorageResult {
        success: true,
        error: None,
        data: serde_json::json!({ "projects": all }),
    };
    Ok(r)
}

pub fn save_canvas_handler(
    base: &str,
    project: &str,
    data: Value,
) -> Result<StorageResult, StorageError> {
    if base.is_empty() || project.is_empty() {
        return Ok(StorageResult::err("Missing basePath or projectName"));
    }
    let base_path = path_to_buf(base);
    let canvas_path = base_path.join(project).join(CANVAS_FILE);
    let meta_path = base_path.join(project).join(PROJECT_META_FILE);
    write_json(&canvas_path, &data)?;

    let cover_url = data.get("coverUrl").and_then(|v| v.as_str()).map(String::from);
    let cover_local = data.get("coverLocalPath").and_then(|v| v.as_str()).map(String::from);

    let _ = touch_updated_at(&base_path, project);
    let mut idx = read_index(&base_path);
    if let Some(m) = idx.projects.get_mut(project) {
        if cover_url.is_some() { m.cover_url = cover_url.clone(); }
        if cover_local.is_some() { m.cover_local_path = cover_local.clone(); }
        m.updated_at = now_ms();
        write_index(&base_path, &idx)?;
    }
    if let Some(mut meta) = read_json::<ProjectMeta>(&meta_path) {
        if cover_url.is_some() { meta.cover_url = cover_url; }
        if cover_local.is_some() { meta.cover_local_path = cover_local; }
        meta.updated_at = now_ms();
        let _ = write_json(&meta_path, &meta);
    }
    Ok(StorageResult::ok())
}

pub fn load_canvas_handler(
    base: &str,
    project: &str,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    if base.is_empty() || project.is_empty() {
        return Ok(StorageResult { success: false, error: Some("Missing basePath or projectName".into()), data: serde_json::json!({ "data": Value::Null }) });
    }
    let canvas_path = path_to_buf(base).join(project).join(CANVAS_FILE);
    match read_json::<Value>(&canvas_path) {
        Some(v) => Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "data": v }) }),
        None => Ok(StorageResult { success: false, error: Some("Canvas not found".into()), data: serde_json::json!({ "data": Value::Null }) }),
    }
}

pub fn save_media_handler(
    base: &str,
    rel: &str,
    bytes: Vec<u8>,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    let rel = match safe_rel(rel) {
        Some(r) => r,
        None => return Ok(StorageResult::err("Invalid basePath or relativePath")),
    };
    let parts: Vec<&str> = rel.split('/').filter(|s| !s.is_empty()).collect();
    let project = parts.first().copied().unwrap_or("");
    if base.is_empty() || project.is_empty() || parts.len() < 2 {
        return Ok(StorageResult::err("Invalid basePath or relativePath"));
    }
    let base_path = path_to_buf(base);
    let _ = ensure_project(&base_path, project);
    let abs = base_path.join(&rel);
    if let Some(p) = abs.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(&abs, &bytes)?;
    let _ = touch_updated_at(&base_path, project);
    Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "path": rel }) })
}

pub fn read_media_handler(
    base: &str,
    rel: &str,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    let rel = match safe_rel(rel) {
        Some(r) => r,
        None => return Ok(StorageResult { success: false, error: Some("Invalid path".into()), data: serde_json::json!({ "data": Value::Null }) }),
    };
    let abs = path_to_buf(base).join(&rel);
    if !abs.exists() {
        return Ok(StorageResult { success: false, error: Some("Media not found".into()), data: serde_json::json!({ "data": Value::Null }) });
    }
    let bytes = std::fs::read(&abs)?;
    Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "data": bytes }) })
}

pub fn write_raw_file_handler(
    base: &str,
    rel: &str,
    bytes: Vec<u8>,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    let rel = match safe_rel(rel) {
        Some(r) => r,
        None => return Ok(StorageResult::err("Invalid basePath or relativePath")),
    };
    if base.is_empty() {
        return Ok(StorageResult::err("Invalid basePath or relativePath"));
    }
    let abs = path_to_buf(base).join(&rel);
    if let Some(p) = abs.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(&abs, &bytes)?;
    Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "path": rel }) })
}

pub fn read_raw_file_handler(
    base: &str,
    rel: &str,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    let rel = match safe_rel(rel) {
        Some(r) => r,
        None => return Ok(StorageResult { success: false, error: Some("Invalid path".into()), data: serde_json::json!({ "data": Value::Null }) }),
    };
    let abs = path_to_buf(base).join(&rel);
    if !abs.exists() {
        return Ok(StorageResult { success: false, error: Some("File not found".into()), data: serde_json::json!({ "data": Value::Null }) });
    }
    let bytes = std::fs::read(&abs)?;
    Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "data": bytes }) })
}

pub fn scan_asset_library_handler(
    base: &str,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    if base.is_empty() || !path_to_buf(base).exists() {
        return Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "projects": [], "files": [] }) });
    }
    let base_path = path_to_buf(base);
    let mut projects: Vec<AssetDiskProjectInfo> = Vec::new();
    let mut files: Vec<AssetDiskFileInfo> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&base_path) {
        for e in entries.flatten() {
            if !e.file_type().map(|t| t.is_dir()).unwrap_or(false) { continue; }
            let name = e.file_name().to_string_lossy().to_string();
            if name == ASSET_CACHE_DIR || name == INTERNAL_ASSET_DIR || name.starts_with('.') { continue; }
            let project_dir = e.path();
            let stat = e.metadata().ok();
            let (created, modified) = stat
                .map(|s| (s.created().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_millis() as u64)).unwrap_or(0),
                          s.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_millis() as u64)).unwrap_or(0)))
                .unwrap_or((0, 0));
            projects.push(AssetDiskProjectInfo {
                name: name.clone(),
                relative_path: name.clone(),
                created_at: created,
                modified_at: modified,
            });
            if let Ok(cats) = std::fs::read_dir(&project_dir) {
                for c in cats.flatten() {
                    if !c.file_type().map(|t| t.is_dir()).unwrap_or(false) { continue; }
                    if c.file_name().to_string_lossy().starts_with('.') { continue; }
                    let category = c.file_name().to_string_lossy().to_string();
                    if let Ok(items) = std::fs::read_dir(c.path()) {
                        for it in items.flatten() {
                            if !it.file_type().map(|t| t.is_file()).unwrap_or(false) { continue; }
                            let file_name = it.file_name().to_string_lossy().to_string();
                            let ext = get_extension(&file_name);
                            let ext_trim = ext.trim_start_matches('.');
                            if !SUPPORTED_ASSET_EXTS.contains(&ext_trim) { continue; }
                            let stat = it.metadata().ok();
                            let m = stat.as_ref().and_then(|s| s.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_millis() as u64)).unwrap_or(0);
                            let size = stat.as_ref().map(|s| s.len()).unwrap_or(0);
                            files.push(AssetDiskFileInfo {
                                project_name: name.clone(),
                                category_name: category.clone(),
                                name: file_name.clone(),
                                relative_path: format!("{}/{}/{}", name, category, file_name),
                                size,
                                modified_at: m,
                            });
                        }
                    }
                }
            }
        }
    }

    files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    projects.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(StorageResult {
        success: true,
        error: None,
        data: serde_json::json!({ "projects": projects, "files": files }),
    })
}

pub fn delete_raw_path_handler(base: &str, rel: &str) -> Result<StorageResult, StorageError> {
    let rel = match safe_rel(rel) {
        Some(r) => r,
        None => return Ok(StorageResult::err("Invalid basePath or relativePath")),
    };
    if base.is_empty() {
        return Ok(StorageResult::err("Invalid basePath or relativePath"));
    }
    let abs = path_to_buf(base).join(&rel);
    if abs.exists() {
        if abs.is_dir() {
            std::fs::remove_dir_all(&abs).ok();
        } else {
            std::fs::remove_file(&abs).ok();
        }
    }
    Ok(StorageResult::ok())
}

pub fn rename_raw_path_handler(
    base: &str,
    old_rel: &str,
    new_rel: &str,
) -> Result<StorageResult, StorageError> {
    let o = match safe_rel(old_rel) { Some(r) => r, None => return Ok(StorageResult::err("Invalid path")) };
    let n = match safe_rel(new_rel) { Some(r) => r, None => return Ok(StorageResult::err("Invalid path")) };
    if base.is_empty() {
        return Ok(StorageResult::err("Invalid basePath"));
    }
    let old = path_to_buf(base).join(&o);
    let new = path_to_buf(base).join(&n);
    if !old.exists() { return Ok(StorageResult::err("Source path not found")); }
    if new.exists() { return Ok(StorageResult::err("Target path already exists")); }
    if let Some(p) = new.parent() { std::fs::create_dir_all(p).ok(); }
    std::fs::rename(&old, &new)?;
    Ok(StorageResult::ok())
}

pub fn list_media_handler(
    base: &str,
    project: &str,
    media_type: &str,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    if base.is_empty() || project.is_empty() || media_type.is_empty() {
        return Ok(StorageResult { success: false, error: Some("Missing params".into()), data: serde_json::json!({ "files": [] }) });
    }
    let dir = path_to_buf(base).join(project).join(media_type);
    if !dir.exists() {
        return Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "files": [] }) });
    }
    let mut files: Vec<FileInfo> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for e in entries.flatten() {
            if !e.file_type().map(|t| t.is_file()).unwrap_or(false) { continue; }
            let name = e.file_name().to_string_lossy().to_string();
            let m = e.metadata().ok();
            let modified = m.as_ref().and_then(|s| s.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_millis() as u64)).unwrap_or(0);
            let size = m.as_ref().map(|s| s.len()).unwrap_or(0);
            files.push(FileInfo {
                name: name.clone(),
                path: format!("{}/{}/{}", project, media_type, name),
                relative_path: format!("{}/{}/{}", project, media_type, name),
                media_type: media_type.to_string(),
                is_directory: false,
                size,
                modified_at: modified,
            });
        }
    }
    files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "files": files }) })
}

pub fn delete_media_handler(base: &str, rel: &str) -> Result<StorageResult, StorageError> {
    let rel = match safe_rel(rel) { Some(r) => r, None => return Ok(StorageResult::err("Invalid path")) };
    let parts: Vec<&str> = rel.split('/').filter(|s| !s.is_empty()).collect();
    let project = parts.first().copied().unwrap_or("");
    if base.is_empty() || project.is_empty() {
        return Ok(StorageResult::err("Invalid basePath or relativePath"));
    }
    let abs = path_to_buf(base).join(&rel);
    if abs.exists() { let _ = std::fs::remove_file(&abs); }
    let _ = touch_updated_at(&path_to_buf(base), project);
    Ok(StorageResult::ok())
}

pub async fn download_media_handler(
    base: &str,
    url: &str,
    rel: &str,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    let rel = match safe_rel(rel) { Some(r) => r, None => return Ok(StorageResult::err("Invalid path")) };
    let parts: Vec<&str> = rel.split('/').filter(|s| !s.is_empty()).collect();
    let project = parts.first().copied().unwrap_or("");
    if base.is_empty() || project.is_empty() || parts.len() < 2 {
        return Ok(StorageResult::err("Invalid basePath or relativePath"));
    }
    let base_path = path_to_buf(base);
    let _ = ensure_project(&base_path, project);
    let bytes = reqwest::get(url).await.map_err(|e| StorageError::InvalidPath(e.to_string()))?
        .bytes().await.map_err(|e| StorageError::InvalidPath(e.to_string()))?;
    let abs = base_path.join(&rel);
    if let Some(p) = abs.parent() { std::fs::create_dir_all(p)?; }
    std::fs::write(&abs, &bytes)?;
    let _ = touch_updated_at(&base_path, project);
    Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "path": rel }) })
}

pub fn write_bytes_to_path(path: &str, bytes: &[u8]) -> Result<StorageResult<serde_json::Value>, StorageError> {
    if let Some(p) = Path::new(path).parent() { std::fs::create_dir_all(p)?; }
    std::fs::write(path, bytes)?;
    Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "path": path }) })
}

pub fn media_exists_handler(base: &str, rel: &str) -> bool {
    let rel = match safe_rel(rel) { Some(r) => r, None => return false };
    if base.is_empty() { return false; }
    path_to_buf(base).join(&rel).exists()
}

pub fn rename_project_handler(
    base: &str,
    old: &str,
    new: &str,
) -> Result<StorageResult, StorageError> {
    if base.is_empty() || old.is_empty() || new.is_empty() {
        return Ok(StorageResult::err("Missing params"));
    }
    if old == new { return Ok(StorageResult::ok()); }
    let base_path = path_to_buf(base);
    let mut idx = read_index(&base_path);
    if !idx.projects.contains_key(old) { return Ok(StorageResult::err("Source project does not exist")); }
    if idx.projects.contains_key(new) { return Ok(StorageResult::err("Target project already exists")); }
    let old_dir = base_path.join(old);
    let new_dir = base_path.join(new);
    if !old_dir.exists() { return Ok(StorageResult::err("Source project directory not found")); }
    std::fs::rename(&old_dir, &new_dir)?;
    if let Some(mut meta) = idx.projects.remove(old) {
        meta.name = new.to_string();
        meta.updated_at = now_ms();
        idx.projects.insert(new.to_string(), meta);
        write_index(&base_path, &idx)?;
    }
    Ok(StorageResult::ok())
}

pub fn delete_project_handler(base: &str, project: &str) -> Result<StorageResult, StorageError> {
    if base.is_empty() || project.is_empty() {
        return Ok(StorageResult::err("Missing params"));
    }
    let base_path = path_to_buf(base);
    let dir = base_path.join(project);
    if dir.exists() { let _ = std::fs::remove_dir_all(&dir); }
    let mut idx = read_index(&base_path);
    idx.projects.remove(project);
    write_index(&base_path, &idx)?;
    Ok(StorageResult::ok())
}

pub fn copy_project_handler(
    base: &str,
    src: &str,
    dest: &str,
) -> Result<StorageResult, StorageError> {
    if base.is_empty() || src.is_empty() || dest.is_empty() {
        return Ok(StorageResult::err("Missing params"));
    }
    let base_path = path_to_buf(base);
    let src_dir = base_path.join(src);
    let dest_dir = base_path.join(dest);
    if !src_dir.exists() { return Ok(StorageResult::err("Source project not found")); }
    if dest_dir.exists() { return Ok(StorageResult::err("Target project already exists")); }
    copy_dir_recursive(&src_dir, &dest_dir)?;
    let _ = ensure_project(&base_path, dest);
    Ok(StorageResult::ok())
}

pub fn export_project_handler(
    base: &str,
    project: &str,
    export_base: &str,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    if base.is_empty() || project.is_empty() || export_base.is_empty() {
        return Ok(StorageResult { success: false, error: Some("Missing params".into()), data: serde_json::json!({}) });
    }
    let src = path_to_buf(base).join(project);
    if !src.exists() { return Ok(StorageResult { success: false, error: Some("Project directory not found".into()), data: serde_json::json!({}) }); }
    let export_base = path_to_buf(export_base);
    std::fs::create_dir_all(&export_base)?;
    let dest_name = unique_dir_name(&export_base, project);
    let dest = export_base.join(&dest_name);
    copy_dir_recursive(&src, &dest)?;
    Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "path": dest.to_string_lossy(), "projectName": dest_name }) })
}

pub fn import_project_handler(
    base: &str,
    src_dir: &str,
) -> Result<StorageResult<serde_json::Value>, StorageError> {
    if base.is_empty() || src_dir.is_empty() {
        return Ok(StorageResult { success: false, error: Some("Missing params".into()), data: serde_json::json!({}) });
    }
    let base_path = path_to_buf(base);
    if !base_path.exists() { std::fs::create_dir_all(&base_path)?; }
    let src = path_to_buf(src_dir);
    if !src.exists() { return Ok(StorageResult { success: false, error: Some("Source not found".into()), data: serde_json::json!({}) }); }
    let src_name = src.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "imported".into());
    let meta_path = src.join(PROJECT_META_FILE);
    let canvas_path = src.join(CANVAS_FILE);
    if !meta_path.exists() && !canvas_path.exists() {
        return Ok(StorageResult { success: false, error: Some("Invalid project directory".into()), data: serde_json::json!({}) });
    }
    let dest_name = unique_dir_name(&base_path, &src_name);
    let dest = base_path.join(&dest_name);
    copy_dir_recursive(&src, &dest)?;
    let _ = ensure_project(&base_path, &dest_name);
    Ok(StorageResult { success: true, error: None, data: serde_json::json!({ "projectName": dest_name, "path": dest.to_string_lossy() }) })
}

pub fn get_default_path_handler(documents_dir: &str) -> String {
    let p = Path::new(documents_dir).join("jike-projects");
    p.to_string_lossy().to_string()
}

// 工具
fn unique_dir_name(base: &Path, preferred: &str) -> String {
    let normalized = preferred.trim();
    let normalized = if normalized.is_empty() { "export" } else { normalized };
    if !base.join(normalized).exists() { return normalized.to_string(); }
    let mut counter = 1u32;
    loop {
        let candidate = format!("{}-{}", normalized, counter);
        if !base.join(&candidate).exists() { return candidate; }
        counter += 1;
    }
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dest)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let from = entry.path();
        let to = dest.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if file_type.is_file() {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}
