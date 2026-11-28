//! Code shared by two or more features: settings, notices, overlay, tray,
//! shortcuts, playback devices and app/system plumbing.

pub(crate) mod app_icon;
pub mod audio;
pub(crate) mod commands;
pub(crate) mod memory;
pub(crate) mod models_dir;
pub(crate) mod notices;
pub(crate) mod overlay;
#[cfg(target_os = "macos")]
pub(crate) mod overlay_keys;
pub(crate) mod settings;
pub(crate) mod shortcut;
pub mod system;
pub(crate) mod tray;
pub(crate) mod utils;
pub(crate) mod worker_kit;
