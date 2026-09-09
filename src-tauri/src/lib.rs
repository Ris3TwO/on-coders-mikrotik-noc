//! Application core module and Tauri runtime entry point.
//!
//! Registers IPC command handlers, manages application state lifecycle,
//! and initializes background services for MikroTik monitoring.

pub mod commands;
pub mod config;
pub mod mikrotik_api;
pub mod models;
pub mod state;

use state::AppState;
use tauri_plugin_store::Builder as StoreBuilder;
use tauri_plugin_updater::Builder as UpdaterBuilder;

/// Main entry point for the Tauri application runtime.
///
/// Sets up the default app state manager, registers IPC commands accessible
/// from the frontend, and initializes the desktop/mobile application context.
///
/// # Panics
///
/// Panics if Tauri fails to build or initialize its application context.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(StoreBuilder::default().build())
        .plugin(UpdaterBuilder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::connect_device,
            commands::disconnect_device,
            commands::test_mikrotik_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tests default AppState initialization to ensure safe startup state.
    #[test]
    fn test_app_state_default_initialization() {
        let state = AppState::default();
        let handle_guard = state.poller_handle.lock().unwrap();
        assert!(
            handle_guard.is_none(),
            "Poller handle must be None on application startup"
        );
    }

    /// Verifies that essential application modules are correctly exported.
    #[test]
    fn test_module_exports_presence() {
        // Ensures modules and types are reachable across module boundaries
        let _config = config::AppConfig::default();
        let _status = models::DeviceStatus::default();
        assert_eq!(_config.default_timeout_secs, 3);
    }
}
