//! Shared shortcut event handling logic
//!
//! This module contains the common logic for handling shortcut events,
//! used by both the Tauri and handy-keys implementations.

use log::{debug, warn};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

use crate::common::settings::get_settings;
use crate::common::shortcut::actions::ACTION_MAP;
use crate::features::stt::coordinator::is_transcribe_binding;
use crate::features::stt::coordinator::ShortcutActivation;
use crate::features::stt::recorder::AudioRecordingManager;
use crate::TranscriptionCoordinator;

/// Handle a shortcut event from either implementation.
///
/// This function contains the shared logic for:
/// - Looking up the action in ACTION_MAP
/// - Handling the cancel binding (only fires when recording)
/// - Routing transcribe bindings to the coordinator, which applies the
///   configured activation mode (toggle / push-to-talk / hold-or-toggle)
///
/// # Arguments
/// * `app` - The Tauri app handle
/// * `binding_id` - The ID of the binding (e.g., "transcribe", "cancel")
/// * `hotkey_string` - The string representation of the hotkey
/// * `is_pressed` - Whether this is a key press (true) or release (false)
pub fn handle_shortcut_event(
    app: &AppHandle,
    binding_id: &str,
    hotkey_string: &str,
    is_pressed: bool,
) {
    let settings = get_settings(app);

    // Transcribe bindings are handled by the coordinator.
    if is_transcribe_binding(binding_id) {
        if is_pressed {
            *LAST_TRANSCRIBE_PRESS
                .lock()
                .unwrap_or_else(|e| e.into_inner()) =
                Some((Instant::now(), hotkey_string.to_string()));
        }
        if let Some(coordinator) = app.try_state::<TranscriptionCoordinator>() {
            // Always hybrid: hold to talk, or tap twice for hands-free.
            coordinator.send_input(
                binding_id,
                hotkey_string,
                is_pressed,
                ShortcutActivation::HoldOrToggle,
                std::time::Duration::from_millis(settings.hold_threshold_ms),
            );
        } else {
            warn!("TranscriptionCoordinator is not initialized");
        }
        return;
    }

    let Some(action) = ACTION_MAP.get(binding_id) else {
        warn!(
            "No action defined in ACTION_MAP for shortcut ID '{}'. Shortcut: '{}', Pressed: {}",
            binding_id, hotkey_string, is_pressed
        );
        return;
    };

    // Cancel binding: only fires when recording and key is pressed
    if binding_id == "cancel" {
        let audio_manager = app.state::<Arc<AudioRecordingManager>>();
        if audio_manager.is_recording() && is_pressed {
            action.start(app, binding_id, hotkey_string);
        }
        return;
    }

    cancel_dictation_this_press_extends(app, hotkey_string);

    // Remaining bindings (e.g. "test") use simple start/stop on press/release.
    if is_pressed {
        action.start(app, binding_id, hotkey_string);
    } else {
        action.stop(app, binding_id, hotkey_string);
    }
}

/// The last transcribe press: when, and the hotkey pressed.
static LAST_TRANSCRIBE_PRESS: Mutex<Option<(Instant, String)>> = Mutex::new(None);

/// How long after a dictation press a bigger shortcut still counts as the
/// same gesture (Fn, then Ctrl for Fn+Ctrl).
const EXTEND_WINDOW: Duration = Duration::from_secs(3);

/// Keys of a hotkey with sides dropped: "ctrl_right+win" -> {ctrl, win}.
fn hotkey_parts(hotkey: &str) -> HashSet<String> {
    hotkey
        .split('+')
        .map(|p| {
            let p = p.trim().to_lowercase();
            p.strip_suffix("_left")
                .or_else(|| p.strip_suffix("_right"))
                .map_or_else(|| p.clone(), str::to_string)
        })
        .collect()
}

/// `hotkey` holds every key of `dictation` plus more.
fn extends(hotkey: &str, dictation: &str) -> bool {
    let (outer, inner) = (hotkey_parts(hotkey), hotkey_parts(dictation));
    outer.len() > inner.len() && inner.is_subset(&outer)
}

/// A shortcut that contains the dictation shortcut (Fn+Ctrl over Fn) can only
/// be pressed by pressing dictation first, which starts a recording. Throw that
/// recording away: the user meant the bigger shortcut. Runs on press and on
/// release, since the recording may start after the press event arrives.
fn cancel_dictation_this_press_extends(app: &AppHandle, hotkey: &str) {
    let mut last = LAST_TRANSCRIBE_PRESS
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let Some((at, dictation)) = last.as_ref() else {
        return;
    };
    if at.elapsed() > EXTEND_WINDOW || !extends(hotkey, dictation) {
        return;
    }
    let was_recording = app.state::<Arc<AudioRecordingManager>>().is_recording();
    debug!("'{hotkey}' extends dictation '{dictation}'; dropping its recording");
    crate::common::utils::cancel_current_operation(app);
    if was_recording {
        *last = None;
    }
}

#[cfg(test)]
mod tests {
    use super::extends;

    #[test]
    fn superset_shortcuts_extend_dictation() {
        assert!(extends("fn+ctrl", "fn"));
        assert!(extends("ctrl+win", "ctrl_right"));
        assert!(!extends("fn", "fn"));
        assert!(!extends("option+1", "fn"));
        assert!(!extends("alt+1", "ctrl_right"));
    }
}
