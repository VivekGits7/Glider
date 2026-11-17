//! Tauri commands for Read Aloud.

use super::catalog::find_entry;
use super::service::{
    manager, raise_speak_error, restart_at, speak_on_thread, TtsManager, TtsModelInfo, SPEED_RANGE,
};
use crate::common::settings::{self, get_settings, write_settings};
use std::sync::Arc;
use tauri::{AppHandle, Manager};

#[tauri::command]
#[specta::specta]
pub fn get_tts_models(app: AppHandle) -> Vec<TtsModelInfo> {
    manager(&app).models()
}

#[tauri::command]
#[specta::specta]
pub async fn download_tts_model(app: AppHandle, model_id: String) -> Result<(), String> {
    manager(&app).download(&model_id).await
}

/// The overlay's pause button. Returns whether the read is paused now.
#[tauri::command]
#[specta::specta]
pub fn toggle_reading_pause(app: AppHandle) -> bool {
    manager(&app).toggle_pause()
}

/// The overlay's previous (-1) and next (1) buttons.
#[tauri::command]
#[specta::specta]
pub fn skip_reading(app: AppHandle, delta: i32) {
    if delta > 0 {
        manager(&app).skip_forward();
    } else {
        restart_at(&app, |index| index.saturating_sub(1));
    }
}

/// The overlay's - and + buttons: changes the speed by `delta` and reads the
/// current sentence again at it. Returns the new speed.
#[tauri::command]
#[specta::specta]
pub fn change_reading_speed(app: AppHandle, delta: f32) -> f32 {
    let mut settings = get_settings(&app);
    let speed = ((settings.tts_speed + delta) * 10.0).round() / 10.0;
    settings.tts_speed = speed.clamp(*SPEED_RANGE.start(), *SPEED_RANGE.end());
    let speed = settings.tts_speed;
    write_settings(&app, settings);
    if manager(&app).is_speaking() {
        restart_at(&app, |index| index);
    }
    speed
}

#[tauri::command]
#[specta::specta]
pub fn cancel_tts_download(app: AppHandle, model_id: String) {
    manager(&app).cancel_download(&model_id);
}

/// A short sample in a voice, for picking one.
#[tauri::command]
#[specta::specta]
pub fn speak_voice_sample(app: AppHandle, model_id: String) -> Result<(), String> {
    let entry = find_entry(&model_id).ok_or("Unknown voice model")?;
    // In the language the model reads; English where there's no line for it.
    let text = match entry.reading_language(&get_settings(&app).tts_languages) {
        "hi" => "नमस्ते! मैं आपका चुना हुआ टेक्स्ट इसी तरह पढ़कर सुनाऊँगी।",
        "es" => "¡Hola! Así sueno cuando leo tu texto en voz alta.",
        "fr" => "Bonjour ! Voici ma voix quand je lis votre texte à voix haute.",
        "de" => "Hallo! So klinge ich, wenn ich deinen Text vorlese.",
        "it" => "Ciao! Ecco come suono quando leggo il tuo testo ad alta voce.",
        "pt" => "Olá! É assim que eu soo quando leio o seu texto em voz alta.",
        "ja" => "こんにちは！テキストを読み上げるときは、こんな声です。",
        "zh" => "你好！我朗读你的文字时就是这个声音。",
        _ => "Hi! This is how I sound when I read your text aloud.",
    };
    std::thread::spawn(move || {
        let tts = app.state::<Arc<TtsManager>>();
        if let Err(e) = tts.speak_with(text, Some(entry)) {
            raise_speak_error(&app, e);
        }
    });
    Ok(())
}

/// Reads a page demo's line in the chosen voice: no overlay, no history.
#[tauri::command]
#[specta::specta]
pub fn speak_demo(app: AppHandle, text: String) -> Result<(), String> {
    let entry = find_entry(&get_settings(&app).tts_model).ok_or("No voice chosen")?;
    std::thread::spawn(move || {
        let tts = app.state::<Arc<TtsManager>>();
        if let Err(e) = tts.speak_with(&text, Some(entry)) {
            raise_speak_error(&app, e);
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn delete_tts_model(app: AppHandle, model_id: String) -> Result<(), String> {
    manager(&app).delete(&model_id)
}

#[tauri::command]
#[specta::specta]
pub fn speak_text(app: AppHandle, text: String) {
    speak_on_thread(&app, Some(text));
}

#[tauri::command]
#[specta::specta]
pub fn stop_speaking(app: AppHandle) {
    manager(&app).stop_and_close();
}

#[tauri::command]
#[specta::specta]
pub fn is_speaking(app: AppHandle) -> bool {
    manager(&app).is_speaking()
}

/// Read Aloud's live preview: the sentence being read, above the player.
#[tauri::command]
#[specta::specta]
pub fn change_tts_live_preview_setting(app: AppHandle, enabled: bool) {
    let mut settings = get_settings(&app);
    settings.tts_live_preview = enabled;
    write_settings(&app, settings);
}

/// The language a voice model reads in. Only one the model reads is kept.
#[tauri::command]
#[specta::specta]
pub fn change_tts_language_setting(
    app: AppHandle,
    model_id: String,
    language: String,
) -> Result<(), String> {
    let entry = find_entry(&model_id).ok_or("Unknown voice model")?;
    if !entry.languages.contains(&language.as_str()) {
        return Err(format!("{} doesn't read {language}", entry.name));
    }
    let mut settings = get_settings(&app);
    settings.tts_languages.insert(model_id, language);
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_tts_model_setting(app: AppHandle, model_id: String) -> Result<(), String> {
    let entry = find_entry(&model_id).ok_or("Unknown voice model")?;
    let mut settings = settings::get_settings(&app);
    settings.tts_model = entry.id.to_string();
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_tts_voice_setting(app: AppHandle, voice: i32) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    let voices = find_entry(&settings.tts_model).map_or(1, |e| e.voices.len() as i32);
    if !(0..voices).contains(&voice) {
        return Err("Unknown voice".into());
    }
    settings.tts_voice = voice;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_tts_speed_setting(app: AppHandle, speed: f32) -> Result<(), String> {
    if !SPEED_RANGE.contains(&speed) {
        return Err("Speed must be between 0.5x and 3x".into());
    }
    let mut settings = settings::get_settings(&app);
    settings.tts_speed = speed;
    write_settings(&app, settings);
    Ok(())
}
