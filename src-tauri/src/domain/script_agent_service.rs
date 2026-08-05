// 剧本Agent SQLite 存储服务 + DeepSeek API 调用
use crate::models::{MemoryEntry, ScriptMessage, SessionMeta};
use once_cell::sync::Lazy;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;

static DB_PATH: Lazy<PathBuf> = Lazy::new(|| {
    let app_data = dirs_or_default();
    let dir = app_data.join("jike-script-agent");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("script_agent.db")
});

static DB: Lazy<Mutex<Connection>> = Lazy::new(|| {
    let conn = Connection::open(DB_PATH.as_path()).expect("failed to open script_agent db");
    init_tables(&conn).expect("failed to init tables");
    Mutex::new(conn)
});

fn dirs_or_default() -> PathBuf {
    if let Some(p) = dirs_next() {
        return p;
    }
    PathBuf::from(".")
}

fn dirs_next() -> Option<PathBuf> {
    // 使用 APPDATA (Windows) 或 HOME/.local/share (Linux/Mac)
    #[cfg(windows)]
    {
        std::env::var("APPDATA").ok().map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join(".local").join("share"))
    }
}

fn init_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '新对话',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_key ON memories(category, key);
        ",
    )
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn gen_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// ── Session CRUD ──────────────────────────────────────────────

pub fn create_session(title: &str) -> Result<SessionMeta, String> {
    let db = DB.lock().map_err(|e| e.to_string())?;
    let id = gen_id();
    let now = now_ms();
    db.execute(
        "INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, title, now, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(SessionMeta {
        id,
        title: title.to_string(),
        created_at: now,
        updated_at: now,
        message_count: 0,
    })
}

pub fn list_sessions() -> Result<Vec<SessionMeta>, String> {
    let db = DB.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT s.id, s.title, s.created_at, s.updated_at, COUNT(m.id) as msg_count
             FROM sessions s LEFT JOIN messages m ON m.session_id = s.id
             GROUP BY s.id ORDER BY s.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(SessionMeta {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                message_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn delete_session(session_id: &str) -> Result<(), String> {
    let db = DB.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM messages WHERE session_id = ?1", params![session_id])
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM sessions WHERE id = ?1", params![session_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn rename_session(session_id: &str, new_title: &str) -> Result<(), String> {
    let db = DB.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_title, now_ms(), session_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Message CRUD ──────────────────────────────────────────────

pub fn add_message(session_id: &str, role: &str, content: &str) -> Result<ScriptMessage, String> {
    let db = DB.lock().map_err(|e| e.to_string())?;
    let id = gen_id();
    let now = now_ms();
    db.execute(
        "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, session_id, role, content, now],
    )
    .map_err(|e| e.to_string())?;
    // 更新会话的 updated_at
    db.execute(
        "UPDATE sessions SET updated_at = ?1 WHERE id = ?2",
        params![now, session_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(ScriptMessage {
        id,
        session_id: session_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        created_at: now,
    })
}

pub fn get_messages(session_id: &str) -> Result<Vec<ScriptMessage>, String> {
    let db = DB.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ?1 ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(ScriptMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

// ── Memory CRUD ───────────────────────────────────────────────

pub fn upsert_memory(category: &str, key: &str, value: &str) -> Result<MemoryEntry, String> {
    let db = DB.lock().map_err(|e| e.to_string())?;
    let now = now_ms();
    let id = gen_id();
    // UPSERT: 如果 (category, key) 已存在则更新 value 和 updated_at
    db.execute(
        "INSERT INTO memories (id, category, key, value, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(category, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![id, category, key, value, now, now],
    )
    .map_err(|e| e.to_string())?;
    // 查询实际写入的记录（可能是更新后的）
    let entry = db
        .query_row(
            "SELECT id, category, key, value, created_at, updated_at FROM memories WHERE category = ?1 AND key = ?2",
            params![category, key],
            |row| {
                Ok(MemoryEntry {
                    id: row.get(0)?,
                    category: row.get(1)?,
                    key: row.get(2)?,
                    value: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    Ok(entry)
}

pub fn list_memories() -> Result<Vec<MemoryEntry>, String> {
    let db = DB.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, category, key, value, created_at, updated_at FROM memories ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(MemoryEntry {
                id: row.get(0)?,
                category: row.get(1)?,
                key: row.get(2)?,
                value: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn delete_memory(memory_id: &str) -> Result<(), String> {
    let db = DB.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM memories WHERE id = ?1", params![memory_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── DeepSeek Streaming Chat ───────────────────────────────────

/// 构建带记忆上下文的系统提示词
pub fn build_system_prompt_with_memories(base_prompt: &str) -> Result<String, String> {
    let memories = list_memories()?;
    if memories.is_empty() {
        return Ok(base_prompt.to_string());
    }

    let mut sections = vec![base_prompt.to_string(), "\n\n## 用户记忆上下文".to_string()];
    for m in &memories {
        sections.push(format!("- [{}] {}: {}", m.category, m.key, m.value));
    }
    Ok(sections.join("\n"))
}

/// 从 AI 回复中提取 [MEMORY:key=value] 标签并自动保存（正则兜底）
pub fn extract_and_save_memories(content: &str) -> Vec<MemoryEntry> {
    let re_pattern = r"\[MEMORY:(\w+):([^=\]]+)=(.+?)\]";
    let re = regex_lite::Regex::new(re_pattern).unwrap();
    let mut saved = Vec::new();
    for cap in re.captures_iter(content) {
        let category = cap.get(1).map(|m| m.as_str()).unwrap_or("preference");
        let key = cap.get(2).map(|m| m.as_str()).unwrap_or("");
        let value = cap.get(3).map(|m| m.as_str()).unwrap_or("");
        if !key.is_empty() && !value.is_empty() {
            if let Ok(entry) = upsert_memory(category, key, value) {
                saved.push(entry);
            }
        }
    }
    saved
}

const MEMORY_EXTRACTION_PROMPT: &str = r#"你是一个记忆提取助手。请分析以下对话内容，从中提取值得长期记住的用户信息。

分类规则：
- preference: 用户的创作偏好（题材、风格、篇幅、语气等）
- knowledge: 用户提供的剧本相关知识或背景设定
- character: 用户描述的角色设定（姓名、性格、关系等）
- style: 用户偏好的写作风格（对白风格、叙事节奏、格式要求等）

输出格式要求（严格遵守，不要输出任何其他内容）：
每行一条记忆，格式为 [MEMORY:category:key=value]
如果没有值得记忆的信息，输出 NONE

示例输出：
[MEMORY:preference:genre=都市情感]
[MEMORY:character:protagonist=林小雨，25岁女记者，性格倔强]
[MEMORY:style:dialogue=简洁口语化，避免书面语]"#;

/// 通过独立 LLM 调用从对话中提取记忆并保存
pub async fn extract_memories_via_llm(
    api_key: &str,
    api_base: &str,
    model: &str,
    user_message: &str,
    assistant_reply: &str,
) -> Vec<MemoryEntry> {
    let client = reqwest::Client::new();
    let url = format!("{}/v1/chat/completions", api_base.trim_end_matches('/'));

    let conversation = format!(
        "用户说：{}\n\n助手回复：{}",
        user_message, assistant_reply
    );

    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": MEMORY_EXTRACTION_PROMPT },
            { "role": "user", "content": conversation }
        ],
        "stream": false,
        "temperature": 0.1
    });

    let resp = match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            log::warn!("[ScriptAgent] memory extraction request failed: {}", e);
            return Vec::new();
        }
    };

    if !resp.status().is_success() {
        log::warn!(
            "[ScriptAgent] memory extraction error: {}",
            resp.status()
        );
        return Vec::new();
    }

    let json: serde_json::Value = match resp.json().await {
        Ok(j) => j,
        Err(e) => {
            log::warn!("[ScriptAgent] memory extraction parse failed: {}", e);
            return Vec::new();
        }
    };

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim();

    if content == "NONE" || content.is_empty() {
        return Vec::new();
    }

    // 复用正则解析 LLM 返回的标签
    extract_and_save_memories(content)
}

/// 流式事件载荷
#[derive(Clone, serde::Serialize)]
pub struct StreamEvent {
    pub session_id: String,
    pub delta: String,
    pub done: bool,
    pub error: Option<String>,
}

/// 调用 DeepSeek Chat API（SSE 流式），通过 Tauri Emitter 逐 chunk 推送
pub async fn chat_completion_streaming(
    app: &tauri::AppHandle,
    session_id: &str,
    api_key: &str,
    api_base: &str,
    model: &str,
    system_prompt: &str,
    messages: &[ScriptMessage],
) -> Result<String, String> {
    use futures_util::StreamExt;
    use tauri::Emitter;

    let client = reqwest::Client::new();
    let url = format!("{}/v1/chat/completions", api_base.trim_end_matches('/'));

    let mut api_messages: Vec<serde_json::Value> = vec![serde_json::json!({
        "role": "system",
        "content": system_prompt
    })];
    for m in messages {
        api_messages.push(serde_json::json!({
            "role": m.role,
            "content": m.content
        }));
    }

    let body = serde_json::json!({
        "model": model,
        "messages": api_messages,
        "stream": true
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            let _ = app.emit(
                "script-agent-stream",
                StreamEvent {
                    session_id: session_id.to_string(),
                    delta: String::new(),
                    done: true,
                    error: Some(format!("DeepSeek request failed: {}", e)),
                },
            );
            format!("DeepSeek request failed: {}", e)
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let err_msg = format!("DeepSeek error {}: {}", status, text);
        let _ = app.emit(
            "script-agent-stream",
            StreamEvent {
                session_id: session_id.to_string(),
                delta: String::new(),
                done: true,
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    let mut stream = resp.bytes_stream();
    let mut full_content = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // SSE 格式：每行 "data: {...}\n\n"，可能有多个 data 行在一个 chunk 中
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if let Some(json_str) = line.strip_prefix("data:") {
                let json_str = json_str.trim();
                if json_str == "[DONE]" {
                    break;
                }
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_str) {
                    if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                        if !delta.is_empty() {
                            full_content.push_str(delta);
                            let _ = app.emit(
                                "script-agent-stream",
                                StreamEvent {
                                    session_id: session_id.to_string(),
                                    delta: delta.to_string(),
                                    done: false,
                                    error: None,
                                },
                            );
                        }
                    }
                }
            }
        }
    }

    // 发送完成信号
    let _ = app.emit(
        "script-agent-stream",
        StreamEvent {
            session_id: session_id.to_string(),
            delta: String::new(),
            done: true,
            error: None,
        },
    );

    // 用独立 LLM 调用提取记忆（异步后台执行，不阻塞返回）
    let user_content = messages.last().map(|m| m.content.as_str()).unwrap_or("");
    let ak = api_key.to_string();
    let ab = api_base.to_string();
    let md = model.to_string();
    let reply_clone = full_content.clone();
    let user_clone = user_content.to_string();
    tokio::spawn(async move {
        let saved = extract_memories_via_llm(&ak, &ab, &md, &user_clone, &reply_clone).await;
        if !saved.is_empty() {
            log::info!(
                "[ScriptAgent] extracted {} memories via LLM",
                saved.len()
            );
        }
    });

    Ok(full_content)
}
