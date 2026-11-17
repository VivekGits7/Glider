# Glider

**Speak to type. Select to listen. A desktop app that runs fully offline.**

Glider has two global shortcuts that work in any app. Hold one and talk: your words are typed where your cursor is. Select text and press the other: a natural voice reads it aloud, up to 3x speed. Every model runs on your own computer. No account, nothing uploaded.

## How It Works

**Dictation (speech to text)**

1. Hold the dictation shortcut (`fn` on macOS, `Right Ctrl` on Windows) and speak. Tap it instead to toggle recording on and off.
2. Let go. Glider transcribes on your computer and pastes the text into the app you're using.

**Read Aloud (text to speech)**

1. Select text anywhere, including a reply in your terminal.
2. Press the Read Aloud shortcut (`fn ⌃` on macOS, `Ctrl ⊞ Win` on Windows). Press it again to stop.

**Refine (rewrite selected text)**

1. Download a rewrite model in Models → Large language model (Qwen3 4B is recommended; onboarding offers it too). It runs on your computer, on the GPU on Apple Silicon. You can use a provider with your own API key instead.
2. Select text anywhere and press `⌥ 1` to `⌥ 4` (`Alt` on Windows and Linux): Polish, Prompt, Humanize and Fix grammar. The rewrite is pasted over the selection, and the overlay offers "See changes" (or press `⌥ 0`), with copy, rate and refine again. Press `⌘ Z` to undo.
3. Tune each rewrite on the Rewrite page: its switches, extra instructions and writing samples, or write your own.

On macOS, Glider offers to set "Press 🌐 key to" to "Do Nothing" during setup, so holding Fn doesn't also open the emoji picker. All shortcuts can be changed in Settings.

Everything stays local:

- Silence is filtered with Silero VAD.
- Speech to text uses local models: Whisper, Parakeet, Moonshine, SenseVoice and more, with GPU acceleration where available.
- Read Aloud uses local voices: Kokoro, Kitten and Piper.
- Rewrite uses local LLMs: Qwen3, Gemma 3 and Llama 3.2 (see [MODELS.md](../MODELS.md)).
- Works on macOS, Windows and Linux.

## Quick Start

### Installation

1. Download the latest release from the [releases page](https://github.com/VivekGits7/Glider/releases), or build it yourself (see below).
   - **Debian/Ubuntu**: install the downloaded `.deb` with APT so its dependencies come with it:
     ```bash
     sudo apt install ./Glider_*.deb
     ```
     Don't use `dpkg -i` unless the dependencies are already installed. If you did, run `sudo apt --fix-broken install`.
2. Launch Glider and grant the permissions it asks for (microphone, accessibility).
3. Pick a speech model and a voice, and change the shortcuts in Settings if you like.

### Development Setup

For build instructions, including platform-specific requirements, see [BUILD.md](BUILD.md).

## Usage

### Debug Mode

Glider includes an advanced debug mode for development and troubleshooting. Access it by pressing:

- **macOS**: `Cmd+Shift+D`
- **Windows/Linux**: `Ctrl+Shift+D`

### CLI Parameters

Glider supports command-line flags for controlling a running instance and customizing startup behavior. These work on all platforms (macOS, Windows, Linux). Largely this is a beta feature.

**Remote control flags** (sent to an already-running instance via the single-instance plugin):

```bash
glider --toggle-transcription    # Toggle recording on/off
glider --toggle-post-process     # Toggle recording with post-processing on/off
glider --cancel                  # Cancel the current operation
```

**Startup flags:**

```bash
glider --start-hidden            # Start without showing the main window
glider --no-tray                 # Start without the system tray icon
glider --debug                   # Enable debug mode with verbose logging
glider --help                    # Show all available flags
```

Flags can be combined for autostart scenarios:

```bash
glider --start-hidden --no-tray
```

> **macOS tip:** When Glider is installed as an app bundle, invoke the binary directly:
>
> ```bash
> /Applications/Glider.app/Contents/MacOS/glider --toggle-transcription
> ```

### Transcription hook

Advanced users on macOS and Linux can rewrite text right before Glider pastes it. Put an executable at `hooks/transcription` in Glider's app data folder (`~/Library/Application Support/com.glider.app/` on macOS, `~/.local/share/com.glider.app/` on Linux). Glider writes the text to its stdin, after any LLM post-processing, and pastes its stdout. One trailing newline is removed, and empty output pastes nothing. If the hook fails or runs longer than 30 seconds, the original text is pasted.

The hook doesn't get your shell's `PATH`: on macOS, Glider started from the Dock or Finder only sees `/usr/bin:/bin:/usr/sbin:/sbin`. Use absolute paths for anything else, such as `/opt/homebrew/bin/opencc`.

Example that prefixes `#` when Terminal is the frontmost app (macOS):

```bash
mkdir -p ~/Library/Application\ Support/com.glider.app/hooks
cd ~/Library/Application\ Support/com.glider.app/hooks
cat > transcription << 'EOF'
#!/bin/bash
app=$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true')
if [ "$app" = "Terminal" ]; then echo "# $(cat)"; else cat; fi
EOF
chmod +x transcription
```

## Known Issues & Current Limitations

This project is actively being developed and has some [known issues](https://github.com/VivekGits7/Glider/issues). We believe in transparency about the current state:

### Bluetooth Headset Microphones (macOS)

Using a Bluetooth headset microphone on macOS may temporarily reduce playback quality or volume while recording because Bluetooth switches to bidirectional audio. Keep your headphones as the output device and select your Mac's built-in or an external microphone in Glider to avoid this.

### fn and Globe Key Shortcuts (macOS)

Shortcuts that include the `fn` (Globe) key **only work on Apple keyboards** — your Mac's built-in keyboard or an Apple external keyboard. They will never trigger on a third-party keyboard, even while it is connected to the same Mac.

This is a hardware limitation rather than a Glider bug. `fn` is not part of the standard USB HID keyboard specification: Apple reports it through a vendor-specific usage that macOS honors only from Apple devices, while third-party keyboards handle their `Fn` key entirely in firmware and send nothing to the computer. There is no event for Glider to listen for.

If you switch between a MacBook keyboard and an external one, pick a shortcut built from standard modifiers (`ctrl`, `option`, `shift`, `command`) or a regular key instead.

### Linux Notes

**Text Input Tools:**

For reliable text input on Linux, install the appropriate tool for your display server:

| Display Server | Recommended Tool | Install Command                                    |
| -------------- | ---------------- | -------------------------------------------------- |
| X11            | `xdotool`        | `sudo apt install xdotool`                         |
| Wayland        | `wtype`          | `sudo apt install wtype`                           |
| Both           | `dotool`         | `sudo apt install dotool` (requires `input` group) |

- **X11**: Install `xdotool` for both direct typing and clipboard paste shortcuts
- **Ubuntu 26.04**: Has Wayland display server by default. `wtype` does not work, you need to install `ydotool` and configure systemd as described [here](https://github.com/VivekGits7/Glider/pull/557#issuecomment-3781249267).
- **Wayland**: Install `wtype` (preferred) or `dotool` for text input to work correctly
- **dotool setup**: Requires adding your user to the `input` group: `sudo usermod -aG input $USER` (then log out and back in)

Without these tools, Glider falls back to enigo which may have limited compatibility, especially on Wayland.

**Wayland Support (Linux):**

- Limited support for Wayland display server
- Requires [`wtype`](https://github.com/atx/wtype) or [`dotool`](https://sr.ht/~geb/dotool/) for text input to work correctly (see [Linux Notes](#linux-notes) below for installation)

**Other Notes:**

- **Runtime library dependency (`libgtk-layer-shell.so.0`)**:
  - Glider links `gtk-layer-shell` on Linux. If startup fails with `error while loading shared libraries: libgtk-layer-shell.so.0`, install the runtime package for your distro:

    | Distro        | Package to install    | Example command                        |
    | ------------- | --------------------- | -------------------------------------- |
    | Ubuntu/Debian | `libgtk-layer-shell0` | `sudo apt install libgtk-layer-shell0` |
    | Fedora/RHEL   | `gtk-layer-shell`     | `sudo dnf install gtk-layer-shell`     |
    | Arch Linux    | `gtk-layer-shell`     | `sudo pacman -S gtk-layer-shell`       |

  - For building from source on Ubuntu/Debian, you may also need `libgtk-layer-shell-dev`.

- The recording overlay is disabled by default on Linux (`Overlay Position: None`) because certain compositors treat it as the active window. When the overlay is visible it can steal focus, which prevents Glider from pasting back into the application that triggered transcription. If you enable the overlay anyway, be aware that clipboard-based pasting might fail or end up in the wrong window.
- Glider picks the WebKit renderer on Linux from the linked WebKitGTK version: 2.54 and newer keep the compositor on shared memory (`WEBKIT_DMABUF_RENDERER_FORCE_SHM=1`), older releases disable DMA-BUF rendering (`WEBKIT_DISABLE_DMABUF_RENDERER=1`). Explicit values for either variable are preserved. For rendering workarounds, see [Troubleshooting → Configure the WebKit renderer](#3-configure-the-webkit-renderer).
- If Glider fails to start reliably on Linux, see [Troubleshooting → Linux Startup Crashes or Instability](#linux-startup-crashes-or-instability).
- **Global keyboard shortcuts (Wayland):** On Wayland, system-level shortcuts must be configured through your desktop environment or window manager. Use the [CLI flags](#cli-parameters) as the command for your custom shortcut.

  **GNOME:**
  1. Open **Settings > Keyboard > Keyboard Shortcuts > Custom Shortcuts**
  2. Click the **+** button to add a new shortcut
  3. Set the **Name** to `Toggle Glider Transcription`
  4. Set the **Command** to `glider --toggle-transcription`
  5. Click **Set Shortcut** and press your desired key combination (e.g., `Super+O`)

  **KDE Plasma:**
  1. Open **System Settings > Shortcuts > Custom Shortcuts**
  2. Click **Edit > New > Global Shortcut > Command/URL**
  3. Name it `Toggle Glider Transcription`
  4. In the **Trigger** tab, set your desired key combination
  5. In the **Action** tab, set the command to `glider --toggle-transcription`

  **Sway / i3:**

  Add to your config file (`~/.config/sway/config` or `~/.config/i3/config`):

  ```ini
  bindsym $mod+o exec glider --toggle-transcription
  ```

  **Hyprland:**

  Add to your config file (`~/.config/hypr/hyprland.conf`):

  ```ini
  bind = $mainMod, O, exec, glider --toggle-transcription
  ```

- You can also trigger Glider externally via Unix signals or the CLI flags, which lets Wayland window managers or other hotkey daemons keep ownership of keybindings:

  | Action                                    | Trigger                                                  |
  | ----------------------------------------- | -------------------------------------------------------- |
  | Toggle transcription                      | `pkill -USR2 -n glider` or `glider --toggle-transcription` |
  | Toggle transcription with post-processing | `glider --toggle-post-process`                            |

  Example Sway config:

  ```ini
  bindsym $mod+o exec pkill -USR2 -n glider
  bindsym $mod+p exec glider --toggle-post-process
  ```

  `pkill` here simply delivers the signal—it does not terminate the process.

  > **Behavior change:** older releases also accepted `SIGUSR1` for toggling transcription with post-processing. WebKitGTK — the webview engine embedded in Glider on Linux — uses SIGUSR1 internally to coordinate JavaScript garbage collection, so listening for it caused phantom recordings and interrupted dictations every few minutes ([#1660](https://github.com/VivekGits7/Glider/issues/1660)). Glider no longer listens for SIGUSR1 on Linux; the post-processing toggle is still available via `glider --toggle-post-process`. **Remove any `pkill -USR1` bindings**: the signal is now delivered straight to WebKit's internal handler and can crash the app.

**Overlay & Pasting Issues (Linux):**

- The recording overlay window can interfere with pasting transcribed text into target applications on Linux (X11)
- **Solution:** Open **Settings > Advanced** and set **"Overlay Position"** to **"None"** to disable the overlay
- Enable **"Audio Feedback"** (also in Advanced) if you still want audible confirmation of recording state
- Users who upgrade from older versions or import settings from other platforms may need to manually apply this change

## Troubleshooting

### Shortcuts Stopped Working on macOS (Secure Input)

When an app turns on macOS Secure Input, such as a password field, a terminal with "Secure Keyboard Entry", or the login window, macOS blocks keyboard events from reaching every other app. Glider's shortcuts then stop working until it is turned off again. Glider shows a warning when this happens.

- Close or leave the password field or app that turned it on.
- In Terminal or iTerm, turn off **Secure Keyboard Entry** in the app menu.
- If you can't find the app, log out and back in.

### Previous Clipboard Content Is Pasted Instead of the Transcription

If the transcription is correct in **History** but Glider inserts text you copied earlier, see [issue #502](https://github.com/VivekGits7/Glider/issues/502). With the standard clipboard paste method, Glider restores your previous clipboard after a fixed delay. Under load, the receiving application may read the clipboard only after that restoration.

1. Open Glider's settings window and press `Cmd+Shift+D` (macOS) or `Ctrl+Shift+D` (Windows/Linux) to reveal **Debug**.
2. On **macOS and Windows**, try **Reliable Paste (Beta)** in Debug with a clipboard paste method selected. It uses clipboard read notifications to delay restoration instead of relying on the standard fixed delay. Test it in the application where the problem occurs; it is still experimental.
3. If Reliable Paste is disabled or unavailable, increase **Paste Delay (After)** in Debug and test again. This controls the wait before restoring your previous clipboard. **Paste Delay (Before)** controls the wait before sending the paste keystroke and addresses a different part of the operation. These delay settings apply to the standard paste path, not Reliable Paste.

If the problem persists, add your Glider version, operating system, receiving application, paste method, Reliable Paste setting, and before/after delays to the existing issue. Redact private dictated text before sharing logs.

### Manual Model Installation (For Proxy Users or Network Restrictions)

If you're behind a proxy, firewall, or in a restricted network environment where Glider cannot download models automatically, you can manually download and install them. The URLs are publicly accessible from any browser.

#### Step 1: Find Your App Data Directory

1. Open Glider settings
2. Navigate to the **About** section
3. Copy the "App Data Directory" path shown there, or use the shortcuts:
   - **macOS**: `Cmd+Shift+D` to open debug menu
   - **Windows/Linux**: `Ctrl+Shift+D` to open debug menu

The typical paths are:

- **macOS**: `~/Library/Application Support/com.glider.app/`
- **Windows**: `C:\Users\{username}\AppData\Roaming\com.glider.app\`
- **Linux**: `~/.config/com.glider.app/`

#### Step 2: Create Models Directory

Inside your app data directory, speech models go in `models/stt` (create it if it doesn't already exist). Voices are in `models/tts` and LLMs in `models/llm`; Glider manages those itself.

```bash
# macOS
mkdir -p ~/Library/Application\ Support/com.glider.app/models/stt

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path "$env:APPDATA\com.glider.app\models\stt"
```

#### Step 3: Download Model Files

Download the models you want from below

**Whisper Models (single .bin files):**

- Small (487 MB): `https://blob.handy.computer/ggml-small.bin`
- Medium (492 MB): `https://blob.handy.computer/whisper-medium-q4_1.bin`
- Turbo (1600 MB): `https://blob.handy.computer/ggml-large-v3-turbo.bin`
- Large (1100 MB): `https://blob.handy.computer/ggml-large-v3-q5_0.bin`

**Parakeet Unified EN 0.6B (single `.gguf` file, recommended):**

- Q8_0 (731 MB): `https://huggingface.co/handy-computer/parakeet-unified-en-0.6b-gguf/resolve/main/parakeet-unified-en-0.6b-Q8_0.gguf`

#### Step 4: Install Models

**For Whisper Models (.bin files):**

Simply place the `.bin` file directly into the `models/stt` directory:

```
{app_data_dir}/models/stt/
├── ggml-small.bin
├── whisper-medium-q4_1.bin
├── ggml-large-v3-turbo.bin
└── ggml-large-v3-q5_0.bin
```

**For GGUF Models (.gguf files):**

Place the `.gguf` file directly into the `models/stt` directory, exactly like the Whisper `.bin` files above. Glider also picks up models already present in the shared Hugging Face cache (`~/.cache/huggingface/hub`), so a copy downloaded by another tool works without being moved.

**Important Notes:**

- Do not rename the `.bin` or `.gguf` files—use the exact filenames from the download URLs
- After placing the files, restart Glider to detect the new models

#### Step 5: Verify Installation

1. Restart Glider
2. Open Settings → Models
3. Your manually installed models should now appear as "Downloaded"
4. Select the model you want to use and test transcription

### Custom Whisper Models

Glider can auto-discover custom Whisper GGML models placed in the `models` directory. This is useful for users who want to use fine-tuned or community models not included in the default model list.

**How to use:**

1. Obtain a Whisper model in GGML `.bin` format (e.g., from [Hugging Face](https://huggingface.co/models?search=whisper%20ggml))
2. Place the `.bin` file in your `models` directory (see paths above)
3. Restart Glider to discover the new model
4. The model will appear in the "Custom Models" section of the Models settings page

**Important:**

- Community models are user-provided and may not receive troubleshooting assistance
- The model must be a valid Whisper GGML format (`.bin` file)
- Model name is derived from the filename (e.g., `my-custom-model.bin` → "My Custom Model")

### Linux Startup Crashes or Instability

If Glider fails to start reliably on Linux — for example, it crashes shortly after launch, never shows its window, or reports a Wayland protocol error — try the steps below in order.

**1. Install (or reinstall) `gtk-layer-shell`**

Glider uses `gtk-layer-shell` for its recording overlay and links against it at runtime. A missing or broken installation is the most common cause of startup failures and can manifest as a crash or a hang well before any window is shown. Make sure the runtime package is installed for your distro:

| Distro        | Package to install    | Example command                        |
| ------------- | --------------------- | -------------------------------------- |
| Ubuntu/Debian | `libgtk-layer-shell0` | `sudo apt install libgtk-layer-shell0` |
| Fedora/RHEL   | `gtk-layer-shell`     | `sudo dnf install gtk-layer-shell`     |
| Arch Linux    | `gtk-layer-shell`     | `sudo pacman -S gtk-layer-shell`       |

If it is already installed and you still see startup problems, try reinstalling it (e.g. `sudo pacman -S gtk-layer-shell` again) in case the library files were corrupted by a partial upgrade.

**2. Disable the GTK layer shell overlay (`GLIDER_NO_GTK_LAYER_SHELL`)**

If installing the library does not help, you can skip `gtk-layer-shell` initialization entirely as a workaround. On some compositors (notably KDE Plasma under Wayland) it has been reported to interact poorly with the recording overlay. With this variable set, the overlay falls back to a regular always-on-top window:

```bash
GLIDER_NO_GTK_LAYER_SHELL=1 glider
```

**3. Configure the WebKit renderer (`WEBKIT_DISABLE_DMABUF_RENDERER` / `WEBKIT_DMABUF_RENDERER_FORCE_SHM`)**

Glider picks the renderer at startup from the WebKitGTK build it links, because the DMA-BUF renderer crashes on some GPU/driver combinations but the non-composited fallback loses pixels on the 2.54 series:

- **WebKitGTK 2.54 and newer:** the compositor stays enabled and is forced onto shared memory with `WEBKIT_DMABUF_RENDERER_FORCE_SHM=1`. 2.54 composites only the damaged region of every frame, so the previous workaround (`WEBKIT_DISABLE_DMABUF_RENDERER=1`) left transparent windows — such as the recording overlay — showing only their animated parts ([#2166](https://github.com/VivekGits7/Glider/issues/2166)).
- **Older releases:** DMA-BUF rendering is disabled with `WEBKIT_DISABLE_DMABUF_RENDERER=1`, which can cause blank windows but matches the previous behavior.

Explicit environment-variable values are preserved, including in the Nix package:

```bash
# Force the legacy non-composited renderer (2.54: partial frames may reappear)
WEBKIT_DISABLE_DMABUF_RENDERER=1 glider

# Keep the compositor on shared memory (the 2.54 default below)
WEBKIT_DMABUF_RENDERER_FORCE_SHM=1 glider

# Let WebKit use DMA-BUF when supported (may reintroduce the GPU/driver crashes)
WEBKIT_DISABLE_DMABUF_RENDERER=0 glider
```

Fully quit Glider, including its tray instance, before testing a value. Running a second instance with `--toggle-transcription` does not change the running process's environment.

**Making a workaround permanent**

Set the variable in the environment of the launcher that actually starts Glider. Shell profile exports may not apply to desktop-menu or autostart launches. If you launch Glider from a `.desktop` file, you can prefix the `Exec=` line, e.g.:

```ini
Exec=env GLIDER_NO_GTK_LAYER_SHELL=1 glider
```

Glider's built-in autostart rewrites its generated desktop entry, so editing that entry is not a durable workaround. For autostart, use an appropriate session/service environment, or disable Glider's built-in autostart and manage your own startup entry with the required variable.

If a workaround helps you, please [open an issue](https://github.com/VivekGits7/Glider/issues) describing your distro, desktop environment, and session type — that information helps us narrow down the underlying bug.

### Empty recording overlay on Hyprland / Omarchy

If the recording overlay is empty or bordered, fully quit Glider and launch a
[native installation](BUILD.md#linux-install-from-source) with Wayland enabled:

```bash
env -u GLIDER_NO_GTK_LAYER_SHELL GDK_BACKEND=wayland glider
```

If this works, apply `GDK_BACKEND=wayland` only to Glider's launcher. This
workaround does not work with the 0.9.6 AppImage, which forces X11.

### Vulkan Overlays and Capture Tools on Windows (`GLIDER_KEEP_VULKAN_IMPLICIT_LAYERS`)

On Windows, Glider asks the Vulkan loader to skip implicit layers to avoid crashes caused by overlay and capture hooks ([#2049](https://github.com/VivekGits7/Glider/issues/2049)). GPU acceleration remains enabled; this does not change system-wide settings.

To opt out for GPU selection or debugging tools, fully quit Glider (including the tray icon), then run both commands in the same PowerShell window:

```powershell
$env:GLIDER_KEEP_VULKAN_IMPLICIT_LAYERS = "1"
& "$env:ProgramFiles\Glider\glider.exe"
```

Adjust the executable path if needed. This override only applies to apps launched from that PowerShell session, not the Start menu. Glider also preserves any existing `VK_LOADER_LAYERS_DISABLE` value.

### How to Contribute

1. **Check existing issues** at [github.com/VivekGits7/Glider/issues](https://github.com/VivekGits7/Glider/issues)
2. **Fork the repository** and create a feature branch
3. **Test thoroughly** on your target platform
4. **Submit a pull request** with a clear description of the change

## License

MIT License, see [LICENSE](LICENSE).

Glider's dictation is built on [Handy](https://github.com/cjpais/Handy) by CJ Pais, also under the MIT license.

## Acknowledgments

- **[Handy](https://github.com/cjpais/Handy)** by CJ Pais, which Glider's speech to text is built on
- **Whisper** by OpenAI, **Parakeet** by NVIDIA and the other open speech models
- **transcribe.cpp** and **ggml** for running models on your own computer
- **sherpa-onnx** with **Kokoro**, **Kitten** and **Piper** for the Read Aloud voices
- **Silero** for lightweight VAD
- **Tauri** for the Rust-based app framework
