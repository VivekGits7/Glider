# Troubleshooting

Fixes for common problems when using Glider and when building it from source. For the setup steps, see [BUILD.md](BUILD.md).

---

### Windows

#### Vulkan overlays and capture tools (`GLIDER_KEEP_VULKAN_IMPLICIT_LAYERS`)

Glider tells the Vulkan loader to skip implicit layers, which avoids crashes caused by overlay and capture hooks ([Handy issue #2049](https://github.com/cjpais/Handy/issues/2049)). GPU acceleration stays on, and no system-wide setting changes.

To turn this off for GPU selection or debugging tools, fully quit Glider (including the tray icon), then run both commands in the same PowerShell window:

```powershell
$env:GLIDER_KEEP_VULKAN_IMPLICIT_LAYERS = "1"
& "$env:ProgramFiles\Glider\glider.exe"
```

Change the path if Glider is installed somewhere else. This only applies to apps started from that PowerShell window, not the Start menu. Glider also keeps any `VK_LOADER_LAYERS_DISABLE` value you've already set.

---

### Linux

#### Text isn't typed or pasted

Install the text input tool for your display server:

| Display server | Tool      | Install                                             |
| -------------- | --------- | --------------------------------------------------- |
| X11            | `xdotool` | `sudo apt install xdotool`                          |
| Wayland        | `wtype`   | `sudo apt install wtype`                            |
| Both           | `dotool`  | `sudo apt install dotool` (needs the `input` group) |

- **dotool:** add yourself to the `input` group with `sudo usermod -aG input $USER`, then log out and back in.
- **Ubuntu 26.04:** uses Wayland, where `wtype` doesn't work. Install `ydotool` and set it up with systemd as described [here](https://github.com/cjpais/Handy/pull/557#issuecomment-3781249267).

Without one of these tools, Glider falls back to `enigo`, which may not work well, especially on Wayland.

#### Global shortcuts on Wayland

On Wayland, system-wide shortcuts have to be set in your desktop environment or window manager. Use a [command-line flag](README.md#command-line-flags) as the shortcut's command.

**GNOME:**

1. Open **Settings > Keyboard > Keyboard Shortcuts > Custom Shortcuts**.
2. Click **+**.
3. Name it `Toggle Glider Transcription`.
4. Set the command to `glider --toggle-transcription`.
5. Click **Set Shortcut** and press your keys, for example `Super+O`.

**KDE Plasma:**

1. Open **System Settings > Shortcuts > Custom Shortcuts**.
2. Click **Edit > New > Global Shortcut > Command/URL**.
3. Name it `Toggle Glider Transcription`.
4. On the **Trigger** tab, set your keys.
5. On the **Action** tab, set the command to `glider --toggle-transcription`.

**Sway / i3** (`~/.config/sway/config` or `~/.config/i3/config`):

```ini
bindsym $mod+o exec glider --toggle-transcription
```

**Hyprland** (`~/.config/hypr/hyprland.conf`):

```ini
bind = $mainMod, O, exec, glider --toggle-transcription
```

You can also use a Unix signal, so your window manager or hotkey daemon keeps the key binding:

| Action                                    | Trigger                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| Toggle transcription                      | `pkill -USR2 -n glider` or `glider --toggle-transcription` |
| Toggle transcription with post-processing | `glider --toggle-post-process`                             |

```ini
bindsym $mod+o exec pkill -USR2 -n glider
bindsym $mod+p exec glider --toggle-post-process
```

`pkill` only sends the signal here. It doesn't close Glider.

> **Don't use `SIGUSR1`.** Older releases toggled post-processing with it, but WebKitGTK (the web engine inside Glider on Linux) uses `SIGUSR1` internally, which caused phantom recordings ([Handy issue #1660](https://github.com/cjpais/Handy/issues/1660)). Glider no longer listens for it, and the signal can now crash the app, so remove any `pkill -USR1` bindings. Use `glider --toggle-post-process` instead.

#### The overlay steals focus, or pasting goes to the wrong window

The recording overlay is off by default on Linux (**Overlay Position: None**), because some compositors treat it as the active window. Then the text can't be pasted back into the app you were using.

If you turned it on and pasting fails, open **Settings > Advanced** and set **Overlay Position** back to **None**. Turn on **Audio Feedback** there if you still want to hear when recording starts and stops. If you upgraded from an older version or imported settings from another computer, you may need to change this yourself.

#### Glider crashes or won't start

If Glider crashes soon after launch, never shows its window, or reports a Wayland protocol error, try these in order.

**1. Install (or reinstall) `gtk-layer-shell`**

Glider uses `gtk-layer-shell` for its recording overlay. A missing or broken install is the most common cause of startup failures, including `error while loading shared libraries: libgtk-layer-shell.so.0`.

| Distro        | Package               | Install                                |
| ------------- | --------------------- | -------------------------------------- |
| Ubuntu/Debian | `libgtk-layer-shell0` | `sudo apt install libgtk-layer-shell0` |
| Fedora/RHEL   | `gtk-layer-shell`     | `sudo dnf install gtk-layer-shell`     |
| Arch Linux    | `gtk-layer-shell`     | `sudo pacman -S gtk-layer-shell`       |

If it's already installed, reinstall it in case a partial upgrade broke its files. Building from source on Ubuntu/Debian may also need `libgtk-layer-shell-dev`.

**2. Skip the layer shell (`GLIDER_NO_GTK_LAYER_SHELL`)**

On some compositors, notably KDE Plasma on Wayland, `gtk-layer-shell` doesn't get along with the overlay. With this variable set, the overlay becomes a regular always-on-top window:

```bash
GLIDER_NO_GTK_LAYER_SHELL=1 glider
```

**3. Change the WebKit renderer**

Glider picks a renderer at startup from the WebKitGTK version it links, because DMA-BUF rendering crashes on some GPU and driver combinations:

- **WebKitGTK 2.54 and newer:** keeps the compositor on shared memory (`WEBKIT_DMABUF_RENDERER_FORCE_SHM=1`). Turning DMA-BUF off on 2.54 left transparent windows, such as the overlay, showing only their animated parts ([Handy issue #2166](https://github.com/cjpais/Handy/issues/2166)).
- **Older releases:** turns DMA-BUF off (`WEBKIT_DISABLE_DMABUF_RENDERER=1`), which can cause blank windows but matches earlier behavior.

Values you set yourself always win, including in the Nix package:

```bash
# Force the old non-composited renderer (on 2.54, partial frames may come back)
WEBKIT_DISABLE_DMABUF_RENDERER=1 glider

# Keep the compositor on shared memory (the 2.54 default)
WEBKIT_DMABUF_RENDERER_FORCE_SHM=1 glider

# Let WebKit use DMA-BUF when it can (may bring back GPU or driver crashes)
WEBKIT_DISABLE_DMABUF_RENDERER=0 glider
```

Fully quit Glider, including its tray icon, before you test a value. Running a second instance with `--toggle-transcription` doesn't change the running app's environment.

**Making a fix permanent:** set the variable for whatever starts Glider. Shell profile exports may not reach the app menu or autostart. For a `.desktop` file, prefix the `Exec=` line:

```ini
Exec=env GLIDER_NO_GTK_LAYER_SHELL=1 glider
```

Glider's own autostart rewrites its desktop entry, so editing that entry won't last. Set the variable in your session or service environment instead, or turn off Glider's autostart and make your own startup entry.

If one of these helps, please [open an issue](https://github.com/VivekGits7/Glider/issues) with your distro, desktop environment and session type. It helps track down the real bug.

#### Empty recording overlay on Hyprland / Omarchy

If the overlay is empty or has a border, fully quit Glider and start a [native installation](BUILD.md#linux-install-from-source) with Wayland turned on:

```bash
env -u GLIDER_NO_GTK_LAYER_SHELL GDK_BACKEND=wayland glider
```

If that works, set `GDK_BACKEND=wayland` only in Glider's launcher. This doesn't work with the 0.9.6 AppImage, which forces X11.

---

## Building from source

### macOS

#### Glider stays on `Waiting...` after a rebuild

**Problem:** After a local rebuild, Glider waits for Accessibility even though **System Settings > Privacy & Security > Accessibility** still shows it turned on.

**Why:** Local builds are signed ad hoc (`signingIdentity: "-"`). A rebuild can get a new code identity, and the old Accessibility grant doesn't cover it.

**Fix:** Install the new build at `/Applications/Glider.app`. Then quit Glider, clear only its old Accessibility record, and reopen it:

```bash
osascript -e 'tell application id "com.glider.app" to quit' || true
tccutil reset Accessibility com.glider.app
open /Applications/Glider.app
```

Grant Accessibility again when asked. This doesn't reset Microphone or any other permission, and official releases normally don't need it.

**Optional check:** Compare the designated requirements of the old and new bundles:

```bash
codesign -dr - /path/to/previous/Glider.app 2>&1
codesign -dr - /Applications/Glider.app 2>&1
```

An ad-hoc requirement contains a `cdhash`. If it changed, the old grant doesn't cover the rebuild.

---

### Linux

#### AppImage build fails on Arch and other rolling-release distros

**Problem:** The build stops with:

```
Bundling Glider_*_amd64.AppImage
failed to bundle project `failed to run linuxdeploy`
```

**Why:** `linuxdeploy` bundles its own `strip`, which is too old for system libraries built with newer toolchains on Arch, CachyOS, Manjaro and EndeavourOS.

**Fix:** The binary, deb and rpm bundles all build fine. Only the AppImage step fails, so skip it:

```bash
bun run tauri build -- --bundles deb
```

Then install it with the steps in [Linux Install (from source)](BUILD.md#linux-install-from-source).

**See the real error:** Tauri hides linuxdeploy's message. To see it, run linuxdeploy yourself:

```bash
cd src-tauri/target/release/bundle/appimage
~/.cache/tauri/linuxdeploy-x86_64.AppImage --appimage-extract-and-run \
  --appdir Glider.AppDir --plugin gtk --output appimage
```

---

### Windows

#### Build fails with path-limit errors (`MSB3491`, `FTK1011`, `MSB6003`)

**Problem:** The native build fails partway through `transcribe-cpp-sys` with one of these:

```
error MSB3491: Could not write lines to file "...VCTargetsPath.tlog\VCTargetsPath.lastbuildstate".
Path: ... exceeds the OS max path limit. The fully qualified file name must be less than 260 characters.

FileTracker : error FTK1011: could not create the new file tracking log file:
...\vulkan-shaders-gen-build\...\cmTC_xxxxx.tlog\link.write.1.tlog.
The system cannot find the path specified.

error MSB6003: The specified task executable "CL.exe" could not be run.
System.IO.DirectoryNotFoundException: Could not find a part of the path ...
```

**Why:** Windows' old 260-character path limit (`MAX_PATH`). The Vulkan shader generator's nested CMake build sits inside Cargo's already deep `target\release\build\<crate>-<hash>\out\build\...` folder and runs past it.

The build works around this on its own: it compiles through a short NTFS junction under `%LOCALAPPDATA%\tcs`, with no admin rights needed. Turning on Windows long paths doesn't reliably help, because MSBuild's `FileTracker` (`tracker.exe`) ignores that setting.

**Fix:** If you still see these errors, either the junction was blocked (by the filesystem or a company policy; the build log then shows a `transcribe-cpp-sys: could not create short build junction ...` warning), or your checkout is deep enough to overflow even the short path. Use a short Cargo target folder:

```powershell
# This terminal only:
$env:CARGO_TARGET_DIR = "C:\h"

# Every new terminal (moves the build output of ALL your Rust projects, not just Glider):
[Environment]::SetEnvironmentVariable('CARGO_TARGET_DIR', 'C:\h', 'User')
```

Build output then goes to `C:\h\release\...` instead of `src-tauri\target\`. If you saved the variable for every terminal, open a new one first. After that, `bun run tauri dev` and `bun run tauri build` work as usual.
