//! The shortcut action registry: what each binding id does when its keys go
//! down and up. Each feature owns its own action; this file only maps ids to
//! them, plus Cancel and Test, which belong to no single feature.

use crate::common::utils;
use crate::features::llm::actions::{RefineCompareAction, RefineSelectionAction};
use crate::features::stt::actions::TranscribeAction;
use crate::features::tts::actions::SpeakSelectionAction;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;

/// One shortcut's behavior: `start` on key down (or toggle on), `stop` on
/// key up (or toggle off).
pub trait ShortcutAction: Send + Sync {
    fn start(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
    fn stop(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
}

struct CancelAction;

impl ShortcutAction for CancelAction {
    fn start(&self, app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        utils::cancel_current_operation(app);
    }

    fn stop(&self, _app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        // Nothing to do on stop for cancel
    }
}

// Test Action
struct TestAction;

impl ShortcutAction for TestAction {
    fn start(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str) {
        log::info!(
            "Shortcut ID '{}': Started - {} (App: {})", // Changed "Pressed" to "Started" for consistency
            binding_id,
            shortcut_str,
            app.package_info().name
        );
    }

    fn stop(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str) {
        log::info!(
            "Shortcut ID '{}': Stopped - {} (App: {})", // Changed "Released" to "Stopped" for consistency
            binding_id,
            shortcut_str,
            app.package_info().name
        );
    }
}

/// Every shortcut binding id and the action it runs.
pub static ACTION_MAP: Lazy<HashMap<String, Arc<dyn ShortcutAction>>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert(
        "transcribe".to_string(),
        Arc::new(TranscribeAction {
            post_process: false,
        }) as Arc<dyn ShortcutAction>,
    );
    map.insert(
        "transcribe_with_post_process".to_string(),
        Arc::new(TranscribeAction { post_process: true }) as Arc<dyn ShortcutAction>,
    );
    map.insert(
        "speak_selection".to_string(),
        Arc::new(SpeakSelectionAction) as Arc<dyn ShortcutAction>,
    );
    for slot in 1..=crate::common::settings::REFINE_SLOTS {
        map.insert(
            format!("refine_{slot}"),
            Arc::new(RefineSelectionAction { slot }) as Arc<dyn ShortcutAction>,
        );
    }
    map.insert(
        crate::common::settings::REFINE_COMPARE_BINDING.to_string(),
        Arc::new(RefineCompareAction) as Arc<dyn ShortcutAction>,
    );
    map.insert(
        "cancel".to_string(),
        Arc::new(CancelAction) as Arc<dyn ShortcutAction>,
    );
    map.insert(
        "test".to_string(),
        Arc::new(TestAction) as Arc<dyn ShortcutAction>,
    );
    map
});
