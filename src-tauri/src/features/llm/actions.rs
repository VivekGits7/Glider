//! What the Refine shortcuts do.

use crate::common::shortcut::actions::ShortcutAction;
use tauri::AppHandle;

/// Refine: rewrites the selected text in place with the prompt picked for
/// `refine_<slot>`. Fires on key release, like Read Aloud, so the shortcut's
/// keys are up before the selection is copied and the result pasted.
pub(crate) struct RefineSelectionAction {
    pub(crate) slot: usize,
}

impl ShortcutAction for RefineSelectionAction {
    fn start(&self, _app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {}

    fn stop(&self, app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        let app = app.clone();
        let slot = self.slot;
        std::thread::spawn(move || crate::features::llm::rewrite::refine_selection(&app, slot));
    }
}

/// Compare: shows what the last rewrite changed.
pub(crate) struct RefineCompareAction;

impl ShortcutAction for RefineCompareAction {
    fn start(&self, _app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {}

    fn stop(&self, app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        crate::features::llm::rewrite::show_last_changes(app);
    }
}
