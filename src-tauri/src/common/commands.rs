use crate::common::settings::{
    get_settings, update_checks_forced_disabled, write_settings, AppSettings, LogLevel,
};
use crate::common::utils::cancel_current_operation;
use crate::common::worker_kit::memory::process_memory;
use crate::features::llm::service::LlmManager;
use crate::features::stt::transcription::TranscriptionManager;
use crate::features::stt::worker::model_worker_pid;
use crate::features::tts::service::TtsManager;
use serde::Serialize;
use specta::Type;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
#[specta::specta]
pub fn cancel_operation(app: AppHandle) {
    cancel_current_operation(&app);
}

#[tauri::command]
#[specta::specta]
pub fn is_portable() -> bool {
    crate::common::system::portable::is_portable()
}

#[tauri::command]
#[specta::specta]
pub fn is_update_checks_locked() -> bool {
    update_checks_forced_disabled()
}

#[tauri::command]
#[specta::specta]
pub fn get_app_dir_path(app: AppHandle) -> Result<String, String> {
    let app_data_dir = crate::common::system::portable::app_data_dir(&app)
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    Ok(app_data_dir.to_string_lossy().to_string())
}

#[tauri::command]
#[specta::specta]
pub fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    Ok(get_settings(&app))
}

#[tauri::command]
#[specta::specta]
pub fn get_default_settings() -> Result<AppSettings, String> {
    Ok(crate::common::settings::get_default_settings())
}

#[tauri::command]
#[specta::specta]
pub fn get_log_dir_path(app: AppHandle) -> Result<String, String> {
    let log_dir = crate::common::system::portable::app_log_dir(&app)
        .map_err(|e| format!("Failed to get log directory: {}", e))?;

    Ok(log_dir.to_string_lossy().to_string())
}

#[specta::specta]
#[tauri::command]
pub fn set_log_level(app: AppHandle, level: LogLevel) -> Result<(), String> {
    let tauri_log_level: tauri_plugin_log::LogLevel = level.into();
    let log_level: log::Level = tauri_log_level.into();
    // Update the file log level atomic so the filter picks up the new level
    crate::FILE_LOG_LEVEL.store(
        log_level.to_level_filter() as u8,
        std::sync::atomic::Ordering::Relaxed,
    );

    let mut settings = get_settings(&app);
    settings.log_level = level;
    write_settings(&app, settings);

    Ok(())
}

#[specta::specta]
#[tauri::command]
pub fn open_recordings_folder(app: AppHandle) -> Result<(), String> {
    let app_data_dir = crate::common::system::portable::app_data_dir(&app)
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let recordings_dir = app_data_dir.join("recordings");

    let path = recordings_dir.to_string_lossy().as_ref().to_string();
    app.opener()
        .open_path(path, None::<String>)
        .map_err(|e| format!("Failed to open recordings folder: {}", e))?;

    Ok(())
}

#[specta::specta]
#[tauri::command]
pub fn open_log_dir(app: AppHandle) -> Result<(), String> {
    let log_dir = crate::common::system::portable::app_log_dir(&app)
        .map_err(|e| format!("Failed to get log directory: {}", e))?;

    let path = log_dir.to_string_lossy().as_ref().to_string();
    app.opener()
        .open_path(path, None::<String>)
        .map_err(|e| format!("Failed to open log directory: {}", e))?;

    Ok(())
}

#[specta::specta]
#[tauri::command]
pub fn open_app_data_dir(app: AppHandle) -> Result<(), String> {
    let app_data_dir = crate::common::system::portable::app_data_dir(&app)
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let path = app_data_dir.to_string_lossy().as_ref().to_string();
    app.opener()
        .open_path(path, None::<String>)
        .map_err(|e| format!("Failed to open app data directory: {}", e))?;

    Ok(())
}

/// Opens the folder a kind of model downloads into, in Finder or Explorer.
#[specta::specta]
#[tauri::command]
pub fn open_models_dir(
    app: AppHandle,
    folder: crate::common::models_dir::ModelFolder,
) -> Result<(), String> {
    let dir = folder
        .path(&app)
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    // Its manager makes it at startup; make it here too in case that failed.
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create {}: {e}", dir.display()))?;
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<String>)
        .map_err(|e| format!("Failed to open models folder: {}", e))
}

/// Check if Apple Intelligence is available on this device.
/// Called by the frontend when the user selects Apple Intelligence provider.
#[specta::specta]
#[tauri::command]
pub fn check_apple_intelligence_available() -> bool {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        crate::features::llm::apple::check_apple_intelligence_availability()
    }
    #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
    {
        false
    }
}

/// The overlay's ✓ on a hands-free recording: stop and paste it.
#[specta::specta]
#[tauri::command]
pub fn finish_recording(app: AppHandle) {
    if let Some(coordinator) = app.try_state::<crate::TranscriptionCoordinator>() {
        coordinator.finish();
    }
}

/// The "nowhere to type" card's Copy.
#[specta::specta]
#[tauri::command]
pub fn copy_nowhere_text(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(crate::common::overlay::nowhere_text())
        .map_err(|e| e.to_string())
}

/// Clears Glider's Accessibility entry before asking again. An ad-hoc signed
/// build is trusted by its exact hash, so after an update the old entry stays
/// switched on in System Settings but no longer matches this build; asking
/// then adds nothing and the user can't tell why it fails. Only called while
/// this build isn't trusted, so nothing that works is removed.
#[specta::specta]
#[tauri::command]
pub fn reset_accessibility_permission(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("tccutil")
            .args(["reset", "Accessibility", &app.config().identifier])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(format!("tccutil exited with {status}"));
        }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = app;
    Ok(())
}

/// Try to initialize Enigo (keyboard/mouse simulation).
/// On macOS, this will return an error if accessibility permissions are not granted.
#[specta::specta]
#[tauri::command]
pub fn initialize_enigo(app: AppHandle) -> Result<(), String> {
    use crate::features::stt::output::input::EnigoState;

    // Check if already initialized
    if app.try_state::<EnigoState>().is_some() {
        log::debug!("Enigo already initialized");
        return Ok(());
    }

    // Try to initialize
    match EnigoState::new() {
        Ok(enigo_state) => {
            app.manage(enigo_state);
            log::info!("Enigo initialized successfully after permission grant");
            Ok(())
        }
        Err(e) => {
            if cfg!(target_os = "macos") {
                log::warn!(
                    "Failed to initialize Enigo: {} (accessibility permissions may not be granted)",
                    e
                );
            } else {
                log::warn!("Failed to initialize Enigo: {}", e);
            }
            Err(format!("Failed to initialize input system: {}", e))
        }
    }
}

/// Marker state to track if shortcuts have been initialized.
pub struct ShortcutsInitialized;

/// Initialize keyboard shortcuts.
/// On macOS, this should be called after accessibility permissions are granted.
/// This is idempotent - calling it multiple times is safe.
#[specta::specta]
#[tauri::command]
pub fn initialize_shortcuts(app: AppHandle) -> Result<(), String> {
    // Check if already initialized
    if app.try_state::<ShortcutsInitialized>().is_some() {
        log::debug!("Shortcuts already initialized");
        return Ok(());
    }

    // Initialize shortcuts
    crate::common::shortcut::init_shortcuts(&app);

    // Mark as initialized before reconciling the macOS Secure Input fallback.
    app.manage(ShortcutsInitialized);
    crate::common::shortcut::secure_input::reconcile_fallback(&app);

    log::info!("Shortcuts initialized successfully");
    Ok(())
}

/// Mark onboarding as finished; called when its last screen closes, so quitting
/// midway resumes the flow.
#[specta::specta]
#[tauri::command]
pub fn complete_onboarding(app: AppHandle) -> Result<(), String> {
    let mut settings = crate::common::settings::get_settings(&app);
    settings.onboarding_completed = true;
    crate::common::settings::write_settings(&app, settings);
    Ok(())
}

/// The user's first name for Home's greeting: the macOS account's full name,
/// else the login name. `None` when neither is known.
#[tauri::command]
#[specta::specta]
pub fn get_user_name() -> Option<String> {
    #[cfg(target_os = "macos")]
    let full_name = std::process::Command::new("id")
        .arg("-F")
        .output()
        .ok()
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string());
    #[cfg(not(target_os = "macos"))]
    let full_name: Option<String> = None;
    let name = full_name
        .filter(|name| !name.is_empty())
        .or_else(|| std::env::var("USER").ok())
        .or_else(|| std::env::var("USERNAME").ok())?;
    name.split_whitespace().next().map(str::to_string)
}

/// A loaded model and the memory its worker process is using right now.
#[derive(Serialize, Type)]
pub struct WorkerMemory {
    pub model_id: String,
    pub bytes: u64,
}

/// Each model kind's loaded model and live memory; `None` when nothing is
/// loaded (never used yet, unloaded after idling, or deleted).
#[derive(Serialize, Type)]
pub struct ModelMemory {
    pub stt: Option<WorkerMemory>,
    pub tts: Option<WorkerMemory>,
    pub llm: Option<WorkerMemory>,
}

/// Live memory of every model worker, for the Models page.
#[tauri::command]
#[specta::specta]
pub fn get_model_memory(app: AppHandle) -> ModelMemory {
    let measure = |loaded: Option<(String, u32)>| {
        let (model_id, pid) = loaded?;
        Some(WorkerMemory {
            model_id,
            bytes: process_memory(pid)?,
        })
    };
    let stt = app
        .try_state::<Arc<TranscriptionManager>>()
        .and_then(|manager| manager.get_current_model())
        .zip(model_worker_pid());
    let tts = app
        .try_state::<Arc<TtsManager>>()
        .and_then(|manager| manager.loaded_worker())
        .map(|(id, pid)| (id.to_string(), pid));
    let llm = app
        .try_state::<Arc<LlmManager>>()
        .and_then(|manager| manager.loaded_worker())
        .map(|(id, pid)| (id.to_string(), pid));
    ModelMemory {
        stt: measure(stt),
        tts: measure(tts),
        llm: measure(llm),
    }
}
