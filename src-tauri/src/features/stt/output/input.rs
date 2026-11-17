use enigo::{Enigo, Key, Keyboard, Mouse, Settings};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// Where a paste would land, judged from the focused element.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FocusTarget {
    /// A text field, text view, or anything editable: paste.
    Text,
    /// Nothing focused, or a control that can't take text (Finder's file
    /// list, a button): show the text to copy instead.
    Nowhere,
    /// Can't tell (an app that hides its insides from Accessibility, like
    /// many Electron apps): paste, as before.
    Unsure,
}

/// `role` is `None` when nothing has focus. Only roles that can never take
/// typed text count as nowhere, so an app that hides its text fields still
/// gets the paste.
pub fn classify_focus(role: Option<&str>, editable: bool) -> FocusTarget {
    const TEXT: &[&str] = &["AXTextField", "AXTextArea", "AXComboBox", "AXSearchField"];
    const NOT_TEXT: &[&str] = &[
        "AXList",
        "AXOutline",
        "AXTable",
        "AXBrowser",
        "AXRow",
        "AXCell",
        "AXButton",
        "AXCheckBox",
        "AXRadioButton",
        "AXPopUpButton",
        "AXMenuButton",
        "AXMenuItem",
        "AXMenuBarItem",
        "AXImage",
        "AXStaticText",
        "AXSlider",
        "AXLink",
        "AXTabGroup",
        "AXToolbar",
        "AXScrollArea",
        "AXSplitGroup",
        "AXDisclosureTriangle",
    ];
    match role {
        None => FocusTarget::Nowhere,
        Some(_) if editable => FocusTarget::Text,
        Some(role) if TEXT.contains(&role) => FocusTarget::Text,
        Some(role) if NOT_TEXT.contains(&role) => FocusTarget::Nowhere,
        Some(_) => FocusTarget::Unsure,
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::Key;
    use log::{debug, warn};
    use std::ffi::c_void;

    type TisInputSourceRef = *const c_void;
    type CfDataRef = *const c_void;
    type CfStringRef = *const c_void;

    // kVK_ANSI_V. This is the behavior Glider used before layout-aware
    // resolution and remains the safest fallback if macOS cannot expose the
    // active layout.
    const ANSI_V_KEYCODE: u16 = 9;
    // kVK_ANSI_C, the copy fallback used by Read Aloud.
    const ANSI_C_KEYCODE: u16 = 8;
    // kVK_ANSI_Z, Refine's undo before it pastes another try.
    const ANSI_Z_KEYCODE: u16 = 6;
    const KEYCODE_COUNT: u16 = 128;
    const UC_KEY_ACTION_DISPLAY: u16 = 3;
    const UC_KEY_TRANSLATE_NO_DEAD_KEYS_MASK: u32 = 1;
    // Carbon's cmdKey is bit 8. UCKeyTranslate expects Carbon modifiers shifted
    // right by 8, so Command is represented by bit 0 here.
    const COMMAND_MODIFIER_STATE: u32 = 1;

    #[link(name = "Carbon", kind = "framework")]
    unsafe extern "C" {
        fn TISCopyCurrentKeyboardLayoutInputSource() -> TisInputSourceRef;
        fn TISGetInputSourceProperty(
            input_source: TisInputSourceRef,
            property_key: CfStringRef,
        ) -> CfDataRef;
        static kTISPropertyUnicodeKeyLayoutData: CfStringRef;
        fn UCKeyTranslate(
            key_layout: *const u8,
            virtual_key_code: u16,
            key_action: u16,
            modifier_key_state: u32,
            keyboard_type: u32,
            key_translate_options: u32,
            dead_key_state: *mut u32,
            max_string_length: usize,
            actual_string_length: *mut usize,
            unicode_string: *mut u16,
        ) -> i32;
        fn LMGetKbdType() -> u8;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    unsafe extern "C" {
        fn CFDataGetBytePtr(data: CfDataRef) -> *const u8;
        fn CFRelease(value: *const c_void);
        fn CFGetTypeID(value: *const c_void) -> usize;
        fn CFStringGetTypeID() -> usize;
    }

    #[link(name = "ApplicationServices", kind = "framework")]
    unsafe extern "C" {
        fn AXUIElementCreateSystemWide() -> *const c_void;
        fn AXUIElementCreateApplication(pid: i32) -> *const c_void;
        fn AXUIElementCopyAttributeValue(
            element: *const c_void,
            attribute: CfStringRef,
            value: *mut *const c_void,
        ) -> i32;
        fn AXUIElementSetMessagingTimeout(element: *const c_void, timeout_seconds: f32) -> i32;
        fn AXUIElementIsAttributeSettable(
            element: *const c_void,
            attribute: CfStringRef,
            settable: *mut u8,
        ) -> i32;
    }

    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        fn CGEventSourceFlagsState(state_id: i32) -> u64;
    }

    /// Waits (up to `timeout`) until no modifier key is physically held. Apps
    /// such as Zed track held modifiers themselves, so a Cmd+C sent while the
    /// user's ⌥ from ⌥R is still down reaches them as Cmd+⌥+C and copies nothing.
    pub fn wait_for_modifiers_released(timeout: std::time::Duration) {
        const HID_SYSTEM_STATE: i32 = 1;
        // Shift, Control, Option, Command, Fn.
        const MODIFIERS: u64 = 0x20000 | 0x40000 | 0x80000 | 0x100000 | 0x800000;
        let started = std::time::Instant::now();
        // SAFETY: a pure query of the keyboard state.
        while unsafe { CGEventSourceFlagsState(HID_SYSTEM_STATE) } & MODIFIERS != 0 {
            if started.elapsed() > timeout {
                warn!("Modifier keys still held after {timeout:?}; copying anyway");
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        if started.elapsed() > std::time::Duration::from_millis(10) {
            debug!(
                "Waited {:?} for modifier keys to be released",
                started.elapsed()
            );
            // Let the app see the release before our Cmd+C arrives.
            std::thread::sleep(std::time::Duration::from_millis(30));
        }
    }

    /// A CoreFoundation object we own (Create/Copy rule), released on drop.
    struct CfOwned(*const c_void);

    impl Drop for CfOwned {
        fn drop(&mut self) {
            if !self.0.is_null() {
                // SAFETY: we own this reference; see the type's doc.
                unsafe { CFRelease(self.0) };
            }
        }
    }

    /// The attribute's AXError status (0 on success) and its value.
    fn copy_ax_attribute_with_status(element: &CfOwned, name: &str) -> (i32, CfOwned) {
        let attribute = objc2_foundation::NSString::from_str(name);
        let mut value: *const c_void = std::ptr::null();
        // SAFETY: `element` is a live AXUIElement and NSString is toll-free
        // bridged to CFString. On success `value` is returned retained.
        let status = unsafe {
            AXUIElementCopyAttributeValue(
                element.0,
                objc2::rc::Retained::as_ptr(&attribute).cast(),
                &mut value,
            )
        };
        (status, CfOwned(value))
    }

    fn copy_ax_attribute(element: &CfOwned, name: &str) -> Option<CfOwned> {
        let (status, value) = copy_ax_attribute_with_status(element, name);
        (status == 0 && !value.0.is_null()).then_some(value)
    }

    /// The focused app's selected text through the Accessibility API, without
    /// a keystroke or touching the clipboard. `None` when the app doesn't
    /// expose it (many Electron apps), so callers fall back to copying.
    pub fn accessibility_selected_text() -> Option<String> {
        // SAFETY: returns a new AXUIElement that CfOwned releases.
        let system = CfOwned(unsafe { AXUIElementCreateSystemWide() });
        if system.0.is_null() {
            return None;
        }
        // A hung app would otherwise block this for about six seconds.
        // SAFETY: `system` is a live AXUIElement.
        unsafe { AXUIElementSetMessagingTimeout(system.0, 0.5) };
        let focused = copy_ax_attribute(&system, "AXFocusedUIElement")?;
        let selected = copy_ax_attribute(&focused, "AXSelectedText")?;
        // SAFETY: `selected` is a live CF object; only a CFString is read, and
        // CFString is toll-free bridged to NSString.
        let text = unsafe {
            if CFGetTypeID(selected.0) != CFStringGetTypeID() {
                return None;
            }
            (*(selected.0 as *const objc2_foundation::NSString)).to_string()
        };
        (!text.trim().is_empty()).then_some(text)
    }

    /// What has keyboard focus right now, for deciding whether a paste can
    /// land. See [`super::classify_focus`].
    pub fn focus_target() -> super::FocusTarget {
        const AX_ERROR_NO_VALUE: i32 = -25212;
        // SAFETY: returns a new AXUIElement that CfOwned releases.
        let system = CfOwned(unsafe { AXUIElementCreateSystemWide() });
        if system.0.is_null() {
            return super::FocusTarget::Unsure;
        }
        // A hung app would otherwise block this for about six seconds.
        // SAFETY: `system` is a live AXUIElement.
        unsafe { AXUIElementSetMessagingTimeout(system.0, 0.5) };
        let (status, focused) = copy_ax_attribute_with_status(&system, "AXFocusedUIElement");
        if status == AX_ERROR_NO_VALUE {
            // Chrome, Electron and apps that draw their own UI answer "no
            // focused element" even with a text box focused, and the
            // system-wide focused app can come back empty too. So ask the app
            // in front: only one that says it has no window at all is nowhere.
            let no_window = frontmost_app_window_status() == Some(AX_ERROR_NO_VALUE);
            debug!("No focused element; front app has no window: {no_window}");
            return if no_window {
                super::classify_focus(None, false)
            } else {
                super::FocusTarget::Unsure
            };
        }
        if status != 0 || focused.0.is_null() {
            return super::FocusTarget::Unsure;
        }
        let role = copy_ax_attribute(&focused, "AXRole").and_then(|role| {
            // SAFETY: only a CFString is read; CFString is toll-free bridged
            // to NSString.
            unsafe {
                (CFGetTypeID(role.0) == CFStringGetTypeID())
                    .then(|| (*(role.0 as *const objc2_foundation::NSString)).to_string())
            }
        });
        let editable = copy_ax_attribute(&focused, "AXSelectedTextRange").is_some()
            || is_settable(&focused, "AXValue");
        let target = super::classify_focus(Some(role.as_deref().unwrap_or("")), editable);
        debug!("Focused element: role {role:?}, editable {editable} -> {target:?}");
        target
    }

    /// The AXError status of asking the frontmost app for its focused window,
    /// or `None` when there is no frontmost app.
    fn frontmost_app_window_status() -> Option<i32> {
        let pid = objc2_app_kit::NSWorkspace::sharedWorkspace()
            .frontmostApplication()?
            .processIdentifier();
        // SAFETY: returns a new AXUIElement that CfOwned releases.
        let app = CfOwned(unsafe { AXUIElementCreateApplication(pid) });
        if app.0.is_null() {
            return None;
        }
        // SAFETY: `app` is a live AXUIElement.
        unsafe { AXUIElementSetMessagingTimeout(app.0, 0.5) };
        Some(copy_ax_attribute_with_status(&app, "AXFocusedWindow").0)
    }

    fn is_settable(element: &CfOwned, name: &str) -> bool {
        let attribute = objc2_foundation::NSString::from_str(name);
        let mut settable: u8 = 0;
        // SAFETY: `element` is a live AXUIElement; NSString is toll-free
        // bridged to CFString.
        let status = unsafe {
            AXUIElementIsAttributeSettable(
                element.0,
                objc2::rc::Retained::as_ptr(&attribute).cast(),
                &mut settable,
            )
        };
        status == 0 && settable != 0
    }

    struct InputSource(TisInputSourceRef);

    impl Drop for InputSource {
        fn drop(&mut self) {
            if !self.0.is_null() {
                // SAFETY: TISCopyCurrentKeyboardLayoutInputSource returned this
                // retained reference, so this balances that ownership.
                unsafe { CFRelease(self.0) };
            }
        }
    }

    fn find_keycode(mut matches: impl FnMut(u16) -> bool) -> Option<u16> {
        (0..KEYCODE_COUNT).find(|&keycode| matches(keycode))
    }

    /// Resolves the physical key that macOS interprets as `v` while Command is
    /// held. Including Command is important: non-Latin layouts commonly map
    /// Cmd shortcuts to their ANSI equivalents, while standard Dvorak does not.
    ///
    /// TIS APIs must run on the main thread; paste reaches this via
    /// `clipboard::with_enigo`, which hops there.
    fn resolve_command_keycode(letter: u8) -> Result<u16, String> {
        // SAFETY: This function is called on the macOS main thread. The returned
        // source follows the Create Rule and is released by InputSource::drop.
        let source = InputSource(unsafe { TISCopyCurrentKeyboardLayoutInputSource() });
        if source.0.is_null() {
            return Err("macOS returned no current keyboard layout input source".into());
        }

        // SAFETY: The source remains retained for the duration of the scan and
        // the property constant is provided by Carbon.
        let layout_data =
            unsafe { TISGetInputSourceProperty(source.0, kTISPropertyUnicodeKeyLayoutData) };
        if layout_data.is_null() {
            return Err("current macOS keyboard layout has no Unicode layout data".into());
        }

        // SAFETY: layout_data is a CFData owned by the retained input source and
        // remains valid until source is dropped after the scan.
        let layout = unsafe { CFDataGetBytePtr(layout_data) };
        if layout.is_null() {
            return Err("current macOS keyboard layout data is empty".into());
        }

        // SAFETY: LMGetKbdType has no arguments and returns the current physical
        // keyboard type used by UCKeyTranslate.
        let keyboard_type = unsafe { LMGetKbdType() } as u32;
        let keycode = find_keycode(|keycode| {
            let mut dead_key_state = 0;
            let mut chars = [0_u16; 4];
            let mut length = 0_usize;

            // SAFETY: layout points to valid UCKeyboardLayout bytes while source
            // is retained. All output pointers reference initialized local
            // storage of the declared sizes.
            let status = unsafe {
                UCKeyTranslate(
                    layout,
                    keycode,
                    UC_KEY_ACTION_DISPLAY,
                    COMMAND_MODIFIER_STATE,
                    keyboard_type,
                    UC_KEY_TRANSLATE_NO_DEAD_KEYS_MASK,
                    &mut dead_key_state,
                    chars.len(),
                    &mut length,
                    chars.as_mut_ptr(),
                )
            };

            status == 0 && length == 1 && chars[0] == u16::from(letter)
        })
        .ok_or_else(|| {
            format!(
                "could not map Cmd+{} in the current macOS keyboard layout",
                letter as char
            )
        })?;

        Ok(keycode)
    }

    fn command_key(letter: u8, ansi_keycode: u16) -> Key {
        match resolve_command_keycode(letter) {
            Ok(keycode) => {
                debug!(
                    "Resolved Cmd+{} for the active macOS layout to keycode {keycode}",
                    letter as char
                );
                Key::Other(u32::from(keycode))
            }
            Err(error) => {
                warn!(
                    "Could not resolve Cmd+{} for the active macOS layout ({error}); using ANSI keycode {ansi_keycode}",
                    letter as char
                );
                Key::Other(u32::from(ansi_keycode))
            }
        }
    }

    pub(super) fn command_v_key() -> Key {
        command_key(b'v', ANSI_V_KEYCODE)
    }

    pub(super) fn command_c_key() -> Key {
        command_key(b'c', ANSI_C_KEYCODE)
    }

    pub(super) fn command_z_key() -> Key {
        command_key(b'z', ANSI_Z_KEYCODE)
    }
}

#[cfg(target_os = "macos")]
pub use macos::{accessibility_selected_text, focus_target, wait_for_modifiers_released};

/// Wrapper for Enigo to store in Tauri's managed state.
/// Enigo is wrapped in a Mutex since it requires mutable access.
pub struct EnigoState(pub Mutex<Enigo>);

impl EnigoState {
    pub fn new() -> Result<Self, String> {
        let enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;
        Ok(Self(Mutex::new(enigo)))
    }
}

/// Get the current mouse cursor position using the managed Enigo instance.
/// Returns None if the state is not available or if getting the location fails.
pub fn get_cursor_position(app_handle: &AppHandle) -> Option<(i32, i32)> {
    let enigo_state = app_handle.try_state::<EnigoState>()?;
    let enigo = enigo_state.0.lock().ok()?;
    enigo.location().ok()
}

/// Sends a Ctrl+V or Cmd+V paste command using platform-specific virtual key codes.
/// This ensures the paste works regardless of keyboard layout (e.g., Russian, AZERTY, DVORAK).
/// Note: On Wayland, this may not work - callers should check for Wayland and use alternative methods.
///
/// `hold_ms` is how long the modifier stays held after the V click before being
/// released. Most applications read the modifier from the V event's flags and
/// need no hold at all, but applications that poll global keyboard state when
/// handling the key need the modifier to still be down — the hold insures
/// against those. Callers that can detect a failed chord (e.g. the
/// receipt-sequenced paste path) may use a much shorter hold.
pub fn send_paste_ctrl_v(enigo: &mut Enigo, hold_ms: u64) -> Result<(), String> {
    // Platform-specific key definitions
    #[cfg(target_os = "macos")]
    let (modifier_key, v_key_code) = (Key::Meta, macos::command_v_key());
    #[cfg(target_os = "windows")]
    let (modifier_key, v_key_code) = (Key::Control, Key::Other(0x56)); // VK_V
    #[cfg(target_os = "linux")]
    let (modifier_key, v_key_code) = (Key::Control, Key::Unicode('v'));

    // Press modifier + V
    enigo
        .key(modifier_key, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier key: {}", e))?;
    enigo
        .key(v_key_code, enigo::Direction::Click)
        .map_err(|e| format!("Failed to click V key: {}", e))?;

    std::thread::sleep(std::time::Duration::from_millis(hold_ms));

    enigo
        .key(modifier_key, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier key: {}", e))?;

    Ok(())
}

/// Sends Cmd+C / Ctrl+C so the app under the cursor copies its selection.
/// Read Aloud uses this to grab the selected text.
pub fn send_copy_ctrl_c(enigo: &mut Enigo) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let (modifier_key, c_key_code) = (Key::Meta, macos::command_c_key());
    #[cfg(target_os = "windows")]
    let (modifier_key, c_key_code) = (Key::Control, Key::Other(0x43)); // VK_C
    #[cfg(target_os = "linux")]
    let (modifier_key, c_key_code) = (Key::Control, Key::Unicode('c'));

    enigo
        .key(modifier_key, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier key: {}", e))?;
    let click = enigo
        .key(c_key_code, enigo::Direction::Click)
        .map_err(|e| format!("Failed to click C key: {}", e));
    std::thread::sleep(std::time::Duration::from_millis(50));
    // Always release the modifier, even if the C click failed.
    enigo
        .key(modifier_key, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier key: {}", e))?;
    click
}

/// Sends Cmd+Z / Ctrl+Z so the app under the cursor undoes its last edit.
/// Refine again uses it to put back the text before pasting a new try.
pub fn send_undo_ctrl_z(enigo: &mut Enigo) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let (modifier_key, z_key_code) = (Key::Meta, macos::command_z_key());
    #[cfg(target_os = "windows")]
    let (modifier_key, z_key_code) = (Key::Control, Key::Other(0x5A)); // VK_Z
    #[cfg(target_os = "linux")]
    let (modifier_key, z_key_code) = (Key::Control, Key::Unicode('z'));

    enigo
        .key(modifier_key, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier key: {}", e))?;
    let click = enigo
        .key(z_key_code, enigo::Direction::Click)
        .map_err(|e| format!("Failed to click Z key: {}", e));
    std::thread::sleep(std::time::Duration::from_millis(50));
    enigo
        .key(modifier_key, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier key: {}", e))?;
    click
}

/// Sends a Ctrl+Shift+V paste command.
/// This is commonly used in terminal applications on Linux to paste without formatting.
/// Note: On Wayland, this may not work - callers should check for Wayland and use alternative methods.
pub fn send_paste_ctrl_shift_v(enigo: &mut Enigo, hold_ms: u64) -> Result<(), String> {
    // Platform-specific key definitions
    #[cfg(target_os = "macos")]
    let (modifier_key, v_key_code) = (Key::Meta, macos::command_v_key());
    #[cfg(target_os = "windows")]
    let (modifier_key, v_key_code) = (Key::Control, Key::Other(0x56)); // VK_V
    #[cfg(target_os = "linux")]
    let (modifier_key, v_key_code) = (Key::Control, Key::Unicode('v'));

    // Press Ctrl/Cmd + Shift + V
    enigo
        .key(modifier_key, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier key: {}", e))?;
    enigo
        .key(Key::Shift, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press Shift key: {}", e))?;
    enigo
        .key(v_key_code, enigo::Direction::Click)
        .map_err(|e| format!("Failed to click V key: {}", e))?;

    std::thread::sleep(std::time::Duration::from_millis(hold_ms));

    enigo
        .key(Key::Shift, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release Shift key: {}", e))?;
    enigo
        .key(modifier_key, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier key: {}", e))?;

    Ok(())
}

/// Sends a Shift+Insert paste command (Windows and Linux only).
/// This is more universal for terminal applications and legacy software.
/// Note: On Wayland, this may not work - callers should check for Wayland and use alternative methods.
pub fn send_paste_shift_insert(enigo: &mut Enigo, hold_ms: u64) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let insert_key_code = Key::Other(0x2D); // VK_INSERT
    #[cfg(not(target_os = "windows"))]
    let insert_key_code = Key::Other(0x76); // XK_Insert (keycode 118 / 0x76, also used as fallback)

    // Press Shift + Insert
    enigo
        .key(Key::Shift, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press Shift key: {}", e))?;
    enigo
        .key(insert_key_code, enigo::Direction::Click)
        .map_err(|e| format!("Failed to click Insert key: {}", e))?;

    std::thread::sleep(std::time::Duration::from_millis(hold_ms));

    enigo
        .key(Key::Shift, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release Shift key: {}", e))?;

    Ok(())
}

/// Pastes text directly using the enigo text method.
/// This tries to use system input methods if possible, otherwise simulates keystrokes one by one.
pub fn paste_text_direct(enigo: &mut Enigo, text: &str) -> Result<(), String> {
    enigo
        .text(text)
        .map_err(|e| format!("Failed to send text directly: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{classify_focus, FocusTarget};

    #[test]
    fn only_clear_non_text_focus_counts_as_nowhere() {
        assert_eq!(classify_focus(None, false), FocusTarget::Nowhere);
        assert_eq!(classify_focus(Some("AXList"), false), FocusTarget::Nowhere);
        assert_eq!(
            classify_focus(Some("AXButton"), false),
            FocusTarget::Nowhere
        );
        assert_eq!(classify_focus(Some("AXTextArea"), false), FocusTarget::Text);
        // A web page's editable area reports as a group with a settable value.
        assert_eq!(classify_focus(Some("AXGroup"), true), FocusTarget::Text);
        // An app that hides its fields: paste anyway.
        assert_eq!(classify_focus(Some("AXWindow"), false), FocusTarget::Unsure);
        assert_eq!(
            classify_focus(Some("AXWebArea"), false),
            FocusTarget::Unsure
        );
        assert_eq!(classify_focus(Some(""), false), FocusTarget::Unsure);
    }
}
