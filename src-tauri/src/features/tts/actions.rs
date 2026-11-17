//! What the Read Aloud shortcut does.

use crate::common::shortcut::actions::ShortcutAction;
use tauri::AppHandle;

/// Read Aloud. Fires on key release, when the shortcut's keys are usually
/// up, so they don't mix into the Cmd/Ctrl+C that grabs the selection.
pub(crate) struct SpeakSelectionAction;

impl ShortcutAction for SpeakSelectionAction {
    fn start(&self, _app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {}

    fn stop(&self, app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        crate::features::tts::service::toggle_read_selection(app);
    }
}
