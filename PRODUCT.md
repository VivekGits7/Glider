# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Desktop app built with Tauri 2 (Rust backend, React + Tailwind frontend in a system webview) for macOS, Windows and Linux. The main window is a settings-style app window; a separate always-on-top overlay window shows dictation and Read Aloud status.

## Users

Developers who work with AI coding tools such as Claude Code, often in a terminal or editor (Zed, VS Code). Two jobs, many times a day: speak a prompt instead of typing it, and listen to the AI's long replies quickly instead of reading them.

## Product Purpose

Glider is a desktop app with two global shortcuts that work in any app. Hold one and talk: your speech is typed where the cursor is. Select text and press the other: a natural voice reads it aloud, at up to 3x speed. Success is that the user stops thinking about the tool and just talks to and listens to their AI.

## Positioning

Both directions of voice in one app, plus rewriting, and every model runs locally on the user's computer: speech-to-text models (Whisper, Parakeet, Moonshine, SenseVoice and more), voices (Kokoro, Kitten, Piper, including Hindi) and rewrite LLMs (Qwen3, Gemma 3, Llama 3.2). No account, no subscription, nothing uploaded. The full list is in ../MODELS.md.

## Operating Context

- Used alongside AI coding tools, mostly Claude Code in a terminal. Claude Code draws its own mouse selection and copies it on release; Read Aloud reads that copy.
- The main window is opened occasionally: first-run setup, downloading models and voices, changing shortcuts, checking history. Day-to-day use happens through the shortcuts and the overlay pill.
- Default shortcuts on macOS: Fn to dictate, Fn+Control to read aloud, Option+1 to 4 to refine selected text, Option+0 to see what the last rewrite changed. Windows: Right Ctrl, Ctrl+Win, Alt+1 to 4. All can be changed in Settings.

## Capabilities and Constraints

- Dictation: global shortcut (toggle or push-to-talk), live or minimal overlay, paste into the focused app, optional AI post-processing, transcribing files, history with audio playback.
- Read Aloud: reads the selection (Accessibility, then copy, then a fresh clipboard copy), voice models downloadable per voice, speaker and speed (0.5x to 3x) settings, overlay shows the sentence being spoken.
- Rewrite: Refine shortcuts rewrite the selection with an LLM on this computer (candle; Metal on Apple Silicon), or a provider the user picks. Built-in rewrites (Polish, Prompt, Humanize, Fix grammar) have switches, extra instructions and writing samples; users can write their own. The overlay shows Refining, Done and a See changes card with undo, copy, rating and refine again.
- Insights: speed, time saved, apps dictated into, reading habits and a streak calendar, from local activity only.
- Models page manages speech-to-text models, Read Aloud voices and rewrite LLMs.
- History keeps dictations and Read Aloud reads, in two tabs.
- All UI text goes through i18next (25 locales); errors go through the notices system.
- Glider is built on Handy (MIT) by CJ Pais; credit stays in About and the license.
- Source code: https://github.com/VivekGits7/Glider

## Brand Commitments

- Name: Glider. The logo is the wing mark (two lilac-to-violet blades) beside "Glider" set in the system font; the app icon puts the mark on a dark glass tile.
- Accent colour: lilac taken from the app icon, #c58af2 (dark) / #d8b4f8 (light), with the icon's lilac-to-violet gradient on filled controls.
- The user pinned a visual reference for the main window: a dark, calm app with a left sidebar of icon + label items, an inset rounded content panel, serif page titles, a Home with a welcome line, a large shortcut card, a stats card and a "today" list, and settings pages laid out as cards of rows (title and description on the left, a Change button or dropdown on the right). Glider must look like its own product, not a copy of that reference.

## Evidence on Hand

- Real local data only: dictation history (SQLite), Read Aloud history (new), downloaded models. No testimonials, user counts or benchmarks exist; do not invent any.

## Product Principles

1. The shortcuts are the product; the window exists to set them up and to look back.
2. Local and private by default, and say so plainly.
3. Speed over ceremony: one glance tells you what to press.
4. One app, two directions of voice: dictation and Read Aloud always appear as equals.
