// Tauri 命令层 - 与前端 @tauri-apps/api invoke 一一对应
// 命令通过 tauri::generate_handler! 在 lib.rs 集中注册，
// 本模块保留 register() 占位，便于将来扩展需要"按域预注册资源"的逻辑。
pub mod storage;
pub mod download;
pub mod notification;
pub mod tracking;
pub mod debug;
pub mod tray;
pub mod video;

pub use storage::*;
pub use download::*;
pub use notification::*;
pub use tracking::*;
pub use debug::*;
pub use tray::*;
pub use video::*;

// 在 lib.rs setup() 阶段可按需调用各域 register；当前各命令无启动期资源，
// 因此留空函数体。
pub fn register_all(_app: &tauri::AppHandle) {
    // no-op: 命令由 generate_handler! 集中注册
}
