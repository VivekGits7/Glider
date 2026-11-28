//! The app icon in the Dock (the taskbar on Windows and Linux) and the app
//! switcher. The bundle ships the dark icon; the App Icon setting can swap in
//! the light one while Glider runs.

use log::warn;
use tauri::AppHandle;

use crate::common::settings::{self, AppIcon};
use crate::common::tray::{get_current_theme, AppTheme};

// The Dock draws up to 512px on Retina; the taskbar and Alt+Tab need far less.
#[cfg(target_os = "macos")]
const LIGHT_ICON: &[u8] = include_bytes!("../../icons/light/icon.png");
#[cfg(not(target_os = "macos"))]
const LIGHT_ICON: &[u8] = include_bytes!("../../icons/light/128x128@2x.png");

/// Shows the icon the App Icon setting asks for. Call it on startup, when the
/// setting changes, when the theme changes (for `Automatic`) and when the Dock
/// icon comes back.
pub fn apply(app: &AppHandle) {
    let light = match settings::get_settings(app).app_icon {
        AppIcon::Light => true,
        AppIcon::Dark => false,
        AppIcon::Automatic => get_current_theme(app) == AppTheme::Light,
    };
    set_icon(app, light.then_some(LIGHT_ICON));
}

/// `None` puts back the bundle's own (dark) icon.
#[cfg(target_os = "macos")]
fn set_icon(app: &AppHandle, png: Option<&'static [u8]>) {
    let result = app.run_on_main_thread(move || {
        use objc2::{AnyThread, MainThreadMarker};
        use objc2_app_kit::{NSApplication, NSImage};
        use objc2_foundation::NSData;

        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let image = match png {
            Some(bytes) => {
                match NSImage::initWithData(NSImage::alloc(), &NSData::with_bytes(bytes)) {
                    Some(image) => Some(image),
                    None => {
                        warn!("Failed to decode the light app icon");
                        return;
                    }
                }
            }
            None => None,
        };
        // SAFETY: we are on the main thread, and AppKit documents nil as
        // "restore the default icon".
        unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(image.as_deref()) };
    });
    if let Err(e) = result {
        warn!("Failed to set the app icon: {}", e);
    }
}

/// `None` puts back the window icon Tauri set from the bundle (dark).
#[cfg(not(target_os = "macos"))]
fn set_icon(app: &AppHandle, png: Option<&'static [u8]>) {
    use tauri::Manager;

    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let icon = match png {
        Some(bytes) => match tauri::image::Image::from_bytes(bytes) {
            Ok(icon) => icon,
            Err(e) => {
                warn!("Failed to decode the light app icon: {}", e);
                return;
            }
        },
        None => match app.default_window_icon() {
            Some(icon) => icon.clone(),
            None => return,
        },
    };
    if let Err(e) = window.set_icon(icon) {
        warn!("Failed to set the app icon: {}", e);
    }
}
