//! Where downloaded models live: `<app data>/models/` with one folder per
//! kind, `stt`, `tts` and `llm`. [`migrate`] moves downloads from the layout
//! before it (loose files in `models/`, `tts-models/`, `llm-models/`, and
//! Glider's repos in the shared Hugging Face cache).

use log::{info, warn};
use serde::Deserialize;
use specta::Type;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

/// A kind of model, and so the folder it downloads into.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ModelFolder {
    Speech,
    Voices,
    Llm,
}

const ALL: [ModelFolder; 3] = [ModelFolder::Speech, ModelFolder::Voices, ModelFolder::Llm];

/// Glider's own repos in a Hugging Face cache (`models--<org>--<name>`).
const GLIDER_HF_REPO_PREFIX: &str = "models--handy-computer--";

impl ModelFolder {
    fn name(self) -> &'static str {
        match self {
            ModelFolder::Speech => "stt",
            ModelFolder::Voices => "tts",
            ModelFolder::Llm => "llm",
        }
    }

    /// `<app_data>/models/<stt|tts|llm>`.
    pub fn path_in(self, app_data: &Path) -> PathBuf {
        app_data.join("models").join(self.name())
    }

    /// This kind's folder, portable-aware.
    pub fn path(self, app: &AppHandle) -> Result<PathBuf, tauri::Error> {
        Ok(self.path_in(&crate::common::system::portable::app_data_dir(app)?))
    }
}

/// Moves models from the old layout into the per-kind folders, so they keep
/// working without a new download. Speech repos in `shared_hf_cache` (a
/// Hugging Face cache root, `.../hub`) move into `stt` too. Run before any
/// manager opens a model. Whatever can't move (another disk, a name clash)
/// stays put and is logged; Glider still finds Hugging Face ones there.
pub fn migrate(app_data: &Path, shared_hf_cache: Option<&Path>) {
    let models = app_data.join("models");
    let stt = ModelFolder::Speech.path_in(app_data);
    let ours: Vec<_> = ALL.iter().map(|f| f.name()).collect();

    // Speech downloads used to sit loose in models/.
    if let Ok(entries) = fs::read_dir(&models) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            // Ignoring case: macOS and Windows disks treat STT and stt as one.
            if ours
                .iter()
                .any(|o| name.to_string_lossy().eq_ignore_ascii_case(o))
            {
                continue;
            }
            move_into(&entry.path(), &stt.join(&name));
        }
    }
    move_into(
        &app_data.join("tts-models"),
        &ModelFolder::Voices.path_in(app_data),
    );
    move_into(
        &app_data.join("llm-models"),
        &ModelFolder::Llm.path_in(app_data),
    );

    // Glider's speech models from Hugging Face. Other repos in the shared
    // cache belong to other tools and stay.
    let Some(shared) = shared_hf_cache.filter(|s| *s != stt) else {
        return;
    };
    if let Ok(entries) = fs::read_dir(shared) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            if name.to_string_lossy().starts_with(GLIDER_HF_REPO_PREFIX) {
                move_into(&entry.path(), &stt.join(&name));
            }
        }
    }
}

/// Moves `from` to `to`, merging folders that already exist on both sides.
/// Hugging Face snapshots link to their blobs by relative paths, so a moved
/// repo folder keeps working.
fn move_into(from: &Path, to: &Path) {
    if fs::symlink_metadata(from).is_err() {
        return;
    }
    if fs::symlink_metadata(to).is_err() {
        if let Some(parent) = to.parent() {
            let _ = fs::create_dir_all(parent);
        }
        match fs::rename(from, to) {
            Ok(()) => info!("Moved {} to {}", from.display(), to.display()),
            Err(e) => warn!("Couldn't move {} to {}: {e}", from.display(), to.display()),
        }
        return;
    }
    if from.is_dir() && to.is_dir() {
        if let Ok(entries) = fs::read_dir(from) {
            for entry in entries.flatten() {
                move_into(&entry.path(), &to.join(entry.file_name()));
            }
        }
        // Only goes if everything inside moved.
        let _ = fs::remove_dir(from);
    } else {
        warn!(
            "Left {} where it is: {} already exists",
            from.display(),
            to.display()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write(path: &Path, text: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    #[test]
    fn moves_the_old_layout_into_per_kind_folders() {
        let data = TempDir::new().unwrap();
        let hub = TempDir::new().unwrap();
        let d = data.path();
        write(&d.join("models/ggml-small.bin"), "stt");
        write(&d.join("models/ggml-base.bin.partial"), "half");
        write(&d.join("tts-models/kokoro/model.onnx"), "tts");
        write(&d.join("tts-models/espeak-ng-data/phontab"), "espeak");
        write(&d.join("llm-models/qwen/model.gguf"), "llm");
        // An llm folder made before the move gets merged, not replaced.
        write(&d.join("models/llm/other/model.gguf"), "kept");
        let repo = "models--handy-computer--Qwen3-ASR-1.7B-gguf";
        write(&hub.path().join(repo).join("blobs/abc"), "weights");
        write(&hub.path().join("models--someone--else/blobs/x"), "theirs");
        #[cfg(unix)]
        {
            let snap = hub.path().join(repo).join("snapshots/main");
            fs::create_dir_all(&snap).unwrap();
            std::os::unix::fs::symlink("../../blobs/abc", snap.join("model.gguf")).unwrap();
        }

        migrate(d, Some(hub.path()));

        let read = |p: &str| fs::read_to_string(d.join(p)).unwrap();
        assert_eq!(read("models/stt/ggml-small.bin"), "stt");
        assert_eq!(read("models/stt/ggml-base.bin.partial"), "half");
        assert_eq!(read("models/tts/kokoro/model.onnx"), "tts");
        assert_eq!(read("models/tts/espeak-ng-data/phontab"), "espeak");
        assert_eq!(read("models/llm/qwen/model.gguf"), "llm");
        assert_eq!(read("models/llm/other/model.gguf"), "kept");
        assert_eq!(read(&format!("models/stt/{repo}/blobs/abc")), "weights");
        #[cfg(unix)]
        assert_eq!(
            read(&format!("models/stt/{repo}/snapshots/main/model.gguf")),
            "weights"
        );
        assert!(!d.join("tts-models").exists());
        assert!(!d.join("llm-models").exists());
        assert!(!d.join("models/ggml-small.bin").exists());
        // Other tools' Hugging Face repos stay where they are.
        assert!(hub.path().join("models--someone--else/blobs/x").exists());

        // A second run has nothing left to move and changes nothing.
        migrate(d, Some(hub.path()));
        assert_eq!(read("models/stt/ggml-small.bin"), "stt");
    }

    #[test]
    fn a_name_clash_leaves_the_old_file_in_place() {
        let data = TempDir::new().unwrap();
        let d = data.path();
        write(&d.join("llm-models/qwen/model.gguf"), "old");
        write(&d.join("models/llm/qwen/model.gguf"), "new");
        migrate(d, None);
        assert_eq!(
            fs::read_to_string(d.join("models/llm/qwen/model.gguf")).unwrap(),
            "new"
        );
        assert!(d.join("llm-models/qwen/model.gguf").exists());
    }
}
