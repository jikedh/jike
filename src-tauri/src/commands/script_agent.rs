// script_agent:* 命令注册 - 薄壳转发到 domain::script_agent_service

use crate::domain::script_agent_service as svc;

#[tauri::command]
pub async fn script_agent_create_session(title: String) -> Result<serde_json::Value, String> {
    let meta = svc::create_session(&title)?;
    serde_json::to_value(meta).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn script_agent_list_sessions() -> Result<serde_json::Value, String> {
    let list = svc::list_sessions()?;
    serde_json::to_value(list).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn script_agent_delete_session(session_id: String) -> Result<(), String> {
    svc::delete_session(&session_id)
}

#[tauri::command]
pub async fn script_agent_rename_session(
    session_id: String,
    new_title: String,
) -> Result<(), String> {
    svc::rename_session(&session_id, &new_title)
}

#[tauri::command]
pub async fn script_agent_get_messages(session_id: String) -> Result<serde_json::Value, String> {
    let msgs = svc::get_messages(&session_id)?;
    serde_json::to_value(msgs).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn script_agent_send_message(
    app: tauri::AppHandle,
    session_id: String,
    content: String,
    api_key: String,
    api_base: String,
    model: String,
    system_prompt: String,
    web_search_enabled: bool,
) -> Result<serde_json::Value, String> {
    // 保存用户消息
    let user_msg = svc::add_message(&session_id, "user", &content)?;
    // 获取历史消息用于上下文
    let history = svc::get_messages(&session_id)?;
    // 构建带记忆的系统提示词
    let enriched_prompt = svc::build_system_prompt_with_memories(&system_prompt)?;
    // 流式调用 DeepSeek（通过 Tauri 事件推送 chunk）
    let reply = svc::chat_completion_streaming(
        &app,
        &session_id,
        &api_key,
        &api_base,
        &model,
        &enriched_prompt,
        &history,
        web_search_enabled,
    )
    .await?;
    // 流结束后保存完整 AI 回复到 SQLite
    let assistant_msg = svc::add_message(&session_id, "assistant", &reply)?;
    serde_json::to_value(serde_json::json!({
        "userMessage": user_msg,
        "assistantMessageId": assistant_msg.id
    }))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn script_agent_list_memories() -> Result<serde_json::Value, String> {
    let list = svc::list_memories()?;
    serde_json::to_value(list).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn script_agent_upsert_memory(
    category: String,
    key: String,
    value: String,
) -> Result<serde_json::Value, String> {
    let entry = svc::upsert_memory(&category, &key, &value)?;
    serde_json::to_value(entry).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn script_agent_delete_memory(memory_id: String) -> Result<(), String> {
    svc::delete_memory(&memory_id)
}
