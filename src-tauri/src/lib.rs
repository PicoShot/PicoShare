use tauri::Window;

#[tauri::command]
fn close_window(window: Window) {
    window.close().unwrap();
}

#[tauri::command]
fn minimize_window(window: Window) {
    window.minimize().unwrap();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![close_window, minimize_window,])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
