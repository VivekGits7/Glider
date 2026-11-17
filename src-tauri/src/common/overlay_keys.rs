//! The overlay's keys on a Mac. While Read Aloud's player is on screen: F7
//! back, F8 play/pause, F9 forward (the media keys on the top row, or the
//! F-keys themselves with Fn) and Esc to stop. While a card or notice is on
//! screen (nowhere to type, See changes, Done, a notice): Esc closes it.
//!
//! One event tap, installed the first time the overlay shows. A key passes
//! through untouched unless the overlay it belongs to is showing; the ones
//! handled then are kept from other apps, so F8 doesn't also start Music and
//! Esc doesn't also reach the app underneath. Dictation's own Esc (cancel) is
//! the shortcut system's, so a recording's Esc always passes through here.

use crate::common::overlay;
use crate::features::tts::service::{restart_at, TtsManager};
use log::{debug, warn};
use objc2::encode::{Encoding, RefEncode};
use objc2::runtime::AnyObject;
use objc2::{class, msg_send};
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};
use std::sync::{Arc, OnceLock};
use tauri::{AppHandle, Manager};

#[repr(C)]
struct CGEvent {
    _private: [u8; 0],
}

// SAFETY: CGEventRef is a pointer to the opaque `__CGEvent` struct, which is
// how NSEvent's `eventWithCGEvent:` declares its argument.
unsafe impl RefEncode for CGEvent {
    const ENCODING_REF: Encoding = Encoding::Pointer(&Encoding::Struct("__CGEvent", &[]));
}

type EventRef = *mut CGEvent;
type TapCallback = extern "C" fn(*mut c_void, u32, EventRef, *mut c_void) -> EventRef;

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGEventTapCreate(
        tap: u32,
        place: u32,
        options: u32,
        events_of_interest: u64,
        callback: TapCallback,
        user_info: *mut c_void,
    ) -> *mut c_void;
    fn CGEventTapEnable(tap: *mut c_void, enable: bool);
    fn CGEventGetIntegerValueField(event: EventRef, field: u32) -> i64;
    fn CGEventGetFlags(event: EventRef) -> u64;
}

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFMachPortCreateRunLoopSource(
        allocator: *const c_void,
        port: *mut c_void,
        order: isize,
    ) -> *mut c_void;
    fn CFRunLoopGetCurrent() -> *mut c_void;
    fn CFRunLoopAddSource(run_loop: *mut c_void, source: *mut c_void, mode: *const c_void);
    fn CFRunLoopRun();
    static kCFRunLoopCommonModes: *const c_void;
}

const SESSION_TAP: u32 = 1;
const HEAD_INSERT: u32 = 0;
const TAP_DEFAULT: u32 = 0;
const KEY_DOWN: u32 = 10;
const KEY_UP: u32 = 11;
/// NX_SYSDEFINED: where the media keys arrive.
const SYSTEM_DEFINED: u32 = 14;
const TAP_DISABLED_BY_TIMEOUT: u32 = 0xFFFF_FFFE;
const TAP_DISABLED_BY_USER: u32 = 0xFFFF_FFFF;
const KEYCODE_FIELD: u32 = 9;
/// Shift, Control, Option, Command: a chord is someone else's shortcut.
const CHORD_FLAGS: u64 = 0x20000 | 0x40000 | 0x80000 | 0x100000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Action {
    Back,
    PlayPause,
    Forward,
    Stop,
    /// Esc on a card or notice.
    Close,
}

/// kVK_F7, kVK_F8, kVK_F9 and kVK_Escape.
fn key_action(keycode: i64) -> Option<Action> {
    match keycode {
        98 => Some(Action::Back),
        100 => Some(Action::PlayPause),
        101 => Some(Action::Forward),
        53 => Some(Action::Stop),
        _ => None,
    }
}

/// NX_KEYTYPE_PLAY, NEXT/FAST and PREVIOUS/REWIND.
fn media_action(key: i64) -> Option<Action> {
    match key {
        16 => Some(Action::PlayPause),
        17 | 19 => Some(Action::Forward),
        18 | 20 => Some(Action::Back),
        _ => None,
    }
}

/// A media key's `data1`: the key, and whether this is a fresh press (not a
/// release or an auto-repeat).
fn decode_media(data1: isize) -> (i64, bool) {
    let data1 = data1 as i64;
    let key = (data1 & 0xFFFF_0000) >> 16;
    let flags = data1 & 0xFFFF;
    let pressed = (flags & 0xFF00) >> 8 == 0xA && flags & 1 == 0;
    (key, pressed)
}

static APP: OnceLock<AppHandle> = OnceLock::new();
static TAP: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());
/// Set while the tap is installed or being installed; cleared if macOS
/// refuses it, so a later show tries again (e.g. after Accessibility is
/// granted).
static INSTALLED: AtomicBool = AtomicBool::new(false);

/// Installs the tap if it isn't yet. Cheap to call on every overlay show.
/// Needs Accessibility, which dictation already asks for.
pub fn ensure(app: &AppHandle) {
    if INSTALLED.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = APP.set(app.clone());
    {
        let spawned = std::thread::Builder::new()
            .name("read-aloud-keys".into())
            .spawn(|| {
                let mask = (1u64 << KEY_DOWN) | (1u64 << KEY_UP) | (1u64 << SYSTEM_DEFINED);
                // SAFETY: plain CoreGraphics/CoreFoundation calls; the port and
                // its source live for the rest of the process.
                unsafe {
                    let port = CGEventTapCreate(
                        SESSION_TAP,
                        HEAD_INSERT,
                        TAP_DEFAULT,
                        mask,
                        on_event,
                        std::ptr::null_mut(),
                    );
                    if port.is_null() {
                        warn!("Overlay keys are off: macOS refused the key tap (Accessibility?)");
                        INSTALLED.store(false, Ordering::SeqCst);
                        return;
                    }
                    TAP.store(port, Ordering::SeqCst);
                    let source = CFMachPortCreateRunLoopSource(std::ptr::null(), port, 0);
                    CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
                    CGEventTapEnable(port, true);
                    debug!("Overlay keys ready (F7/F8/F9, Esc)");
                    CFRunLoopRun();
                }
            });
        if let Err(e) = spawned {
            warn!("Overlay keys are off: {e}");
            INSTALLED.store(false, Ordering::SeqCst);
        }
    }
}

extern "C" fn on_event(
    _proxy: *mut c_void,
    kind: u32,
    event: EventRef,
    _: *mut c_void,
) -> EventRef {
    if kind == TAP_DISABLED_BY_TIMEOUT || kind == TAP_DISABLED_BY_USER {
        let port = TAP.load(Ordering::SeqCst);
        if !port.is_null() {
            // SAFETY: `port` is the live tap created in `ensure`.
            unsafe { CGEventTapEnable(port, true) };
        }
        return event;
    }
    let reading = overlay::is_reading_showing();
    if !reading && !overlay::is_closable_showing() {
        return event;
    }
    let (action, pressed) = match kind {
        KEY_DOWN | KEY_UP => {
            // SAFETY: `event` is the live keyboard event macOS handed us.
            let (keycode, flags) = unsafe {
                (
                    CGEventGetIntegerValueField(event, KEYCODE_FIELD),
                    CGEventGetFlags(event),
                )
            };
            if flags & CHORD_FLAGS != 0 {
                return event;
            }
            // SAFETY: as above.
            let repeat = unsafe { CGEventGetIntegerValueField(event, 8) } != 0;
            (key_action(keycode), kind == KEY_DOWN && !repeat)
        }
        SYSTEM_DEFINED => {
            let Some((key, pressed)) = media_key(event) else {
                return event;
            };
            (media_action(key), pressed)
        }
        _ => (None, false),
    };
    // A card or notice only takes Esc; the playback keys are the player's.
    let action = match action {
        Some(Action::Stop) if !reading => Some(Action::Close),
        Some(action) if reading => Some(action),
        _ => None,
    };
    let Some(action) = action else {
        return event;
    };
    if pressed {
        if let Some(app) = APP.get() {
            let app = app.clone();
            // Off the tap's thread: macOS disables a tap that answers slowly.
            std::thread::spawn(move || run(&app, action));
        }
    }
    std::ptr::null_mut()
}

/// The media key in a system-defined event, through NSEvent (its `data1`
/// isn't a CGEvent field).
fn media_key(event: EventRef) -> Option<(i64, bool)> {
    objc2::rc::autoreleasepool(|_| {
        // SAFETY: `event` is a live CGEvent; the NSEvent is autoreleased and
        // only read inside this pool.
        unsafe {
            let ns: *mut AnyObject = msg_send![class!(NSEvent), eventWithCGEvent: event];
            if ns.is_null() {
                return None;
            }
            let subtype: i16 = msg_send![ns, subtype];
            // NX_SUBTYPE_AUX_CONTROL_BUTTONS
            if subtype != 8 {
                return None;
            }
            let data1: isize = msg_send![ns, data1];
            Some(decode_media(data1))
        }
    })
}

fn run(app: &AppHandle, action: Action) {
    debug!("Overlay key: {action:?}");
    let tts = app.state::<Arc<TtsManager>>();
    match action {
        Action::Back => restart_at(app, |index| index.saturating_sub(1)),
        Action::PlayPause => {
            tts.toggle_pause();
        }
        Action::Forward => tts.skip_forward(),
        Action::Stop => {
            tts.stop_and_close();
        }
        Action::Close => overlay::close_by_key(app),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_key_presses_are_told_from_releases_and_repeats() {
        // NX_KEYTYPE_PLAY down, up, and a repeated down.
        assert_eq!(decode_media((16 << 16) | 0x0A00), (16, true));
        assert_eq!(decode_media((16 << 16) | 0x0B00), (16, false));
        assert_eq!(decode_media((16 << 16) | 0x0A01), (16, false));
    }

    #[test]
    fn the_top_row_maps_to_back_pause_forward() {
        assert_eq!(media_action(20), Some(Action::Back));
        assert_eq!(media_action(16), Some(Action::PlayPause));
        assert_eq!(media_action(19), Some(Action::Forward));
        assert_eq!(key_action(98), Some(Action::Back));
        assert_eq!(key_action(100), Some(Action::PlayPause));
        assert_eq!(key_action(101), Some(Action::Forward));
        assert_eq!(key_action(53), Some(Action::Stop));
        assert_eq!(key_action(0), None);
    }
}
