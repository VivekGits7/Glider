//! The macOS Fn (Globe) key. On its own it opens the emoji picker, switches
//! the input source or starts Apple Dictation, depending on System Settings
//! ("Press 🌐 key to"). Glider's default dictation shortcut is Fn, so that
//! system action would fire on every dictation unless it is set to "Do Nothing".

/// `AppleFnUsageType` in `com.apple.HIToolbox`: 0 means "Do Nothing".
#[cfg(target_os = "macos")]
const DOMAIN: &str = "com.apple.HIToolbox";
#[cfg(target_os = "macos")]
const KEY: &str = "AppleFnUsageType";

/// True when pressing Fn alone also makes macOS do something.
#[tauri::command]
#[specta::specta]
pub fn fn_key_has_system_action() -> bool {
    #[cfg(target_os = "macos")]
    {
        // A missing key means the macOS default, which is never "Do Nothing".
        std::process::Command::new("defaults")
            .args(["read", DOMAIN, KEY])
            .output()
            .map(|out| String::from_utf8_lossy(&out.stdout).trim() != "0")
            .unwrap_or(true)
    }
    #[cfg(not(target_os = "macos"))]
    false
}

/// Sets "Press 🌐 key to" to "Do Nothing". Only called after the user agrees;
/// they can change it back in System Settings → Keyboard.
#[tauri::command]
#[specta::specta]
pub fn disable_fn_key_system_action() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("defaults")
            .args(["write", DOMAIN, KEY, "-int", "0"])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(format!("defaults write exited with {status}"));
        }
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    Err("Only macOS has a Globe key setting".into())
}

/// Opens System Settings → Keyboard, where "Press 🌐 key to" lives.
#[tauri::command]
#[specta::specta]
pub fn open_keyboard_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.Keyboard-Settings.extension")
            .status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    Err("Only macOS has a Globe key setting".into())
}
