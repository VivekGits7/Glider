pub mod common;
pub mod features;

pub use common::system::cli::CliArgs;
pub use common::utils::env_flag_enabled;
#[cfg(debug_assertions)]
use specta_typescript::{BigIntExportBehavior, Typescript};
use tauri_specta::{collect_commands, collect_events, Builder};

use env_filter::Builder as EnvFilterBuilder;
use features::history::service::HistoryManager;
pub use features::stt::coordinator::TranscriptionCoordinator;
use features::stt::models::ModelManager;
use features::stt::recorder::AudioRecordingManager;
use features::stt::transcription::TranscriptionManager;
use features::stt::transcription_jobs::TranscriptionJobManager;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::Arc;
use tauri::image::Image;

use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Listener, Manager};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_log::{Builder as LogBuilder, RotationStrategy, Target, TargetKind};

use crate::common::settings::get_settings;

// Global atomic to store the file log level filter
// We use u8 to store the log::LevelFilter as a number
pub static FILE_LOG_LEVEL: AtomicU8 = AtomicU8::new(log::LevelFilter::Debug as u8);

/// Whether Glider is logging right now. Off on every launch (the `--debug`
/// flag starts it on), so nothing is written to the log file or sent to the
/// window by default; the Debug page's Live logs Resume and Pause turn it on
/// and off (see `common::commands::set_logging`). While on, records at the
/// chosen level go to the log file and, via the `log://log` event, to the
/// live log viewer. The console target is not affected.
pub static LOGGING_ON: AtomicBool = AtomicBool::new(false);

fn level_filter_from_u8(value: u8) -> log::LevelFilter {
    match value {
        0 => log::LevelFilter::Off,
        1 => log::LevelFilter::Error,
        2 => log::LevelFilter::Warn,
        3 => log::LevelFilter::Info,
        4 => log::LevelFilter::Debug,
        5 => log::LevelFilter::Trace,
        _ => log::LevelFilter::Trace,
    }
}

fn build_console_filter() -> env_filter::Filter {
    let mut builder = EnvFilterBuilder::new();

    match std::env::var("RUST_LOG") {
        Ok(spec) if !spec.trim().is_empty() => {
            if let Err(err) = builder.try_parse(&spec) {
                log::warn!(
                    "Ignoring invalid RUST_LOG value '{}': {}. Falling back to info-level console logging",
                    spec,
                    err
                );
                builder.filter_level(log::LevelFilter::Info);
            }
        }
        _ => {
            builder.filter_level(log::LevelFilter::Info);
        }
    }

    builder.build()
}

fn show_main_window(app: &AppHandle) {
    if let Some(main_window) = app.get_webview_window("main") {
        if let Err(e) = main_window.unminimize() {
            log::error!("Failed to unminimize webview window: {}", e);
        }
        if let Err(e) = main_window.show() {
            log::error!("Failed to show webview window: {}", e);
        }
        if let Err(e) = main_window.set_focus() {
            log::error!("Failed to focus webview window: {}", e);
        }
        #[cfg(target_os = "macos")]
        {
            if let Err(e) = app.set_activation_policy(tauri::ActivationPolicy::Regular) {
                log::error!("Failed to set activation policy to Regular: {}", e);
            }
            // The Dock icon is back; make sure it is the one the setting picks.
            common::app_icon::apply(app);
        }
        return;
    }

    let webview_labels = app.webview_windows().keys().cloned().collect::<Vec<_>>();
    log::error!(
        "Main window not found. Webview labels: {:?}",
        webview_labels
    );
}

/// Choose the macOS activation policy the process *launches* with.
///
/// Must run between `build()` and `run()`: that is the only point where
/// `App::set_activation_policy` sets tao's initial policy, which
/// `applicationDidFinishLaunching` then applies directly. Calling the
/// `AppHandle` variant from `setup` (which Tauri runs on `RunEvent::Ready`,
/// i.e. after launch) is instead a runtime Regular → Accessory demotion of an
/// already-activated foreground app — the transition Apple documents as
/// unreliable, and what left a Dock icon behind for start-hidden and
/// login-item launches on macOS 26+ (#1787). Launching as Accessory avoids the
/// transition entirely; showing the window later promotes to Regular, which is
/// the supported direction.
///
/// Mirrors the show-window decision in `setup`: the app launches without a
/// Dock icon only when it will start hidden (setting or `--start-hidden`) AND a
/// tray icon is available (setting and not `--no-tray`). With no tray the Dock
/// icon stays as the only way back into the app (#903). Headless one-shot
/// runs are left alone.
#[cfg(target_os = "macos")]
fn apply_startup_activation_policy(app: &mut tauri::App, headless_mode: bool) {
    if headless_mode {
        return;
    }

    let cli_args = app.state::<CliArgs>().inner().clone();
    let settings = common::settings::get_settings(app.handle());

    let should_hide = settings.start_hidden || cli_args.start_hidden;
    let tray_available = settings.show_tray_icon && !cli_args.no_tray;

    if should_hide && tray_available {
        log::info!("Starting hidden with tray available: launching as Accessory (no Dock icon)");
        app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }
}

#[allow(unused_variables)]
fn should_force_show_permissions_window(app: &AppHandle) -> bool {
    #[cfg(target_os = "windows")]
    {
        let model_manager = app.state::<Arc<ModelManager>>();
        let has_downloaded_models = model_manager
            .get_available_models()
            .iter()
            .any(|model| model.is_downloaded);

        if !has_downloaded_models {
            return false;
        }

        let status = features::stt::commands::audio::get_windows_microphone_permission_status();
        if status.supported
            && status.overall_access == features::stt::commands::audio::PermissionAccess::Denied
        {
            log::info!(
                "Windows microphone permissions are denied; forcing main window visible for onboarding"
            );
            return true;
        }
    }

    false
}

fn initialize_core_logic(app_handle: &AppHandle) {
    // Note: Enigo (keyboard/mouse simulation) is NOT initialized here.
    // The frontend is responsible for calling the `initialize_enigo` command
    // after onboarding completes. This avoids triggering permission dialogs
    // on macOS before the user is ready.

    // Initialize the managers. The audio recorder receives the streaming router
    // explicitly, so always-on microphone startup can wire live-preview frames
    // even before Tauri state is populated.
    let model_manager =
        Arc::new(ModelManager::new(app_handle).expect("Failed to initialize model manager"));
    let transcription_manager = Arc::new(
        TranscriptionManager::new(app_handle, model_manager.clone())
            .expect("Failed to initialize transcription manager"),
    );
    let recording_manager = Arc::new(
        AudioRecordingManager::new(app_handle, transcription_manager.stream_router())
            .expect("Failed to initialize recording manager"),
    );
    let history_manager =
        Arc::new(HistoryManager::new(app_handle).expect("Failed to initialize history manager"));

    // Add managers to Tauri's managed state
    app_handle.manage(recording_manager.clone());
    app_handle.manage(model_manager.clone());
    app_handle.manage(transcription_manager.clone());
    app_handle.manage(history_manager.clone());
    app_handle.manage(common::tray::TrayState::new());
    app_handle.manage(TranscriptionJobManager::new(app_handle));
    app_handle.manage(Arc::new(
        features::tts::service::TtsManager::new(app_handle)
            .expect("Failed to initialize Read Aloud"),
    ));
    app_handle.manage(Arc::new(
        features::llm::service::LlmManager::new(app_handle).expect("Failed to initialize the LLM"),
    ));

    // Note: Shortcuts are NOT initialized here.
    // The frontend is responsible for calling the `initialize_shortcuts` command
    // after permissions are confirmed (on macOS) or after onboarding completes.
    // This matches the pattern used for Enigo initialization.

    // Set up signal handlers for toggling transcription. On Linux, SIGUSR1 is
    // deliberately not handled — it belongs to WebKitGTK's garbage collector
    // (#1660) — see signal_handle.rs.
    #[cfg(unix)]
    features::stt::signal_handle::setup_signal_handler(app_handle.clone());

    // The macOS activation policy for a start-hidden launch is applied before
    // the event loop runs (see `apply_startup_activation_policy`), not here:
    // by the time `setup` runs the app has already launched as a Regular
    // (Dock) app, and demoting it at runtime is unreliable (#1787).

    // Get the current theme to set the appropriate initial icon
    let initial_theme = common::tray::get_current_theme(app_handle);

    // Choose the appropriate initial icon based on theme
    let initial_icon_path =
        common::tray::get_icon_path(initial_theme, common::tray::TrayIconState::Idle, false);

    let mut tray_builder = TrayIconBuilder::new()
        .icon(
            Image::from_path(
                app_handle
                    .path()
                    .resolve(initial_icon_path, tauri::path::BaseDirectory::Resource)
                    .unwrap(),
            )
            .unwrap(),
        )
        .tooltip(common::tray::tray_tooltip())
        .icon_as_template(true);

    // Windows notification-area convention: left click opens the app, right click
    // shows the menu. Elsewhere (macOS menu bar, Linux) the menu stays on left click.
    #[cfg(target_os = "windows")]
    {
        tray_builder = tray_builder
            .show_menu_on_left_click(false)
            .on_tray_icon_event(|tray, event| {
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
                let opens_window = matches!(
                    event,
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } | TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    }
                );
                if opens_window {
                    show_main_window(tray.app_handle());
                }
            });
    }
    #[cfg(not(target_os = "windows"))]
    {
        tray_builder = tray_builder.show_menu_on_left_click(true);
    }

    let tray = tray_builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "settings" => {
                show_main_window(app);
            }
            "secure_input_warning" => {
                // Full explanation lives in the settings-window banner
                show_main_window(app);
            }
            "notice" => {
                show_main_window(app);
            }
            "check_updates" => {
                let settings = common::settings::get_settings(app);
                if common::settings::update_checks_effectively_enabled(&settings) {
                    show_main_window(app);
                    let _ = app.emit("check-for-updates", ());
                }
            }
            "copy_last_transcript" => {
                common::tray::copy_last_transcript(app);
            }
            "unload_model" => {
                let transcription_manager = app.state::<Arc<TranscriptionManager>>();
                if !transcription_manager.is_model_loaded() {
                    log::warn!("No model is currently loaded.");
                    return;
                }
                if let Err(e) = transcription_manager.ensure_model_unlocked() {
                    log::warn!("{}", e);
                    return;
                }
                transcription_manager.request_unload();
                log::info!("Model unloaded via tray.");
            }
            "cancel" => {
                use crate::common::utils::cancel_current_operation;

                // Use centralized cancellation that handles all operations
                cancel_current_operation(app);
            }
            "quit" => {
                app.exit(0);
            }
            id if id.starts_with("model_select:") => {
                let model_id = id.strip_prefix("model_select:").unwrap().to_string();
                let current_model = common::settings::get_settings(app).selected_model;
                if model_id == current_model {
                    return;
                }
                let app_clone = app.clone();
                std::thread::spawn(move || {
                    match features::stt::commands::models::switch_active_model(
                        &app_clone, &model_id,
                    ) {
                        Ok(()) => {
                            log::info!("Model switched to {} via tray.", model_id);
                        }
                        Err(e) => {
                            log::error!("Failed to switch model via tray: {}", e);
                        }
                    }
                    common::tray::update_tray_menu(&app_clone);
                });
            }
            id if id.starts_with("language_select:") => {
                let language = id.strip_prefix("language_select:").unwrap().to_string();
                if let Err(e) = common::shortcut::change_selected_language_setting(
                    app.clone(),
                    language.clone(),
                ) {
                    log::error!("Failed to switch language via tray: {}", e);
                    return;
                }
                log::info!("Language switched to {} via tray.", language);
                common::tray::rebuild_tray_menu(app);
            }
            _ => {}
        })
        .build(app_handle)
        .unwrap();
    app_handle.manage(tray);

    // Initialize tray menu with idle state
    common::tray::update_tray_menu(app_handle);

    // Apply show_tray_icon setting
    let settings = common::settings::get_settings(app_handle);
    if !settings.show_tray_icon {
        common::tray::set_tray_visibility(app_handle, false);
    }

    // Refresh tray menu when model state changes
    let app_handle_for_listener = app_handle.clone();
    app_handle.listen("model-state-changed", move |_| {
        common::tray::update_tray_menu(&app_handle_for_listener);
    });
    // A download or delete can change what the language submenu offers (the
    // language detector arriving makes Auto usable).
    for event in ["model-download-complete", "model-deleted"] {
        let app_handle_for_listener = app_handle.clone();
        app_handle.listen(event, move |_| {
            common::tray::update_tray_menu(&app_handle_for_listener);
        });
    }

    // Apply the autostart preference (SMAppService login item on macOS 13+,
    // tauri-plugin-autostart elsewhere)
    common::system::autostart::apply_autostart(app_handle, settings.autostart_enabled);

    // Create the recording overlay window (hidden by default)
    common::utils::create_recording_overlay(app_handle);
}

#[tauri::command]
#[specta::specta]
fn trigger_update_check(app: AppHandle) -> Result<(), String> {
    let settings = common::settings::get_settings(&app);
    if !common::settings::update_checks_effectively_enabled(&settings) {
        return Ok(());
    }
    app.emit("check-for-updates", ())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
fn show_main_window_command(app: AppHandle) -> Result<(), String> {
    show_main_window(&app);
    Ok(())
}

/// Opens Models on `tab` (the overlay's "Get a voice").
#[tauri::command]
#[specta::specta]
fn open_models_tab(app: AppHandle, tab: String) {
    show_main_window(&app);
    let _ = app.emit_to("main", "open-models", tab);
}

/// Convert an unexpected panic on the headless worker into a normal CLI
/// failure. Without this guard the Tauri event loop remains alive after the
/// worker exits, leaving `--transcribe-file` hung indefinitely.
fn run_headless_guarded<F>(operation: F) -> i32
where
    F: FnOnce() -> i32,
{
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(operation)) {
        Ok(code) => code,
        Err(payload) => {
            let message = if let Some(message) = payload.downcast_ref::<&str>() {
                (*message).to_string()
            } else if let Some(message) = payload.downcast_ref::<String>() {
                message.clone()
            } else {
                "unknown panic".to_string()
            };
            eprintln!("error: headless transcription panicked: {message}");
            1
        }
    }
}

#[cfg(test)]
mod headless_guard_tests {
    use super::run_headless_guarded;

    #[test]
    fn preserves_normal_exit_codes() {
        assert_eq!(run_headless_guarded(|| 2), 2);
    }

    #[test]
    fn converts_worker_panics_to_runtime_failures() {
        assert_eq!(run_headless_guarded(|| panic!("simulated failure")), 1);
    }
}

/// Headless one-shot transcription for the `--transcribe-file` / `--list-devices`
/// path. Drives the same `TranscriptionManager::transcribe` the app uses; no
/// mic, no VAD, no download. Returns a process exit code (0 ok, 1 runtime
/// failure, 2 bad input/usage).
fn run_headless_transcription(app: &AppHandle, args: &CliArgs) -> i32 {
    use std::time::Instant;

    // --list-devices: print registered compute devices (with indices) and exit.
    // Useful on multi-GPU machines to discover the index for --device-index.
    if args.list_devices {
        let tm = app.state::<Arc<TranscriptionManager>>();
        let devices = match crate::features::stt::transcription::describe_compute_devices(&tm) {
            Ok(devices) => devices,
            Err(e) => {
                eprintln!("error: {}", e);
                return 1;
            }
        };
        if devices.is_empty() {
            println!("No transcribe-cpp compute devices registered.");
        } else {
            println!("transcribe-cpp compute devices:");
            for d in &devices {
                println!("  {}", d);
            }
        }
        if args.transcribe_file.is_none() {
            return 0;
        }
    }

    // --list-models: print the model registry (catalog + on-disk + custom) with
    // their ids — the same ids `--model` accepts — then exit. `--json` emits the
    // full ModelInfo array for scripting.
    if args.list_models {
        let model_manager = app.state::<Arc<ModelManager>>();
        let models = model_manager.get_available_models();
        if args.json {
            match serde_json::to_string_pretty(&models) {
                Ok(s) => println!("{}", s),
                Err(e) => {
                    eprintln!("error: failed to serialize models: {}", e);
                    return 1;
                }
            }
        } else if models.is_empty() {
            println!("No models available.");
        } else {
            println!("Available models (✓ = installed):");
            let width = models.iter().map(|m| m.id.len()).max().unwrap_or(0);
            for m in &models {
                let mark = if m.is_downloaded { "✓" } else { " " };
                let rec = if m.is_recommended {
                    "  [recommended]"
                } else {
                    ""
                };
                println!(
                    "  {}  {:<width$}  {}{}",
                    mark,
                    m.id,
                    m.name,
                    rec,
                    width = width
                );
            }
        }
        if args.transcribe_file.is_none() {
            return 0;
        }
    }

    let Some(wav) = args.transcribe_file.clone() else {
        return 0;
    };

    // read_wav_samples reads 16-bit int samples and does no validation; the app
    // only ever saves 16 kHz mono 16-bit PCM, so reject anything else rather than
    // transcribe garbage / mis-time / mis-decode.
    match hound::WavReader::open(&wav) {
        Ok(reader) => {
            let spec = reader.spec();
            if spec.sample_rate != 16_000
                || spec.channels != 1
                || spec.bits_per_sample != 16
                || spec.sample_format != hound::SampleFormat::Int
            {
                eprintln!(
                    "error: expected 16 kHz mono 16-bit PCM WAV, got {} Hz / {} ch / {}-bit {:?}",
                    spec.sample_rate, spec.channels, spec.bits_per_sample, spec.sample_format
                );
                return 2;
            }
        }
        Err(e) => {
            eprintln!("error: cannot open {}: {}", wav.display(), e);
            return 2;
        }
    }

    let samples = match crate::features::stt::processing::read_wav_samples(&wav) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error: failed to read {}: {}", wav.display(), e);
            return 2;
        }
    };
    let audio_secs = samples.len() as f64 / 16_000.0;

    let tm = app.state::<Arc<TranscriptionManager>>();

    let model_id = args
        .model
        .clone()
        .unwrap_or_else(|| get_settings(app).selected_model);
    if model_id.is_empty() {
        eprintln!("error: no model selected (pass --model or pick one in the app)");
        return 2;
    }

    // --device-index hard-selects a compute device by its --list-devices registry
    // index (transcribe-cpp / whisper-family models only; not persisted). Omit it
    // to use the persisted accelerator setting.
    let device_index = args.device_index;
    let requested_device = match device_index {
        Some(idx) => format!("index {}", idx),
        None => "settings".to_string(),
    };

    // Cold load (timed).
    let load_start = Instant::now();
    if let Err(e) = tm.load_model_with_device(&model_id, device_index) {
        eprintln!("error: load_model('{}') failed: {}", model_id, e);
        return 1;
    }
    let load_ms = load_start.elapsed().as_millis() as u64;
    let bound_backend = tm.current_backend();

    let runs = args.repeat.unwrap_or(1).max(1);
    let mut times_ms: Vec<u64> = Vec::new();
    let mut text = String::new();
    for i in 0..runs {
        // If the model's unload-timeout is "Immediately", transcribe() unloads
        // the engine after each run; reload (untimed) so repeats keep working
        // and the inference timing below stays clean.
        if !tm.is_model_loaded() {
            if let Err(e) = tm.load_model_with_device(&model_id, device_index) {
                eprintln!("error: reload before run {} failed: {}", i + 1, e);
                return 1;
            }
        }
        let t = Instant::now();
        match tm.transcribe(samples.clone()) {
            Ok(out) => text = out,
            Err(e) => {
                eprintln!("error: transcribe failed: {}", e);
                return 1;
            }
        }
        times_ms.push(t.elapsed().as_millis() as u64);
    }
    let best_ms = times_ms.iter().copied().min().unwrap_or(0);
    let rtf = if best_ms > 0 {
        audio_secs / (best_ms as f64 / 1000.0)
    } else {
        0.0
    };

    if args.json {
        println!(
            "{}",
            serde_json::json!({
                "model": model_id,
                "requested_device": requested_device,
                "bound_backend": bound_backend,
                "audio_secs": audio_secs,
                "load_ms": load_ms,
                "transcribe_ms": times_ms,
                "best_ms": best_ms,
                "rtf": rtf,
                "text": text,
            })
        );
    } else {
        println!(
            "model={} device={} backend={} audio={:.2}s load={}ms best={}ms rtf={:.2}x",
            model_id,
            requested_device,
            bound_backend.as_deref().unwrap_or("?"),
            audio_secs,
            load_ms,
            best_ms,
            rtf,
        );
        println!("text: {}", text);
    }
    0
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// Runs this process as a model worker when it was started as one (see
/// `common::worker_kit`), returning its exit code. Checked in `main` before
/// CLI parsing, Tauri, or single-instance handling.
pub fn run_worker_if_requested() -> Option<i32> {
    let flag = std::env::args_os().nth(1)?;
    if flag == features::stt::worker::WORKER_FLAG {
        return Some(features::stt::worker::run_worker());
    }
    if flag == features::tts::worker::WORKER_FLAG {
        return Some(features::tts::worker::run());
    }
    if flag == features::llm::worker::WORKER_FLAG {
        return Some(features::llm::worker::run());
    }
    None
}

pub fn run(cli_args: CliArgs) {
    // Workers run this very file; note which one it is before an upgrade can
    // replace it (see `worker_kit::process::worker_exe`).
    common::worker_kit::process::record_launched_exe();
    // Avoid ggml-metal residency-set teardown assertions when a native engine
    // outlives the Tauri shutdown sequence (#1902). This must happen before
    // transcribe-cpp initializes its Metal device. Advanced users can restore
    // upstream residency behavior with GLIDER_METAL_RESIDENCY=1.
    #[cfg(target_os = "macos")]
    if std::env::var("GLIDER_METAL_RESIDENCY").as_deref() == Ok("1") {
        // ggml treats GGML_METAL_NO_RESIDENCY as presence-based, so remove an
        // inherited value as well when explicitly opting back in.
        std::env::remove_var("GGML_METAL_NO_RESIDENCY");
    } else {
        std::env::set_var("GGML_METAL_NO_RESIDENCY", "1");
    }

    // Pin glibc's dynamic mmap threshold before the first large allocation,
    // so per-dictation transient buffers are returned to the OS on free
    // instead of accumulating in malloc arenas (#1792). No-op off Linux/glibc.
    common::memory::init_allocator();

    // Detect portable mode before anything else
    common::system::portable::init();

    // Parse console logging directives from RUST_LOG, falling back to info-level logging
    // when the variable is unset
    let console_filter = build_console_filter();

    let specta_builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            common::shortcut::change_binding,
            common::shortcut::reset_binding,
            common::shortcut::change_hold_threshold_ms_setting,
            common::shortcut::change_audio_feedback_setting,
            common::shortcut::change_audio_feedback_volume_setting,
            common::shortcut::change_sound_theme_setting,
            common::shortcut::change_theme_setting,
            common::shortcut::change_app_icon_setting,
            common::shortcut::change_start_hidden_setting,
            common::shortcut::change_autostart_setting,
            common::shortcut::change_translate_to_english_setting,
            common::shortcut::change_selected_language_setting,
            common::shortcut::change_spoken_languages_setting,
            common::shortcut::change_overlay_position_setting,
            common::shortcut::change_overlay_style_setting,
            common::shortcut::change_debug_mode_setting,
            common::shortcut::change_word_correction_threshold_setting,
            common::shortcut::change_extra_recording_buffer_setting,
            common::shortcut::change_language_detection_setting,
            common::shortcut::change_language_detection_window_setting,
            common::shortcut::change_paste_delay_ms_setting,
            common::shortcut::change_paste_delay_after_ms_setting,
            common::shortcut::change_reliable_paste_setting,
            common::shortcut::change_paste_method_setting,
            common::shortcut::get_available_typing_tools,
            common::shortcut::change_typing_tool_setting,
            common::shortcut::change_external_script_path_setting,
            common::shortcut::change_clipboard_handling_setting,
            common::shortcut::change_auto_submit_setting,
            common::shortcut::change_auto_submit_key_setting,
            common::shortcut::change_post_process_enabled_setting,
            common::shortcut::change_experimental_enabled_setting,
            common::shortcut::change_post_process_base_url_setting,
            common::shortcut::change_post_process_api_format_setting,
            common::shortcut::change_post_process_api_key_setting,
            common::shortcut::change_post_process_model_setting,
            common::shortcut::set_post_process_provider,
            common::shortcut::fetch_post_process_models,
            common::shortcut::fn_key::fn_key_has_system_action,
            common::shortcut::fn_key::disable_fn_key_system_action,
            common::shortcut::fn_key::open_keyboard_settings,
            common::shortcut::update_custom_words,
            common::shortcut::suspend_all_bindings,
            common::shortcut::resume_all_bindings,
            common::shortcut::change_mute_while_recording_setting,
            common::shortcut::change_append_trailing_space_setting,
            common::shortcut::change_lazy_stream_close_setting,
            common::shortcut::change_vad_enabled_setting,
            common::shortcut::change_long_form_chunking_setting,
            common::shortcut::change_vad_backend_setting,
            common::shortcut::change_filler_word_removal_enabled_setting,
            common::shortcut::change_chinese_script_setting,
            common::shortcut::change_app_language_setting,
            common::shortcut::change_update_checks_setting,
            common::shortcut::change_show_whats_new_on_update_setting,
            common::shortcut::change_whats_new_last_seen_version_setting,
            common::shortcut::change_keyboard_implementation_setting,
            common::shortcut::change_show_tray_icon_setting,
            common::shortcut::change_transcribe_accelerator_setting,
            common::shortcut::change_transcribe_gpu_device,
            common::shortcut::get_available_accelerators,
            common::shortcut::handy_keys::start_handy_keys_recording,
            common::shortcut::handy_keys::stop_handy_keys_recording,
            common::shortcut::secure_input::get_secure_input_status,
            common::shortcut::secure_input::run_keyboard_diagnostic,
            trigger_update_check,
            show_main_window_command,
            open_models_tab,
            common::commands::cancel_operation,
            common::commands::is_portable,
            common::commands::is_update_checks_locked,
            common::commands::get_app_dir_path,
            common::commands::get_app_settings,
            common::commands::get_default_settings,
            common::commands::get_log_dir_path,
            common::commands::set_log_level,
            common::commands::set_logging,
            common::commands::is_logging,
            common::commands::open_recordings_folder,
            common::commands::open_log_dir,
            common::commands::open_app_data_dir,
            common::commands::open_models_dir,
            common::commands::check_apple_intelligence_available,
            common::commands::reset_accessibility_permission,
            common::commands::finish_recording,
            common::commands::copy_nowhere_text,
            common::commands::initialize_enigo,
            common::commands::initialize_shortcuts,
            common::commands::complete_onboarding,
            features::stt::commands::models::get_available_models,
            features::stt::commands::models::get_model_info,
            features::stt::commands::models::download_model,
            features::stt::commands::models::download_language_detector,
            features::stt::commands::models::is_language_detector_downloaded,
            features::stt::commands::models::delete_model,
            features::stt::commands::models::get_retired_models,
            features::stt::commands::models::delete_retired_model,
            features::stt::commands::models::cancel_download,
            features::stt::commands::models::set_active_model,
            features::stt::commands::models::get_current_model,
            features::stt::commands::models::get_transcription_model_status,
            features::stt::commands::models::rescan_local_models,
            features::stt::commands::audio::update_microphone_mode,
            features::stt::commands::audio::get_windows_microphone_permission_status,
            features::stt::commands::audio::open_microphone_privacy_settings,
            features::stt::commands::audio::get_available_microphones,
            features::stt::commands::audio::set_selected_microphone,
            features::stt::commands::audio::get_available_output_devices,
            features::stt::commands::audio::set_selected_output_device,
            features::stt::commands::audio::play_test_sound,
            features::stt::commands::audio::check_custom_sounds,
            features::stt::commands::audio::set_clamshell_microphone,
            features::stt::commands::audio::is_recording,
            features::stt::commands::audio::get_microphone_channels,
            features::stt::commands::audio::set_selected_channel,
            features::stt::commands::audio::change_airpods_mode_setting,
            features::stt::commands::transcription::set_model_unload_timeout,
            features::stt::commands::transcription::get_model_load_status,
            features::stt::commands::transcription::preload_model,
            features::stt::commands::transcription::get_language_status,
            features::history::commands::get_history_entries,
            features::history::commands::toggle_history_entry_saved,
            features::history::commands::get_audio_file_path,
            features::history::commands::delete_history_entry,
            features::history::commands::retry_history_entry_transcription,
            features::history::commands::cancel_history_entry_transcription,
            features::history::commands::transcribe_file,
            features::history::commands::update_history_limit,
            features::history::commands::update_recording_retention_period,
            features::history::commands::get_read_aloud_history,
            features::history::commands::delete_read_aloud_entry,
            features::history::commands::get_rewrite_history,
            features::history::commands::delete_rewrite_entry,
            features::history::commands::toggle_read_aloud_saved,
            features::history::commands::toggle_rewrite_saved,
            features::insights::commands::get_usage_stats,
            common::commands::get_user_name,
            common::commands::get_model_memory,
            common::system::clamshell::is_laptop,
            common::notices::get_active_notices,
            features::tts::commands::get_tts_models,
            features::tts::commands::download_tts_model,
            features::tts::commands::delete_tts_model,
            features::tts::commands::cancel_tts_download,
            features::tts::commands::toggle_reading_pause,
            features::tts::commands::skip_reading,
            features::tts::commands::change_reading_speed,
            features::tts::commands::speak_voice_sample,
            features::insights::commands::get_insights,
            features::tts::commands::speak_text,
            features::tts::commands::speak_demo,
            features::tts::commands::play_demo_clip,
            features::tts::commands::stop_demo_clip,
            features::tts::commands::stop_speaking,
            features::tts::commands::is_speaking,
            features::tts::commands::change_tts_model_setting,
            features::tts::commands::change_tts_live_preview_setting,
            features::tts::commands::change_tts_language_setting,
            features::tts::commands::change_tts_voice_setting,
            features::tts::commands::change_tts_speed_setting,
            features::llm::commands::get_llm_models,
            features::llm::commands::download_llm_model,
            features::llm::commands::cancel_llm_download,
            features::llm::commands::delete_llm_model,
            features::llm::commands::set_llm_model,
            features::llm::rewrite::show_refine_changes,
            features::llm::rewrite::hide_refine_overlay,
            features::llm::rewrite::copy_refine_result,
            features::llm::rewrite::refine_again_command,
            features::llm::rewrite::get_rewrite_usage,
            features::llm::rewrite::run_rewrite,
            features::llm::rewrite::create_rewrite,
            features::llm::rewrite::save_rewrite,
            features::llm::rewrite::delete_rewrite,
            features::llm::rewrite::reset_rewrite,
            features::llm::rewrite::reset_rewrites,
            features::llm::rewrite::change_rewrite_dictation_setting,
            features::llm::rewrite::change_llm_use_provider_setting,
            common::notices::dismiss_notice,
            common::notices::dismiss_overlay_notice,
        ])
        .events(collect_events![
            features::history::service::HistoryUpdatePayload,
            features::stt::transcription_jobs::TranscriptionJob,
            features::stt::transcription::StreamTextEvent,
            features::stt::transcription::StreamPhaseEvent,
            features::stt::coordinator::RecordingStateEvent,
            features::stt::actions::TranscriptionCompleteEvent,
            common::notices::NoticesChanged,
        ]);

    #[cfg(debug_assertions)] // <- Only export on non-release builds
    specta_builder
        .export(
            Typescript::default().bigint(BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    let invoke_handler = specta_builder.invoke_handler();

    // The headless path must run as its own instance (see the single-instance
    // note below), not forward to an already-running app.
    let headless_mode =
        cli_args.transcribe_file.is_some() || cli_args.list_devices || cli_args.list_models;

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .device_event_filter(tauri::DeviceEventFilter::Always)
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            LogBuilder::new()
                .level(log::LevelFilter::Trace) // Set to most verbose level globally
                .max_file_size(500_000)
                .rotation_strategy(RotationStrategy::KeepOne)
                .clear_targets()
                .targets([
                    // Console output respects RUST_LOG environment variable. In
                    // headless mode (--transcribe-file/--list-devices/--list-models)
                    // stdout carries only the result (JSON or plain), so send console
                    // logs to stderr instead to keep stdout clean for CI parsing.
                    Target::new(if headless_mode {
                        TargetKind::Stderr
                    } else {
                        TargetKind::Stdout
                    })
                    .filter({
                        let console_filter = console_filter.clone();
                        move |metadata| console_filter.enabled(metadata)
                    }),
                    // File logs: only while logging is on, at the user's level.
                    Target::new(
                        if let Some(data_dir) = common::system::portable::data_dir() {
                            TargetKind::Folder {
                                path: data_dir.join("logs"),
                                file_name: Some("glider".into()),
                            }
                        } else {
                            TargetKind::LogDir {
                                file_name: Some("glider".into()),
                            }
                        },
                    )
                    .filter(|metadata| {
                        LOGGING_ON.load(Ordering::Relaxed)
                            && metadata.level()
                                <= level_filter_from_u8(FILE_LOG_LEVEL.load(Ordering::Relaxed))
                    }),
                    // The same records, streamed to the window (the `log://log`
                    // event) for the Debug page's live log viewer.
                    Target::new(TargetKind::Webview).filter(|metadata| {
                        LOGGING_ON.load(Ordering::Relaxed)
                            && metadata.level()
                                <= level_filter_from_u8(FILE_LOG_LEVEL.load(Ordering::Relaxed))
                    }),
                ])
                .build(),
        );

    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    // Single-instance forwards CLI args to an already-running Glider and exits.
    // That would make the headless path
    // (--transcribe-file/--list-devices/--list-models) a silent no-op whenever the
    // app is already open, so skip it in headless mode and run a standalone
    // instance instead.
    if !headless_mode {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.iter().any(|a| a == "--toggle-transcription") {
                features::stt::signal_handle::send_transcription_input(app, "transcribe", "CLI");
            } else if args.iter().any(|a| a == "--toggle-post-process") {
                features::stt::signal_handle::send_transcription_input(
                    app,
                    "transcribe_with_post_process",
                    "CLI",
                );
            } else if args.iter().any(|a| a == "--cancel") {
                crate::common::utils::cancel_current_operation(app);
            } else {
                // A second process was launched without remote-control flags
                // (e.g. the binary run from a shell). On macOS, relaunching the
                // bundle from Spotlight/Finder/Dock does not start a process —
                // it arrives as RunEvent::Reopen below — but treat this the
                // same way: raise the window and recreate a possibly vanished
                // tray icon (#1948).
                #[cfg(target_os = "macos")]
                common::tray::recreate_tray_icon(app);
                show_main_window(app);
            }
        }));
    }

    #[allow(unused_mut)]
    let mut app = builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(common::system::languages::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_macos_permissions::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .manage(cli_args.clone())
        .manage(common::notices::NoticeStore::default())
        .setup(move |app| {
            #[cfg(target_os = "windows")]
            log::info!(
                "Vulkan layer policy: VK_LOADER_LAYERS_DISABLE={:?}, GLIDER_KEEP_VULKAN_IMPLICIT_LAYERS={}",
                std::env::var_os("VK_LOADER_LAYERS_DISABLE"),
                common::utils::env_flag_enabled("GLIDER_KEEP_VULKAN_IMPLICIT_LAYERS"),
            );
            common::system::languages::log_system_languages();

            specta_builder.mount_events(app);

            // Headless one-shot path (`--transcribe-file` / `--list-devices` /
            // `--list-models`): initialize only what transcription needs — the
            // store/paths plugins, the model + transcription managers, and the
            // transcribe-cpp backend + accelerator settings — then run on a worker
            // thread and exit. Deliberately skips the window, tray, overlay, audio
            // recorder (so it never opens the mic, even with always_on_microphone),
            // signal handlers, and autostart that initialize_core_logic sets up.
            if headless_mode {
                let app_handle = app.handle().clone();
                let model_manager = Arc::new(
                    ModelManager::new(&app_handle).expect("Failed to initialize model manager"),
                );
                let transcription_manager = Arc::new(
                    TranscriptionManager::new(&app_handle, model_manager.clone())
                        .expect("Failed to initialize transcription manager"),
                );
                features::stt::transcription::report_compute_devices(&transcription_manager);
                app_handle.manage(model_manager);
                app_handle.manage(transcription_manager);

                let handle = app_handle.clone();
                let args = cli_args.clone();
                std::thread::spawn(move || {
                    let code = run_headless_guarded(|| run_headless_transcription(&handle, &args));
                    // Drop the loaded engine before exit so its transcription
                    // worker is told to shut down cleanly.
                    if let Some(tm) = handle.try_state::<Arc<TranscriptionManager>>() {
                        let _ = tm.unload_model();
                    }
                    // process::exit (not app.exit, which exits 0 regardless) so the
                    // exit code propagates to the shell for CI gating. Flush first
                    // since process::exit runs no destructors / buffer flushes.
                    use std::io::Write;
                    let _ = std::io::stdout().flush();
                    let _ = std::io::stderr().flush();
                    std::process::exit(code);
                });
                return Ok(());
            }

            // Create main window programmatically so we can set data_directory
            // for portable mode (redirects WebView2 cache to portable Data dir)
            let mut win_builder =
                tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("/".into()))
                    .title("Glider")
                    .inner_size(common::utils::MAIN_WINDOW_SIZE.0, common::utils::MAIN_WINDOW_SIZE.1)
                    .min_inner_size(common::utils::MAIN_WINDOW_MIN_SIZE.0, common::utils::MAIN_WINDOW_MIN_SIZE.1)
                    .resizable(true)
                    .maximizable(true)
                    .visible(false);

            // macOS: no title bar. The window buttons sit in the sidebar's top
            // row (14px down, 30px tall; wry puts the buttons' centre at
            // y - 2, so y = 31 centres them on it). The window is see-through
            // with the system's sidebar material behind it, which the sidebar's
            // 92% tint lets show; every screen paints its own background.
            #[cfg(target_os = "macos")]
            {
                win_builder = win_builder
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .hidden_title(true)
                    .traffic_light_position(tauri::LogicalPosition::new(18.0, 31.0))
                    .transparent(true)
                    .effects(
                        tauri::window::EffectsBuilder::new()
                            .effect(tauri::window::Effect::Sidebar)
                            .state(tauri::window::EffectState::FollowsWindowActiveState)
                            .build(),
                    );
            }

            if let Some(data_dir) = common::system::portable::data_dir() {
                win_builder = win_builder.data_directory(data_dir.join("webview"));
            }

            let main_window = win_builder.build()?;

            // Open large, as the design draws it, but never past a small screen.
            if let Ok(Some(monitor)) = main_window.current_monitor() {
                let area = monitor
                    .work_area()
                    .size
                    .to_logical::<f64>(monitor.scale_factor());
                let (width, height) = common::utils::fit_main_window(area.width, area.height);
                let _ = main_window.set_size(tauri::LogicalSize::new(width, height));
            }
            let _ = main_window.center();

            // Disable WebView2 browser accelerators (F5, F6, Ctrl+F, F12, ...).
            // A settings window has no use for them, and pressing F6 while
            // recording a shortcut was reported to turn the whole window white
            // (cjpais/Handy#1940), likely by triggering WebView2 focus cycling.
            // DevTools stays enabled; only the F12 accelerator is lost.
            #[cfg(target_os = "windows")]
            {
                let _ = main_window.with_webview(|webview| unsafe {
                    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
                    use windows::core::Interface;

                    let result = webview
                        .controller()
                        .CoreWebView2()
                        .and_then(|core| core.Settings())
                        .and_then(|settings| settings.cast::<ICoreWebView2Settings3>())
                        .and_then(|settings| settings.SetAreBrowserAcceleratorKeysEnabled(false));

                    if let Err(error) = result {
                        log::warn!("Failed to disable WebView2 browser accelerators: {error}");
                    }
                });
            }

            let mut settings = get_settings(app.handle());

            // Apply the persisted appearance theme to the native title bar before
            // the window is shown, so it matches the in-app palette without a flash
            // of the wrong theme. See `apply_window_theme` for what this does per
            // platform.
            #[cfg(any(target_os = "windows", target_os = "macos"))]
            common::shortcut::apply_window_theme(app.handle(), settings.theme);
            common::app_icon::apply(app.handle());

            // CLI --debug flag overrides debug_mode and log level (runtime-only, not persisted)
            if cli_args.debug {
                settings.debug_mode = true;
                settings.log_level = common::settings::LogLevel::Trace;
            }

            let tauri_log_level: tauri_plugin_log::LogLevel = settings.log_level.into();
            let file_log_level: log::Level = tauri_log_level.into();
            // Store the file log level in the atomic for the filter to use
            FILE_LOG_LEVEL.store(file_log_level.to_level_filter() as u8, Ordering::Relaxed);
            // Logging stays off until it is resumed, except under `--debug`.
            LOGGING_ON.store(cli_args.debug, Ordering::Relaxed);
            let app_handle = app.handle().clone();
            app.manage(TranscriptionCoordinator::new(app_handle.clone()));

            initialize_core_logic(&app_handle);

            // Secure Input monitor (macOS): detects stuck secure input that
            // silently blocks keyed shortcuts, warns the user, and activates
            // the Carbon fallback. See secure_input.rs and issue #1578.
            common::shortcut::secure_input::init(&app_handle);

            // Populate the overlay-enabled cache from initial settings so the
            // audio path (common::overlay::emit_levels, called ~24 Hz during recording)
            // can do a single atomic load instead of reading the Tauri store.
            // Kept in sync by common::shortcut::change_overlay_style_setting.
            common::overlay::update_overlay_enabled_cache(
                settings.overlay_style != common::settings::OverlayStyle::None,
            );

            // Pre-warm GPU/accelerator enumeration on a background thread. The first
            // device listing opens the GPU, which on macOS loads ggml's Metal library
            // and compiles it when the system shader cache does not have it yet, so it
            // stays off the startup path. get_available_accelerators then enumerates
            // ORT execution providers and transcribe-cpp compute devices; without this
            // the cost is paid synchronously when the user first opens Advanced
            // settings, freezing the UI. The device list is kept by the
            // transcription engine and refreshed by every worker it starts that may
            // use the GPU (CPU-only workers can't see it).
            let devices_app_handle = app_handle.clone();
            std::thread::spawn(move || {
                let tm = devices_app_handle.state::<Arc<TranscriptionManager>>();
                crate::features::stt::transcription::report_compute_devices(&tm);
                let _ = crate::features::stt::transcription::get_available_accelerators(&tm);
            });

            // Hide tray icon if --no-tray was passed
            if cli_args.no_tray {
                common::tray::set_tray_visibility(&app_handle, false);
            }

            // Show main window only if not starting hidden.
            // CLI --start-hidden flag overrides the setting.
            // But if permission onboarding is required, always show the window.
            let should_hide = settings.start_hidden || cli_args.start_hidden;
            let should_force_show = should_force_show_permissions_window(&app_handle);

            // If start_hidden but tray is disabled, we must show the window
            // anyway. Without a tray icon, the dock is the only way back in.
            // Keep in sync with `apply_startup_activation_policy` (macOS).
            let tray_available = settings.show_tray_icon && !cli_args.no_tray;
            if should_force_show || !should_hide || !tray_available {
                show_main_window(&app_handle);
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _res = window.hide();

                #[cfg(target_os = "macos")]
                {
                    let settings = get_settings(window.app_handle());
                    let tray_visible =
                        settings.show_tray_icon && !window.app_handle().state::<CliArgs>().no_tray;
                    if tray_visible {
                        // Tray is available: hide the dock icon, app lives in the tray
                        let res = window
                            .app_handle()
                            .set_activation_policy(tauri::ActivationPolicy::Accessory);
                        if let Err(e) = res {
                            log::error!("Failed to set activation policy: {}", e);
                        }
                    }
                    // No tray: keep the dock icon visible so the user can reopen
                }
            }
            tauri::WindowEvent::ThemeChanged(theme) => {
                log::info!("Theme changed to: {:?}", theme);
                // Re-apply the current tray state with the new theme's icon set
                common::utils::refresh_tray_icon(window.app_handle());
                common::app_icon::apply(window.app_handle());
            }
            _ => {}
        })
        .invoke_handler(invoke_handler)
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Must sit between build() and run(): see the doc comment.
    #[cfg(target_os = "macos")]
    apply_startup_activation_policy(&mut app, headless_mode);

    // `app` is only used by the macOS arm.
    #[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
    app.run(|app, event| match &event {
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => {
            // Fired when the already-running bundle is launched again from
            // Spotlight/Finder or the Dock icon is clicked. If the settings
            // window is hidden, the user is likely looking for a tray icon
            // that vanished (#1948): recreate it. When the window is
            // already visible this is just a focus request and the tray is
            // left alone.
            let window_visible = app
                .get_webview_window("main")
                .and_then(|w| w.is_visible().ok())
                .unwrap_or(false);
            if !window_visible {
                common::tray::recreate_tray_icon(app);
            }
            show_main_window(app);
        }
        // No transcription teardown on exit: transcribe.cpp runs only in the
        // worker process, which exits by itself as soon as this process's end
        // of its stdin closes, even if it is hung. Waiting on an unload here
        // could block quitting behind a hung model load.
        _ => {}
    });
}
