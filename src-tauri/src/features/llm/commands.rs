//! Tauri commands for the LLMs on this computer.

use super::catalog::find_entry;
use super::service::{manager, LlmModelInfo};
use crate::common::settings::{get_settings, write_settings};
use tauri::AppHandle;

#[tauri::command]
#[specta::specta]
pub fn get_llm_models(app: AppHandle) -> Vec<LlmModelInfo> {
    manager(&app).models()
}

/// Downloads a model; picks it when nothing else is picked yet.
#[tauri::command]
#[specta::specta]
pub async fn download_llm_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let manager = manager(&app);
    manager
        .download(&model_id)
        .await
        .map_err(|e| e.to_string())?;
    let mut settings = get_settings(&app);
    let picked = find_entry(&settings.llm_model).is_some_and(|e| manager.is_downloaded(e));
    if !picked && find_entry(&model_id).is_some_and(|e| manager.is_downloaded(e)) {
        settings.llm_model = model_id;
        write_settings(&app, settings);
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn cancel_llm_download(app: AppHandle, model_id: String) {
    manager(&app).cancel_download(&model_id);
}

#[tauri::command]
#[specta::specta]
pub fn delete_llm_model(app: AppHandle, model_id: String) -> Result<(), String> {
    manager(&app).delete(&model_id).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn set_llm_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let entry = find_entry(&model_id).ok_or("Unknown LLM")?;
    if !manager(&app).is_downloaded(entry) {
        return Err("Download this model first".into());
    }
    let mut settings = get_settings(&app);
    settings.llm_model = model_id;
    write_settings(&app, settings);
    Ok(())
}
