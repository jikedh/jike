fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "browser_open", "browser_sync", "browser_close", "browser_capture",
        ]),
    )).expect("failed to build Tauri application");
}
