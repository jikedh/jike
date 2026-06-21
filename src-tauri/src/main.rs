// 阻止额外的控制台窗口在 Windows 发布构建中弹出
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    jike_lib::run();
}
