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

## Releases

`.github/workflows/release.yml` builds the Windows installer and both Mac DMGs on GitHub's own runners. **Run workflow** makes test downloads. Pushing a version tag publishes a release.

### One-time setup: the update key

Glider reads `releases/latest/download/latest.json` for updates, and only installs files signed by the key in `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`. Glider's key is already set up there. To set up a new one:

1. Generate a key and pick a password:

   ```bash
   bun run tauri signer generate -w ~/.tauri/glider.key
   ```

2. Back up `~/.tauri/glider.key` and its password, for example in a password manager. If you lose either one, installed copies can never update again.
3. Paste the contents of `~/.tauri/glider.key.pub` into `plugins.updater.pubkey`, then commit.
4. On GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add two secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`: the contents of `~/.tauri/glider.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: its password

Test builds work without the secrets; they just skip the update files. A tagged release stops before publishing if the key is missing or doesn't match the public key.

### Make a test build

1. Open the repo's **Actions** tab and pick **Release** on the left.
2. Click **Run workflow**, choose a branch, and click **Run workflow** again.
3. When the run finishes, open it and scroll to **Artifacts**. Download `glider-windows-x64`, `glider-macos-aarch64` or `glider-macos-x64`. Each one is a zip, needs a GitHub sign-in, and is deleted after 14 days.

### Ship a version

1. Set the new version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`, then update `Cargo.lock`:

   ```bash
   cd src-tauri && cargo update --workspace && cd ..
   ```

2. Commit, then tag and push:

   ```bash
   git commit -am "chore: release 0.10.1"
   git tag v0.10.1
   git push origin main v0.10.1
   ```

The workflow checks that the tag matches all four files and builds every installer. It then checks each update signature and publishes **Glider 0.10.1** with `latest.json` as the latest release. Users download it from https://github.com/VivekGits7/Glider/releases/latest.

If a build fails, nothing is published and the previous release stays the latest. Fix it and click **Re-run failed jobs**. If the fix needs a code change, commit it and move the tag with `git tag -f v0.10.1 && git push -f origin v0.10.1`. A published version is never replaced, so fixing a bad release means shipping a new version.

**Copies installed before your first release** have no update address and carry Handy's key, so they can't update themselves. Their users install that release once by hand. After that, Glider offers each new version itself, unless update checks are turned off.

### Cost and warnings

The repo is public, so GitHub's standard runners are free. If it goes private, builds use the plan's included Actions minutes, and Windows and macOS minutes cost more than Linux ones. Past the included amount they're billed. A private repo's releases also need a GitHub sign-in to download, so downloads and update checks would need a public home for the files.

The installers aren't signed by Microsoft or Apple, because that needs paid certificates. Windows SmartScreen and macOS Gatekeeper warn on first open (see [Download](README.md#download)). The update key only proves later updates came from you. It gives you no Microsoft publisher trust and no Apple notarization.

---

## Troubleshooting

Build problems and their fixes are in [TROUBLESHOOT.md](TROUBLESHOOT.md).
