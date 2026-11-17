use crate::common::settings::{get_settings, write_settings, ModelUnloadTimeout};
use crate::features::stt::language::detection::LanguageStatus;
use crate::features::stt::models::ModelManager;
use crate::features::stt::transcription::TranscriptionManager;
use serde::Serialize;
use specta::Type;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[derive(Serialize, Type)]
pub struct ModelLoadStatus {
    is_loaded: bool,
    current_model: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn set_model_unload_timeout(app: AppHandle, timeout: ModelUnloadTimeout) {
    let mut settings = get_settings(&app);
    settings.model_unload_timeout = timeout;
    write_settings(&app, settings);
}

/// The language transcription on `model_id` will use, for the picker.
#[tauri::command]
#[specta::specta]
pub fn get_language_status(
    app: AppHandle,
    model_manager: State<Arc<ModelManager>>,
    model_id: String,
) -> LanguageStatus {
    let settings = get_settings(&app);
    crate::features::stt::language::detection::status_for(
        &settings,
        model_manager.get_model_info(&model_id).as_ref(),
        model_manager.language_detector_path().is_some(),
    )
}

#[tauri::command]
#[specta::specta]
pub fn get_model_load_status(
    transcription_manager: State<Arc<TranscriptionManager>>,
) -> Result<ModelLoadStatus, String> {
    Ok(ModelLoadStatus {
        is_loaded: transcription_manager.is_model_loaded(),
        current_model: transcription_manager.get_current_model(),
    })
}

/// Starts loading the chosen speech model, for the launch screen; true when
/// a load began (false: already loaded, loading, or none chosen).
#[tauri::command]
#[specta::specta]
pub fn preload_model(transcription_manager: State<Arc<TranscriptionManager>>) -> bool {
    transcription_manager.initiate_model_load(false)
}
