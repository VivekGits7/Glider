# AGENTS.md

This file provides guidance to AI coding assistants working with code in this repository.

## Development Commands

**Prerequisites:**

- [Rust](https://rustup.rs/) (latest stable)
- [Bun](https://bun.sh/) package manager

**Core Development:**

```bash
# Install dependencies
bun install

# Run in development mode
bun run tauri dev
# If cmake error on macOS:
CMAKE_POLICY_VERSION_MINIMUM=3.5 bun run tauri dev

# Build for production
bun run tauri build

# Frontend only development
bun run dev        # Start Vite dev server
bun run build      # Build frontend (TypeScript + Vite)
bun run preview    # Preview built frontend
```

**Linting and Formatting (run before committing):**

```bash
bun run lint              # ESLint for frontend
bun run lint:fix          # ESLint with auto-fix
bun run format            # Prettier + cargo fmt
bun run format:check      # Check formatting without changes
bun run format:frontend   # Prettier only
bun run format:backend    # cargo fmt only
```

**Model Setup (Required for Development):**

```bash
mkdir -p src-tauri/resources/models
curl -L -o src-tauri/resources/models/silero-vad-v6.2-F32.gguf https://huggingface.co/handy-computer/silero-vad-v6.2-gguf/resolve/main/silero-vad-v6.2-F32.gguf
```

For detailed platform-specific build setup, see [BUILD.md](BUILD.md).

## Architecture Overview

Glider is a cross-platform desktop speech-to-text application built with Tauri 2.x (Rust backend + React/TypeScript frontend).

### Folder rules

Both halves are split by feature: `stt` (Dictation), `tts` (Read Aloud), `llm` (Rewrite), `insights` and `history`. Code used by two or more features lives in `common/`. A new file goes in the feature it belongs to; it goes in `common/` only once a second feature needs it.

### Backend Structure (src-tauri/src/)

- `main.rs` - Entry point; dispatches the worker flag before starting the app
- `lib.rs` - Tauri setup: creates the managers and registers every command and event
- `features/` - One folder per feature. Each has `commands.rs` (Tauri commands the frontend calls), `service.rs` (the logic), `catalog.rs` (its model list), `actions.rs` (what its shortcut does) and, for model features, `worker/`
  - `stt/` - Dictation: `recorder.rs` (microphone), `coordinator.rs` (shortcut → record → transcribe), `transcription/` (pipeline), `models/` (catalog, downloads, GGUF probing), `processing/` (VAD, chunking, text cleanup, WAV I/O), `language/`, `output/` (clipboard, paste, typing, hook), `worker/` (transcribe.cpp worker process and its supervisor)
  - `tts/` - Read Aloud: `catalog.rs` (voices), `service.rs` (reading and playback), `commands.rs`, `actions.rs`, `worker/` (sherpa-onnx worker process)
  - `llm/` - Rewrite: `catalog.rs`, `service.rs` (talks to the LLM worker), `worker/` (candle `engine.rs` in its own process), `rewrite.rs` (Refine shortcuts), `provider.rs` (online providers), `apple.rs` (Apple Intelligence)
  - `history/`, `insights/` - `commands.rs` + `service.rs`
- `common/` - Shared by two or more features
  - `settings.rs` - All settings, saved as one store (keep it one file)
  - `notices.rs` - Reports background errors to the user (see [Error notices](#error-notices))
  - `overlay.rs`, `tray/`, `commands.rs` (app-level commands), `utils.rs`, `memory.rs`, `models_dir.rs`
  - `overlay_keys.rs` - macOS key tap for the overlay: Esc closes cards and notices; F7/F8/F9/Esc drive Read Aloud's player. Keys pass through unless that overlay is showing
  - `shortcut/` - Global shortcuts, the setting-change commands, `actions.rs` (the binding id → action registry), `fn_key.rs`, `secure_input.rs`
  - `audio/` - Playback shared by feedback sounds and Read Aloud: output devices, CPAL host, feedback sounds
  - `worker_kit/` - Shared plumbing for model worker processes: wire format, worker-side setup, `WorkerProcess` (app side), live memory
  - `system/` - `cli.rs`, `portable.rs`, `autostart.rs`, system languages, laptop detection, Linux WebKit renderer

### Frontend Structure (src/)

- `App.tsx` - Routing and the onboarding gate; `main.tsx` - Entry point
- `bindings.ts` - Auto-generated Tauri type bindings (via tauri-specta); must stay at this path
- `app/` - Window shell: `Sidebar`, `TopBar`, `LoadingScreen`, `footer/Footer.tsx` (only arranges the footer menus)
- `features/` - One folder per feature. Each has its page (`XxxPage.tsx`), `settings/` (its setting rows), `models/` (its Models page tab), `footer/` (its footer menu), `hooks/`, `store/` and `lib/`
  - `stt/`, `tts/`, `llm/` (incl. `provider/` for online providers), `history/`, `insights/`, `home/`
  - `models/` - The Models page tabs; each tab's table comes from its feature
  - `onboarding/` - First-run experience
  - `settings/` - The General, Advanced, About and Debug pages
  - `updates/` - Update checker and What's New
- `common/` - Shared by two or more features
  - `ui/`, `shared/`, `icons/` - Components
  - `notices/` - `notices.ts` (maps each notice code to its text), `noticeStore.ts` (the one place notices are handled), `NoticePanel.tsx` (the one place notices are drawn)
  - `settings/` - `useSettings`, `settingsStore`, `ShortcutInput`
  - `hooks/`, `lib/` - Shared hooks and helpers
- `overlay/` - Recording overlay window entry point (Vite reads `overlay/index.html`)
- `i18n/` - Translations (`check:translations` expects this path)

Imports inside one feature (or inside `common/` or `app/`) are relative. Imports that cross into another area use `@/`.

### Model workers

No model runs in the app process. Speech (`--transcribe-worker`), voice (`--tts-worker`) and LLM (`--llm-worker`) models each run in their own worker: this executable started with that flag, dispatched in `lib.rs::run_worker_if_requested` before anything else starts. A worker lives only while its model is loaded; unloading (idle, delete, or a switch) ends the process and returns all of its memory. A crash or hang kills only the worker; the next use starts a new one. Playback, settings, history and UI stay in the app. A new model kind gets a `worker/` folder (`mod.rs` with its flag, `protocol.rs`, `child.rs`) built on `common/worker_kit`.

### Key Architecture Patterns

**Manager Pattern:** Each feature's service (e.g. `AudioRecordingManager`, `ModelManager`, `TranscriptionManager`, `TtsManager`, `LlmManager`) is created at startup in `lib.rs` and managed via Tauri state.

**Command-Event Architecture:** Frontend → Backend via Tauri commands; Backend → Frontend via events.

**Pipeline Processing:** Audio → VAD → Whisper/Parakeet → Text output → Clipboard/Paste

**State Flow:** Zustand → Tauri Command → Rust State → Persistence (tauri-plugin-store)

### Technology Stack

**Core Libraries:**

- `transcribe-cpp` - Local speech recognition (Whisper, Parakeet, Moonshine, SenseVoice, etc.; GGML/GGUF) with GPU acceleration
- `handy-recorder` - Microphone capture: device selection, resampling to 16 kHz, failure detection
- `transcribe-cpp` (Silero VAD v6, CPU-only, in-process) / `earshot` - Voice Activity Detection
- `rdev` - Global keyboard shortcuts
- `rodio` - Audio playback for feedback sounds

### Application Flow

1. **Initialization:** App starts minimized to tray, loads settings, initializes managers
2. **Model Setup:** First-run downloads preferred Whisper model (Small/Medium/Turbo/Large)
3. **Recording:** Global shortcut triggers audio recording with VAD filtering
4. **Processing:** Audio sent to Whisper model for transcription
5. **Output:** Text pasted to active application via system clipboard

### Settings System

Settings are stored using Tauri's store plugin with reactive updates:

- Keyboard shortcuts (configurable, supports push-to-talk)
- Audio devices (microphone/output selection)
- Model preferences (Small/Medium/Turbo/Large Whisper variants)
- Audio feedback and translation options

### Single Instance Architecture

The app enforces single instance behavior — launching when already running brings the settings window to front rather than creating a new process. Remote control flags (`--toggle-transcription`, etc.) work by launching a second instance that sends args to the running instance via `tauri_plugin_single_instance`, then exits.

## Error notices

`notices::raise` is the one way to report a failure that happens while the user isn't looking at the settings window. Don't add a new event, toast or overlay state for one. A new error should take a few lines and need no new UI.

**Adding a new error:**

1. Add a `NoticeCode` in `src-tauri/src/common/notices.rs`, with its level in `NoticeCode::level` and its title in `NoticeCode::tray_title`. **Error** means nothing came out, or Glider can't do its job. **Warning** means the user got a result, but not the one they set up.
2. Add the title as `errors.<name>Title` in `src/i18n/locales/en/translation.json`, in Title Case and using the app's terms, then add the key to the other locales (`bun run check:translations` fails otherwise). The `Title` suffix is what makes `build.rs` give the tray `strings.<name>_title`. A dictation title has to fit the overlay pill, at most 215px of 12px text.
3. Map the code to its title and optional explanation in `NOTICE_DISPLAY` in `src/common/notices/notices.ts`. TypeScript won't compile until you do.
4. Call `notices::raise` where the failure happens, and regenerate `bindings.ts` by running the app in debug:

```rust
notices::raise(
    app,
    Notice::new(NoticeCode::PasteFailed, NoticeSource::Dictation),
);
```

**Rules:**

- Rust sends codes, never display strings. Use `with_detail` for what only Rust knows, such as a model name or a raw error.
- Glider keeps one notice per `NoticeSource`, and a newer one replaces it. A notice ends when its source next succeeds or when the user dismisses it in the footer. When a source next succeeds, call `notices::clear` before raising anything about that session, or the clear wipes the session's own notice.
- A message from the frontend goes through `notify` in `stores/noticeStore.ts`, the app's only toast. Without a `key` it's a click's result and ends with its pop-up, such as a failed copy. With one it stays in the footer until dismissed or cleared, such as a file Glider can't read. It's text the frontend already translated, so it needs no `NoticeCode`, and it doesn't show in the tray.
- A dictation notice replaces the overlay, so call `raise` instead of hiding the overlay. If a newer session owns the overlay by then, call `raise_without_overlay`.
- A raised notice pops up in the window as a toast. Its X dismisses the notice; otherwise the toast times out and the notice stays in the tray and footer, where the user can bring it back up. During onboarding it pops up below the top bar, and the footer lists it once onboarding ends. Only dictation and Read Aloud notices show on the overlay (Read Aloud's only when no dictation is on screen).

## Internationalization (i18n)

All user-facing strings must use i18next translations. ESLint enforces this (no hardcoded strings in JSX).

**Adding new text:**

1. Add key to `src/i18n/locales/en/translation.json`
2. Use in component: `const { t } = useTranslation(); t('key.path')`

**File structure:**

```
src/i18n/
├── index.ts           # i18n setup
├── languages.ts       # Language metadata
└── locales/
    ├── en/translation.json  # English (source)
    ├── de/, es/, fr/, ja/, ru/, zh/, ...
    └── ...
```

For translation contribution guidelines, see [CONTRIBUTING_TRANSLATIONS.md](CONTRIBUTING_TRANSLATIONS.md).

## Code Style

**Rust:**

- Run `cargo fmt` and `cargo clippy` before committing
- Handle errors explicitly (avoid unwrap in production)
- Use descriptive names, add doc comments for public APIs

**TypeScript/React:**

- Strict TypeScript, avoid `any` types
- Functional components with hooks
- Tailwind CSS for styling
- Path aliases: `@/` → `./src/`

## CLI Parameters

Glider supports command-line parameters on all platforms for integration with scripts, window managers, and autostart configurations.

**Implementation:** `common/system/cli.rs` (definitions), `main.rs` (parsing), `lib.rs` (applying), `features/stt/signal_handle.rs` (shared logic)

| Flag                     | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `--toggle-transcription` | Toggle recording on/off on a running instance              |
| `--toggle-post-process`  | Toggle recording with post-processing on/off               |
| `--cancel`               | Cancel the current operation on a running instance         |
| `--start-hidden`         | Launch without showing the main window (tray icon visible) |
| `--no-tray`              | Launch without system tray (closing window quits the app)  |
| `--debug`                | Enable debug mode with verbose (Trace) logging             |

**Key design decisions:**

- CLI flags are runtime-only overrides — they do NOT modify persisted settings
- Remote control flags work via `tauri_plugin_single_instance`: second instance sends args, then exits
- `send_transcription_input()` in `features/stt/signal_handle.rs` is shared between signal handlers and CLI

## Debug Mode

Access debug features: `Cmd+Shift+D` (macOS) or `Ctrl+Shift+D` (Windows/Linux)

## Platform Notes

- **macOS**: Metal acceleration, accessibility permissions required for keyboard shortcuts
- **Windows**: Vulkan acceleration, code signing. Implicit Vulkan layers (overlays, capture hooks) are disabled for the Glider process via `VK_LOADER_LAYERS_DISABLE=~implicit~` set in `main.rs`; opt out with `GLIDER_KEEP_VULKAN_IMPLICIT_LAYERS=1` or by setting `VK_LOADER_LAYERS_DISABLE` yourself
- **Linux**: OpenBLAS + Vulkan, limited Wayland support, overlay uses GTK layer shell (disable with `GLIDER_NO_GTK_LAYER_SHELL=1`)
- **Nix/NixOS**: the Nix package sets `GLIDER_DISABLE_UPDATER=1` to force-disable the self-updater at runtime without touching the persisted setting (self-update can't work against an immutable `/nix/store`)

## Troubleshooting

See the [Troubleshooting](README.md#troubleshooting) section in README.md.

## GitHub workflow for AI coding assistants

**MANDATORY. Before opening any PR, issue, or discussion in this repo: you MUST read the relevant template file and follow it strictly.** That includes sections that look "ceremonial" — checklists, AI Assistance disclosures, "Human Written Description". A generic Summary/Test-plan layout is not acceptable.

- **Opening a PR:** Read [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md). Every section listed there is mandatory. If a section requires a human-written paragraph (e.g. "Human Written Description"), leave a clear TODO placeholder and ask the human contributor to fill it in — do not invent their voice.
- **Opening an issue:** Read [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/). Blank issues are disabled; pick the right template (`bug_report.md` for bugs). Feature requests do not belong in issues — they go to [Discussions](https://github.com/VivekGits7/Glider/discussions) (see `.github/ISSUE_TEMPLATE/config.yml`).
- **Proposing a feature:** Open a [Discussion](https://github.com/VivekGits7/Glider/discussions) first so the idea can be talked through before any PR.
- **Translations:** Follow [CONTRIBUTING_TRANSLATIONS.md](CONTRIBUTING_TRANSLATIONS.md).
- **Full contributor workflow:** [CONTRIBUTING.md](CONTRIBUTING.md).

**Commits:** Use conventional commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`). Focus the message on _why_, not _what_.
