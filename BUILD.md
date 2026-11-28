# Build Instructions

This guide covers how to set up and build Glider from source on macOS, Linux and Windows.

## Prerequisites

Install these on every platform:

- **Rust** (latest stable): https://rustup.rs/
- **Bun**: https://bun.sh/
- **Tauri prerequisites**: https://tauri.app/start/prerequisites/

## Setup Instructions

### macOS

#### 1. Clone the Repository

```bash
git clone https://github.com/VivekGits7/Glider.git
cd Glider
```

#### 2. Install Dependencies

```bash
bun install
```

#### 3. Start the Dev Server

```bash
bun tauri dev
```

#### 4. Build for Production

```bash
bun run tauri build
```

The `.dmg` installer lands in `src-tauri/target/release/bundle/dmg/`.

### Linux

#### 1. Clone the Repository

```bash
git clone https://github.com/VivekGits7/Glider.git
cd Glider
```

#### 2. Install Dependencies

```bash
bun install
```

#### 3. Start the Dev Server

```bash
bun tauri dev
```

#### 4. Build for Production

```bash
bun run tauri build
```

The deb, rpm and AppImage bundles land in `src-tauri/target/release/bundle/`.

---

### Windows

#### 1. Clone the Repository

```powershell
git clone https://github.com/VivekGits7/Glider.git
cd Glider
```

#### 2. Install Dependencies

```powershell
bun install
```

#### 3. Start the Dev Server

```powershell
bun tauri dev
```

#### 4. Build for Production

```powershell
bun run tauri build
```

The installers land in `src-tauri\target\release\bundle\`.

---

## Linux Install (from source)

The raw binary (`src-tauri/target/release/glider`) cannot run standalone — it needs Tauri resource files (tray icons, sounds, VAD model) to be co-located at the expected path.

**Install from the deb bundle** (works on any Linux distro):

```bash
cd /tmp
ar x /path/to/Glider/src-tauri/target/release/bundle/deb/Glider_*_amd64.deb data.tar.gz
tar xzf data.tar.gz
sudo cp usr/bin/glider /usr/bin/
sudo cp -a usr/lib/. /usr/lib/
sudo cp -r usr/share/icons/hicolor/* /usr/share/icons/hicolor/
sudo cp usr/share/applications/Glider.desktop /usr/share/applications/
```

The runtime libraries live in the app-private `/usr/lib/Glider/` (on the binary's rpath), so no `ldconfig` step is needed.

After subsequent rebuilds, copy the binary and any refreshed runtime libraries:

```bash
sudo cp src-tauri/target/release/glider /usr/bin/
sudo mkdir -p /usr/lib/Glider
sudo cp -a src-tauri/transcribe-libs/. /usr/lib/Glider/
```

Resources only need re-copying if they change upstream (new icons, sounds, models, etc.).

---

## Troubleshooting

Build problems and their fixes are in [TROUBLESHOOT.md](TROUBLESHOOT.md).
