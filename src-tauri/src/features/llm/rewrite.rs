//! Rewrite: the Refine shortcuts that rewrite the selected text in any app
//! with the LLM, the overlay that shows the work and what changed, and the
//! commands behind the Rewrite page.

use crate::common::notices::{self, Notice, NoticeCode, NoticeSource};
use crate::common::overlay;
use crate::common::settings::{
    self, builtin_rewrite, get_settings, refine_binding, write_settings, AppSettings, LLMPrompt,
    BUILTIN_REWRITE_IDS, REFINE_SLOTS, WRITING_SAMPLE_MAX_WORDS,
};
use crate::features::history::service::{word_count, HistoryManager};
use crate::features::insights::service::{Activity, RefineRecord};
use crate::features::llm::service::{LlmManager, LLM_SYSTEM};
use crate::features::stt::actions::{
    run_post_process, strip_invisible_chars, strip_think_block, PostProcessOutcome,
};
use crate::features::stt::recorder::AudioRecordingManager;
use log::{error, info, warn};
use serde::Serialize;
use specta::Type;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

/// What the overlay shows of the last rewrite, and what Refine again and
/// Compare work from.
#[derive(Clone, Debug, Serialize, Type)]
pub struct RefineChanges {
    /// The rewrite's row in refine history.
    pub id: i64,
    pub prompt_id: String,
    pub prompt_name: String,
    /// The model's name as the user knows it ("Qwen3 4B").
    pub model: String,
    pub before: String,
    pub after: String,
}

#[derive(Clone, Serialize)]
struct RefineStatus {
    words: usize,
    prompt: String,
}

#[derive(Clone, Serialize)]
struct RefineProgress {
    /// 0 to 1, or below 0 when the LLM can't tell how far along it is.
    fraction: f32,
}

static LAST_REFINE: Mutex<Option<RefineChanges>> = Mutex::new(None);
/// One rewrite at a time: a second press while one runs is ignored.
static REFINING: AtomicBool = AtomicBool::new(false);

struct RefiningGuard;

impl RefiningGuard {
    fn acquire() -> Option<Self> {
        (!REFINING.swap(true, Ordering::SeqCst)).then_some(Self)
    }
}

impl Drop for RefiningGuard {
    fn drop(&mut self) {
        REFINING.store(false, Ordering::SeqCst);
    }
}

fn last_refine() -> std::sync::MutexGuard<'static, Option<RefineChanges>> {
    LAST_REFINE.lock().unwrap_or_else(PoisonError::into_inner)
}

pub enum RewriteError {
    /// Rewrite runs on this computer, but no LLM is downloaded.
    NoModel,
    Failed(String),
}

/// The name of whatever will run the rewrite.
pub fn model_name(app: &AppHandle, settings: &AppSettings) -> String {
    if settings.llm_use_provider {
        let provider = settings.active_post_process_provider();
        let model = provider
            .and_then(|p| settings.post_process_models.get(&p.id))
            .cloned()
            .unwrap_or_default();
        if model.trim().is_empty() {
            provider.map(|p| p.label.clone()).unwrap_or_default()
        } else {
            model
        }
    } else {
        app.state::<Arc<LlmManager>>()
            .active_entry()
            .map(|e| e.short_name.to_string())
            .unwrap_or_default()
    }
}

/// Takes the LLM's answer down to the text: no reasoning, invisible
/// characters, or the tags the prompt wrapped the text in.
fn clean_answer(answer: &str) -> String {
    let answer = strip_invisible_chars(strip_think_block(answer));
    let mut answer = answer.trim();
    if let Some(inner) = answer
        .strip_prefix("<text>")
        .and_then(|a| a.strip_suffix("</text>"))
    {
        answer = inner.trim();
    }
    // Markdown's two-space line breaks mean nothing where the text is pasted.
    answer
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
}

/// Rewrites `text` with `template` (which holds `${output}`), on the LLM or
/// the provider. `on_progress` hears how far along it is and returns `false`
/// to stop the local LLM. Blocks.
pub fn rewrite_blocking(
    app: &AppHandle,
    settings: &AppSettings,
    text: &str,
    template: &str,
    creative: bool,
    mut on_progress: impl FnMut(f32) -> bool,
) -> Result<String, RewriteError> {
    let answer = if settings.llm_use_provider {
        on_progress(-1.0);
        match tauri::async_runtime::block_on(run_post_process(settings, text, template)) {
            PostProcessOutcome::Done(answer) => answer,
            _ => return Err(RewriteError::Failed("the provider gave no answer".into())),
        }
    } else {
        let manager = app.state::<Arc<LlmManager>>();
        if manager.active_entry().is_none() {
            return Err(RewriteError::NoModel);
        }
        let user = template.replace("${output}", text);
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        manager
            .generate(LLM_SYSTEM, &user, text, creative, |progress| {
                if last_emit.elapsed() >= Duration::from_millis(80) {
                    last_emit = Instant::now();
                    return on_progress(
                        (progress.generated as f32 / progress.expected as f32).min(0.95),
                    );
                }
                true
            })
            .map_err(|e| RewriteError::Failed(format!("{e:#}")))?
    };
    let answer = clean_answer(&answer);
    if answer.is_empty() {
        return Err(RewriteError::Failed("the answer was empty".into()));
    }
    Ok(answer)
}

/// The rewrite on `refine_<slot>`, if that shortcut has one.
fn slot_prompt(settings: &AppSettings, slot: usize) -> Option<LLMPrompt> {
    settings::refine_prompt(settings, slot)
}

/// A Refine shortcut: rewrite the selection in place.
pub fn refine_selection(app: &AppHandle, slot: usize) {
    let Some(_guard) = RefiningGuard::acquire() else {
        info!("Refine is already running; ignoring refine_{slot}");
        return;
    };
    let fail = |code| notices::raise(app, Notice::new(code, NoticeSource::ReadAloud));
    // Dictation owns the overlay and the keyboard while it runs.
    if app.state::<Arc<AudioRecordingManager>>().is_recording() {
        return;
    }
    let settings = get_settings(app);
    let Some(prompt) = slot_prompt(&settings, slot) else {
        info!("refine_{slot} has no rewrite");
        return;
    };
    if !settings.llm_use_provider && app.state::<Arc<LlmManager>>().active_entry().is_none() {
        return fail(NoticeCode::NoLlmModel);
    }
    let app_name = crate::common::utils::frontmost_app_name();
    let text = match crate::features::stt::output::clipboard::selected_text(app) {
        Ok(Some(text)) if !text.trim().is_empty() => text,
        Ok(_) => return fail(NoticeCode::NoTextSelected),
        Err(e) => {
            error!("Refine could not read the selection: {}", e);
            return fail(NoticeCode::RefineFailed);
        }
    };

    let Some(after) = run_with_overlay(app, &settings, &prompt, &text, false) else {
        return;
    };
    match crate::features::stt::output::clipboard::paste(after.clone(), app.clone()) {
        Ok(()) => notices::clear(app, NoticeSource::ReadAloud),
        Err(e) => {
            error!("Refine could not paste: {}", e);
            return fail(NoticeCode::PasteFailed);
        }
    }

    let mut changes = RefineChanges {
        id: 0,
        prompt_id: prompt.id.clone(),
        prompt_name: prompt.name.clone(),
        model: model_name(app, &settings),
        before: text.clone(),
        after,
    };
    if let Some(history) = app.try_state::<Arc<HistoryManager>>() {
        let record = RefineRecord {
            id: 0,
            prompt_id: changes.prompt_id.clone(),
            prompt_name: changes.prompt_name.clone(),
            model: changes.model.clone(),
            before: changes.before.clone(),
            after: changes.after.clone(),
        };
        match history.save_refine(&record, app_name.as_deref()) {
            Ok(id) => changes.id = id,
            Err(e) => warn!("Failed to save the rewrite to history: {e}"),
        }
        history.record_activity(Activity::Rewrite {
            words: word_count(&text),
            prompt_id: &prompt.id,
            app_name: app_name.as_deref(),
        });
    }
    show_done(app, changes);
}

/// Shows the Refining pill, runs the rewrite, and on failure raises the
/// notice that replaces the pill.
fn run_with_overlay(
    app: &AppHandle,
    settings: &AppSettings,
    prompt: &LLMPrompt,
    text: &str,
    creative: bool,
) -> Option<String> {
    overlay::emit_refine_event(
        app,
        "refine-status",
        RefineStatus {
            words: text.split_whitespace().count(),
            prompt: prompt.name.clone(),
        },
    );
    overlay::emit_refine_event(app, "refine-progress", RefineProgress { fraction: 0.0 });
    overlay::show_refine_overlay(app, overlay::REFINING_STATE);

    let template = settings::rewrite_template(prompt);
    let result = rewrite_blocking(app, settings, text, &template, creative, |fraction| {
        overlay::emit_refine_event(app, "refine-progress", RefineProgress { fraction });
        true
    });
    match result {
        Ok(after) => Some(after),
        Err(RewriteError::NoModel) => {
            notices::raise(
                app,
                Notice::new(NoticeCode::NoLlmModel, NoticeSource::ReadAloud),
            );
            None
        }
        Err(RewriteError::Failed(e)) => {
            error!("Refine failed: {e}");
            notices::raise(
                app,
                Notice::new(NoticeCode::RefineFailed, NoticeSource::ReadAloud).with_detail(e),
            );
            None
        }
    }
}

/// Remembers the rewrite and shows the Done pill.
fn show_done(app: &AppHandle, changes: RefineChanges) {
    overlay::emit_refine_event(app, "refine-changes", changes.clone());
    *last_refine() = Some(changes);
    overlay::emit_refine_event(app, "refine-progress", RefineProgress { fraction: 1.0 });
    overlay::show_refine_overlay(app, overlay::REFINED_STATE);
}

/// Shows the last rewrite's changes card (See changes, and the Compare
/// shortcut). Returns whether there was one to show.
pub fn show_last_changes(app: &AppHandle) -> bool {
    let Some(changes) = last_refine().clone() else {
        return false;
    };
    overlay::emit_refine_event(app, "refine-changes", changes);
    overlay::show_refine_overlay(app, overlay::REFINE_CHANGES_STATE);
    true
}

/// Undoes the last paste and pastes a fresh try in its place.
fn refine_again(app: &AppHandle) {
    let Some(_guard) = RefiningGuard::acquire() else {
        return;
    };
    let Some(previous) = last_refine().clone() else {
        return;
    };
    let settings = get_settings(app);
    let prompt = settings
        .post_process_prompts
        .iter()
        .find(|p| p.id == previous.prompt_id)
        .cloned()
        .or_else(|| builtin_rewrite(&previous.prompt_id));
    let Some(prompt) = prompt else {
        warn!("Refine again: rewrite {} is gone", previous.prompt_id);
        return;
    };
    let Some(after) = run_with_overlay(app, &settings, &prompt, &previous.before, true) else {
        return;
    };
    // The app still holds the last try; undo it so the paste replaces the
    // original text, which undo leaves selected.
    if let Err(e) = crate::features::stt::output::clipboard::send_undo(app) {
        error!("Refine again could not undo: {e}");
    }
    std::thread::sleep(Duration::from_millis(120));
    if let Err(e) = crate::features::stt::output::clipboard::paste(after.clone(), app.clone()) {
        error!("Refine again could not paste: {e}");
        notices::raise(
            app,
            Notice::new(NoticeCode::PasteFailed, NoticeSource::ReadAloud),
        );
        return;
    }
    if let Some(history) = app.try_state::<Arc<HistoryManager>>() {
        if let Err(e) = history.update_refine_result(previous.id, &after) {
            warn!("Failed to update the rewrite in history: {e}");
        }
    }
    show_done(
        app,
        RefineChanges {
            after,
            model: model_name(app, &settings),
            ..previous
        },
    );
}

// ----------------------------------------------------------------------------
// Overlay commands
// ----------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub fn show_refine_changes(app: AppHandle) -> bool {
    show_last_changes(&app)
}

#[tauri::command]
#[specta::specta]
pub fn hide_refine_overlay(app: AppHandle) {
    overlay::hide_recording_overlay(&app);
}

#[tauri::command]
#[specta::specta]
pub fn copy_refine_result(app: AppHandle) -> Result<(), String> {
    let after = last_refine()
        .as_ref()
        .map(|c| c.after.clone())
        .ok_or("Nothing to copy")?;
    crate::features::stt::output::clipboard::copy_text(&app, &after)
}

#[tauri::command]
#[specta::specta]
pub fn refine_again_command(app: AppHandle) {
    std::thread::spawn(move || refine_again(&app));
}

// ----------------------------------------------------------------------------
// Rewrite page commands
// ----------------------------------------------------------------------------

/// How many times each rewrite has run, by id.
#[tauri::command]
#[specta::specta]
pub fn get_rewrite_usage(app: AppHandle) -> HashMap<String, i64> {
    app.try_state::<Arc<HistoryManager>>()
        .and_then(|h| h.rewrite_usage().ok())
        .unwrap_or_default()
}

/// Rewrites `text` with a rewrite, for the page's examples. Errors with
/// `"no_model"` when there's no LLM to run it on.
#[tauri::command]
#[specta::specta]
pub async fn run_rewrite(
    app: AppHandle,
    prompt_id: String,
    text: String,
) -> Result<String, String> {
    let settings = get_settings(&app);
    let prompt = settings
        .post_process_prompts
        .iter()
        .find(|p| p.id == prompt_id)
        .cloned()
        .ok_or("Unknown rewrite")?;
    tauri::async_runtime::spawn_blocking(move || {
        let template = settings::rewrite_template(&prompt);
        rewrite_blocking(&app, &settings, &text, &template, false, |_| true).map_err(|e| match e {
            RewriteError::NoModel => "no_model".to_string(),
            RewriteError::Failed(e) => e,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Registers `refine_<slot>`'s shortcut, creating it if this slot never had one.
fn ensure_slot_binding(app: &AppHandle, settings: &mut AppSettings, slot: usize) {
    let binding = settings
        .bindings
        .entry(format!("refine_{slot}"))
        .or_insert_with(|| refine_binding(slot))
        .clone();
    if settings.post_process_enabled {
        if let Err(e) = crate::common::shortcut::register_shortcut(app, binding) {
            warn!("Could not register refine_{slot}: {e}");
        }
    }
}

/// Drops `refine_<slot>`'s shortcut when it isn't one of the built-in four,
/// which always keep theirs.
fn release_slot_binding(app: &AppHandle, settings: &mut AppSettings, slot: usize) {
    if slot <= BUILTIN_REWRITE_IDS.len() {
        return;
    }
    if let Some(binding) = settings.bindings.remove(&format!("refine_{slot}")) {
        let _ = crate::common::shortcut::unregister_shortcut(app, binding);
    }
}

/// A rewrite written by the user, on the next free shortcut.
#[tauri::command]
#[specta::specta]
pub fn create_rewrite(
    app: AppHandle,
    name: String,
    instructions: String,
) -> Result<LLMPrompt, String> {
    let mut settings = get_settings(&app);
    let slot = match settings
        .refine_prompt_ids
        .iter()
        .position(|id| id.is_empty())
    {
        Some(index) => index + 1,
        None if settings.refine_prompt_ids.len() < REFINE_SLOTS => {
            settings.refine_prompt_ids.push(String::new());
            settings.refine_prompt_ids.len()
        }
        None => return Err("Every shortcut is taken. Delete a rewrite first.".into()),
    };
    let rewrite = LLMPrompt {
        id: format!("rewrite_{}", chrono::Utc::now().timestamp_millis()),
        name: name.trim().to_string(),
        prompt: instructions.trim().to_string(),
        description: String::new(),
        options: None,
        extra_instructions: String::new(),
        samples: Vec::new(),
    };
    settings.post_process_prompts.push(rewrite.clone());
    settings.refine_prompt_ids[slot - 1] = rewrite.id.clone();
    ensure_slot_binding(&app, &mut settings, slot);
    write_settings(&app, settings);
    Ok(rewrite)
}

/// Saves a rewrite's name, switches, instructions and samples.
#[tauri::command]
#[specta::specta]
pub fn save_rewrite(app: AppHandle, rewrite: LLMPrompt) -> Result<(), String> {
    let mut settings = get_settings(&app);
    let existing = settings
        .post_process_prompts
        .iter_mut()
        .find(|p| p.id == rewrite.id)
        .ok_or("Unknown rewrite")?;
    let mut rewrite = rewrite;
    for sample in &mut rewrite.samples {
        let words: Vec<&str> = sample.text.split_whitespace().collect();
        if words.len() > WRITING_SAMPLE_MAX_WORDS {
            sample.text = words[..WRITING_SAMPLE_MAX_WORDS].join(" ");
        }
    }
    if rewrite.name.trim().is_empty() {
        rewrite.name = existing.name.clone();
    }
    *existing = rewrite;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn delete_rewrite(app: AppHandle, id: String) -> Result<(), String> {
    let mut settings = get_settings(&app);
    let before = settings.post_process_prompts.len();
    settings.post_process_prompts.retain(|p| p.id != id);
    if settings.post_process_prompts.len() == before {
        return Err("Unknown rewrite".into());
    }
    let slots: Vec<usize> = settings
        .refine_prompt_ids
        .iter()
        .enumerate()
        .filter(|(_, r)| **r == id)
        .map(|(i, _)| i + 1)
        .collect();
    for slot in slots {
        settings.refine_prompt_ids[slot - 1].clear();
        release_slot_binding(&app, &mut settings, slot);
    }
    write_settings(&app, settings);
    Ok(())
}

/// Puts a built-in rewrite back as it shipped. Writing samples stay.
#[tauri::command]
#[specta::specta]
pub fn reset_rewrite(app: AppHandle, id: String) -> Result<LLMPrompt, String> {
    let mut fresh = builtin_rewrite(&id).ok_or("Only built-in rewrites can be reset")?;
    let mut settings = get_settings(&app);
    match settings
        .post_process_prompts
        .iter_mut()
        .find(|p| p.id == id)
    {
        Some(existing) => {
            fresh.samples = std::mem::take(&mut existing.samples);
            *existing = fresh.clone();
        }
        None => settings.post_process_prompts.push(fresh.clone()),
    }
    write_settings(&app, settings);
    Ok(fresh)
}

/// The built-in rewrites as they shipped, back on Option+1 to 4. The user's
/// own rewrites keep working, on the shortcuts after them.
#[tauri::command]
#[specta::specta]
pub fn reset_rewrites(app: AppHandle) -> Result<(), String> {
    for id in BUILTIN_REWRITE_IDS {
        reset_rewrite(app.clone(), id.to_string())?;
    }
    let mut settings = get_settings(&app);
    let custom: Vec<String> = settings
        .refine_prompt_ids
        .iter()
        .filter(|id| !id.is_empty() && !BUILTIN_REWRITE_IDS.contains(&id.as_str()))
        .cloned()
        .collect();
    let old_len = settings.refine_prompt_ids.len();
    let mut ids: Vec<String> = BUILTIN_REWRITE_IDS.map(String::from).to_vec();
    ids.extend(
        custom
            .into_iter()
            .take(REFINE_SLOTS - BUILTIN_REWRITE_IDS.len()),
    );
    let new_len = ids.len();
    settings.refine_prompt_ids = ids;
    for slot in 1..=new_len {
        ensure_slot_binding(&app, &mut settings, slot);
    }
    for slot in new_len + 1..=old_len.max(new_len) {
        release_slot_binding(&app, &mut settings, slot);
    }
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_rewrite_dictation_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.rewrite_dictation = enabled;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_llm_use_provider_setting(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.llm_use_provider = enabled;
    write_settings(&app, settings);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::clean_answer;

    #[test]
    fn answers_lose_their_wrapping() {
        assert_eq!(clean_answer("  Hello there.  "), "Hello there.");
        assert_eq!(clean_answer("<think>hmm</think>\nHi."), "Hi.");
        assert_eq!(clean_answer("<text>\nHi.\n</text>"), "Hi.");
        assert_eq!(clean_answer("a\u{200B}b"), "ab");
        assert_eq!(clean_answer("Goal:  \nShip it."), "Goal:\nShip it.");
    }
}
