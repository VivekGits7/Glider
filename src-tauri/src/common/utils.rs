use crate::common::shortcut;
use crate::features::stt::recorder::AudioRecordingManager;
use crate::features::stt::transcription::TranscriptionManager;
use crate::TranscriptionCoordinator;
use log::info;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

// Re-export all utility modules for easy access
// pub use crate::common::audio::feedback::*;
pub use crate::common::overlay::*;
pub use crate::common::tray::*;
pub use crate::features::stt::output::clipboard::*;

/// Preserve diagnostic text in development builds, but redact it in releases.
/// Do not use for secrets such as API keys, which must always be redacted.
pub fn redact_text(text: &str) -> &str {
    if cfg!(debug_assertions) {
        text
    } else {
        "[REDACTED]"
    }
}

/// Main window's opening and minimum page size, in logical pixels.
pub const MAIN_WINDOW_SIZE: (f64, f64) = (1280.0, 832.0);
/// The window can shrink to this; Home's cards stack below ~860px.
pub const MAIN_WINDOW_MIN_SIZE: (f64, f64) = (720.0, 600.0);

/// The opening size on a screen whose usable area is `width` x `height`:
/// [`MAIN_WINDOW_SIZE`], shrunk to leave a margin on small screens, never
/// under [`MAIN_WINDOW_MIN_SIZE`].
pub fn fit_main_window(width: f64, height: f64) -> (f64, f64) {
    let fit = |want: f64, room: f64, min: f64| want.min(room - 48.0).max(min);
    (
        fit(MAIN_WINDOW_SIZE.0, width, MAIN_WINDOW_MIN_SIZE.0),
        fit(MAIN_WINDOW_SIZE.1, height, MAIN_WINDOW_MIN_SIZE.1),
    )
}

#[cfg(any(test, all(target_os = "windows", target_arch = "x86_64")))]
const IMAGE_FILE_MACHINE_ARM64: u16 = 0xaa64;

#[cfg(any(test, all(target_os = "windows", target_arch = "x86_64")))]
fn native_machine_is_arm64(native_machine: Option<u16>) -> bool {
    native_machine == Some(IMAGE_FILE_MACHINE_ARM64)
}

/// Whether this is the x64 Windows build running under emulation on Windows ARM64.
///
/// Only that exact process/host pairing disables the transcribe.cpp GPU path.
/// Detection is deliberately fail-open: a native x64 host, an older Windows
/// version without `IsWow64Process2`, or any API error leaves existing behavior
/// unchanged.
pub fn is_windows_x64_emulated_on_arm64() -> bool {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        use std::sync::OnceLock;

        static DETECTED: OnceLock<bool> = OnceLock::new();
        *DETECTED.get_or_init(|| native_machine_is_arm64(native_windows_machine()))
    }

    #[cfg(not(all(target_os = "windows", target_arch = "x86_64")))]
    {
        false
    }
}

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
fn native_windows_machine() -> Option<u16> {
    use windows::core::{s, w, BOOL};
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
    use windows::Win32::System::Threading::GetCurrentProcess;

    type IsWow64Process2 = unsafe extern "system" fn(HANDLE, *mut u16, *mut u16) -> BOOL;

    // Resolve IsWow64Process2 dynamically so merely starting Glider never raises
    // the minimum Windows version. Windows-on-ARM versions provide this API,
    // while a missing symbol or failed query safely preserves the x64 behavior.
    unsafe {
        let kernel32 = GetModuleHandleW(w!("kernel32.dll")).ok()?;
        let address = GetProcAddress(kernel32, s!("IsWow64Process2"))?;
        // SAFETY: GetProcAddress returned the documented IsWow64Process2 symbol;
        // function pointers have the same representation on supported Windows.
        let is_wow64_process2: IsWow64Process2 = std::mem::transmute(address);
        let mut process_machine = 0u16;
        let mut native_machine = 0u16;
        is_wow64_process2(
            GetCurrentProcess(),
            &mut process_machine,
            &mut native_machine,
        )
        .as_bool()
        .then_some(native_machine)
    }
}

/// Centralized cancellation function that can be called from anywhere in the app.
/// Handles cancelling both recording and transcription operations and updates UI state.
pub fn cancel_current_operation(app: &AppHandle) {
    info!("Initiating operation cancellation...");

    // Unregister the cancel shortcut asynchronously
    shortcut::unregister_cancel_shortcut(app);

    // Cancel any ongoing recording
    let audio_manager = app.state::<Arc<AudioRecordingManager>>();
    let recording_was_active = audio_manager.is_recording();
    audio_manager.cancel_recording();

    // Abandon any live streaming transcription, and stop a transcription
    // already in progress
    let tm = app.state::<Arc<TranscriptionManager>>();
    tm.cancel_stream();
    tm.cancel_transcription();

    // Update tray icon and hide overlay
    set_tray_state(app, crate::common::tray::TrayIconState::Idle);
    hide_recording_overlay(app);

    // Unload model if immediate unload is enabled. Done before notifying the
    // coordinator, so a recording started next always loads afresh; it
    // doesn't wait for the cancelled work, so it never blocks this thread.
    tm.maybe_unload_immediately("cancellation");

    // Notify coordinator so it can keep lifecycle state coherent.
    if let Some(coordinator) = app.try_state::<TranscriptionCoordinator>() {
        coordinator.notify_cancel(recording_was_active);
    }

    info!("Operation cancellation completed - returned to idle state");
}

/// Check if using the Wayland display server protocol
#[cfg(target_os = "linux")]
pub fn is_wayland() -> bool {
    std::env::var("WAYLAND_DISPLAY").is_ok()
        || std::env::var("XDG_SESSION_TYPE")
            .map(|v| v.to_lowercase() == "wayland")
            .unwrap_or(false)
}

/// Check if running on KDE Plasma desktop environment
#[cfg(target_os = "linux")]
pub fn is_kde_plasma() -> bool {
    std::env::var("XDG_CURRENT_DESKTOP")
        .map(|v| v.to_uppercase().contains("KDE"))
        .unwrap_or(false)
        || std::env::var("KDE_SESSION_VERSION").is_ok()
}

/// Check if running on KDE Plasma with Wayland
#[cfg(target_os = "linux")]
pub fn is_kde_wayland() -> bool {
    is_wayland() && is_kde_plasma()
}

/// Check if running on GNOME desktop environment
#[cfg(target_os = "linux")]
pub fn is_gnome() -> bool {
    std::env::var("XDG_CURRENT_DESKTOP")
        .map(|v| v.to_uppercase().contains("GNOME"))
        .unwrap_or(false)
}

/// Check if running on GNOME with Wayland
#[cfg(target_os = "linux")]
pub fn is_gnome_wayland() -> bool {
    is_wayland() && is_gnome()
}

/// Returns true when the environment variable is set to a truthy value
/// (e.g. "1", "true", "yes", "on").
/// "0", "false", "no", "off" and empty string are treated as falsy (case-insensitive).
/// Returns false when the variable is not set.
pub fn env_flag_enabled(name: &str) -> bool {
    match std::env::var(name) {
        Ok(v) => !matches!(
            v.trim().to_ascii_lowercase().as_str(),
            "" | "0" | "false" | "no" | "off"
        ),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn main_window_opens_large_but_fits_the_screen() {
        // A 16" MacBook Pro has room for the full size.
        assert_eq!(fit_main_window(1728.0, 1080.0), MAIN_WINDOW_SIZE);
        // A 13" MacBook Air (1440x900, minus menu bar and Dock) is shorter.
        assert_eq!(fit_main_window(1440.0, 812.0), (1280.0, 764.0));
        // Tiny screens still get the minimum.
        assert_eq!(fit_main_window(700.0, 500.0), MAIN_WINDOW_MIN_SIZE);
    }

    #[test]
    fn arm64_native_machine_is_the_only_match() {
        assert!(native_machine_is_arm64(Some(IMAGE_FILE_MACHINE_ARM64)));
        assert!(!native_machine_is_arm64(Some(0x8664))); // AMD64
        assert!(!native_machine_is_arm64(Some(0x014c))); // I386
        assert!(!native_machine_is_arm64(None)); // API unavailable or failed
    }

    #[test]
    fn env_flag_enabled_true_for_truthy_values() {
        for value in ["1", "true", "TRUE", "yes", "on", " 1 "] {
            std::env::set_var("GLIDER_TEST_FLAG_TRUTHY", value);
            assert!(env_flag_enabled("GLIDER_TEST_FLAG_TRUTHY"), "{value:?}");
        }
        std::env::remove_var("GLIDER_TEST_FLAG_TRUTHY");
    }

    #[test]
    fn env_flag_enabled_false_for_falsy_or_unset() {
        assert!(!env_flag_enabled("GLIDER_TEST_FLAG_UNSET"));

        for value in ["0", "false", "FALSE", "no", "off", ""] {
            std::env::set_var("GLIDER_TEST_FLAG_FALSY", value);
            assert!(!env_flag_enabled("GLIDER_TEST_FLAG_FALSY"), "{value:?}");
        }
        std::env::remove_var("GLIDER_TEST_FLAG_FALSY");
    }
}

/// The name of the app in front, as the user knows it ("Zed", "Chrome"), for
/// Insights. `None` when the platform can't say.
#[cfg(target_os = "macos")]
pub fn frontmost_app_name() -> Option<String> {
    let app = objc2_app_kit::NSWorkspace::sharedWorkspace().frontmostApplication()?;
    let name = app.localizedName()?.to_string();
    (!name.is_empty()).then_some(name)
}

#[cfg(target_os = "windows")]
pub fn frontmost_app_name() -> Option<String> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    let mut pid = 0u32;
    unsafe {
        let window = GetForegroundWindow();
        if window.0.is_null() {
            return None;
        }
        GetWindowThreadProcessId(window, Some(&mut pid));
    }
    if pid == 0 {
        return None;
    }
    let mut path = [0u16; 1024];
    let mut len = path.len() as u32;
    let found = unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let found = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(path.as_mut_ptr()),
            &mut len,
        )
        .is_ok();
        let _ = CloseHandle(process);
        found
    };
    if !found {
        return None;
    }
    let path = String::from_utf16_lossy(&path[..len as usize]);
    let stem = std::path::Path::new(&path)
        .file_stem()?
        .to_string_lossy()
        .to_string();
    Some(app_name_from_exe(&stem))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn frontmost_app_name() -> Option<String> {
    None
}

/// "chrome" -> "Chrome", "WindowsTerminal" -> "WindowsTerminal".
#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn app_name_from_exe(stem: &str) -> String {
    let mut chars = stem.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

#[cfg(test)]
mod frontmost_tests {
    #[test]
    fn exe_names_read_like_app_names() {
        assert_eq!(super::app_name_from_exe("chrome"), "Chrome");
        assert_eq!(super::app_name_from_exe("Code"), "Code");
        assert_eq!(super::app_name_from_exe(""), "");
    }
}
