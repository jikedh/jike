fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "browser_open",
            "browser_sync",
            "browser_close",
            "browser_go_back",
            "browser_go_forward",
            "browser_capture",
        ]),
    )).expect("failed to build Tauri application");
}
