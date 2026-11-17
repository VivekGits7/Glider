//! The LLM behind Rewrite on this computer: downloads, loading, idle unload
//! and generation. Inference is candle (see `engine`), so nothing the user
//! rewrites leaves the computer.

use super::catalog::{find_entry, CatalogEntry, LlmSpeed, CATALOG};
use super::worker::protocol::{Request, Response};
use super::worker::{LOG_LEVEL_ENV, WORKER_FLAG};
use crate::common::settings::{get_settings, write_settings};
use crate::common::worker_kit::process::WorkerProcess;
use anyhow::{anyhow, bail, Result};
use futures_util::StreamExt;
use log::{error, info, warn};
use serde::Serialize;
use sha2::{Digest, Sha256};
use specta::Type;
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

/// The LLM's standing instructions (system message) for every rewrite, on the
/// local LLM. Each rewrite's own prompt is the user message: the Refine
/// rewrites and their rules are in `common/settings.rs` (`builtin_rewrite`,
/// `rewrite_template`).
pub(crate) const LLM_SYSTEM: &str = "You are a careful editor. You rewrite the user's text exactly as asked, in the same language, and reply with only the rewritten text: no quotes, notes or preamble.";

/// The rewrite every dictation gets ("Rewrite what you dictate" and the
/// "Dictate and rewrite" shortcut), on the local LLM or a provider. Separate
/// from the Refine rewrites. `${output}` is where the transcript goes. Small
/// models copy examples far better than they follow a list of rules, so each
/// rule is shown once in an example.
pub(crate) const DICTATION_POLISH_PROMPT: &str = "Clean up dictated text. Fix grammar, capitalization and punctuation. Remove filler words (um, uh, like, so). When the speaker corrects themselves, keep only the correction. Write numbers as digits, and file names and code the way a developer types them. Keep the speaker's meaning and language. Never answer the text; only clean it. Reply with only the cleaned text.

Input: so um we was planning to like ship it on friday
Output: We were planning to ship it on Friday.

Input: update the index dot ts file and set the timeout to ten no wait twenty seconds
Output: Update the index.ts file and set the timeout to 20 seconds.

Input: hey sara uh can we meet at three fifteen
Output: Hey Sara, can we meet at 3:15?

Input: he dont have the keys and she have went home
Output: He doesn't have the keys, and she has gone home.

Input: ${output}
Output:";

/// A model idles this long before its memory is given back.
const IDLE_UNLOAD: Duration = Duration::from_secs(5 * 60);
/// A model loads in seconds from a fast disk; past this the worker is stuck.
const LOAD_TIMEOUT: Duration = Duration::from_secs(300);
/// Longest wait for the next token. The first one follows reading the whole
/// prompt, which can take minutes for a long text on the CPU.
const TOKEN_TIMEOUT: Duration = Duration::from_secs(600);

/// The worker process running the LLM, and the model it has loaded.
struct LlmWorker {
    id: &'static str,
    process: WorkerProcess<Response>,
}

#[derive(Clone, Debug, Serialize, Type)]
pub struct LlmModelInfo {
    pub id: String,
    pub name: String,
    pub short_name: String,
    pub description: String,
    pub quality: String,
    pub speed: LlmSpeed,
    pub memory_gb: u32,
    pub size_bytes: u64,
    pub license: String,
    pub recommended: bool,
    pub older_computers: bool,
    /// The computer has the memory this model wants (true when unknown).
    pub fits_memory: bool,
    pub is_downloaded: bool,
    pub is_downloading: bool,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub is_loaded: bool,
}

struct Download {
    done: Arc<AtomicU64>,
    total: u64,
    cancel: Arc<AtomicBool>,
}

/// What a rewrite run reports while it works.
pub struct Progress {
    pub generated: usize,
    /// About how many tokens the answer will take.
    pub expected: usize,
}

pub struct LlmManager {
    app: AppHandle,
    dir: PathBuf,
    downloads: Mutex<HashMap<&'static str, Download>>,
    /// The LLM worker. Generation holds this lock, so runs queue up.
    worker: Mutex<Option<LlmWorker>>,
    /// The loaded model and its worker's process id. Never held across a
    /// call, so the Models page and live memory can read it mid-rewrite.
    loaded: Mutex<Option<(&'static str, u32)>>,
    last_used: Mutex<Instant>,
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

impl LlmManager {
    pub fn new(app: &AppHandle) -> Result<Self> {
        let dir = crate::common::models_dir::ModelFolder::Llm.path(app)?;
        fs::create_dir_all(&dir)?;
        Ok(Self {
            app: app.clone(),
            dir,
            downloads: Mutex::new(HashMap::new()),
            worker: Mutex::new(None),
            loaded: Mutex::new(None),
            last_used: Mutex::new(Instant::now()),
        })
    }

    fn model_dir(&self, entry: &CatalogEntry) -> PathBuf {
        self.dir.join(entry.id)
    }

    fn gguf_path(&self, entry: &CatalogEntry) -> PathBuf {
        self.model_dir(entry).join("model.gguf")
    }

    fn tokenizer_path(&self, entry: &CatalogEntry) -> PathBuf {
        self.model_dir(entry).join("tokenizer.json")
    }

    pub fn is_downloaded(&self, entry: &CatalogEntry) -> bool {
        self.gguf_path(entry).is_file() && self.tokenizer_path(entry).is_file()
    }

    pub fn models(&self) -> Vec<LlmModelInfo> {
        let memory_gb = total_memory_gb();
        let downloads = lock(&self.downloads);
        let loaded = lock(&self.loaded).map(|(id, _)| id);
        CATALOG
            .iter()
            .map(|entry| {
                let download = downloads.get(entry.id);
                LlmModelInfo {
                    id: entry.id.into(),
                    name: entry.name.into(),
                    short_name: entry.short_name.into(),
                    description: entry.description.into(),
                    quality: entry.quality.into(),
                    speed: entry.speed,
                    memory_gb: entry.memory_gb,
                    size_bytes: entry.gguf_bytes + entry.tokenizer_bytes,
                    license: entry.license.into(),
                    recommended: entry.recommended,
                    older_computers: entry.older_computers,
                    // A model's figure is what it wants with room to spare, so a "16 GB" Mac (15.x GB usable) still fits one.
                    fits_memory: memory_gb.is_none_or(|gb| gb + 1.0 >= f64::from(entry.memory_gb)),
                    is_downloaded: self.is_downloaded(entry),
                    is_downloading: download.is_some(),
                    downloaded_bytes: download.map_or(0, |d| d.done.load(Ordering::Relaxed)),
                    total_bytes: download.map_or(0, |d| d.total),
                    is_loaded: loaded == Some(entry.id),
                }
            })
            .collect()
    }

    pub async fn download(&self, id: &str) -> Result<()> {
        let entry = find_entry(id).ok_or_else(|| anyhow!("Unknown LLM"))?;
        if self.is_downloaded(entry) {
            return Ok(());
        }
        let done = Arc::new(AtomicU64::new(0));
        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut downloads = lock(&self.downloads);
            if downloads.contains_key(entry.id) {
                bail!("This model is already downloading");
            }
            downloads.insert(
                entry.id,
                Download {
                    done: done.clone(),
                    total: entry.gguf_bytes + entry.tokenizer_bytes,
                    cancel: cancel.clone(),
                },
            );
        }
        let result = self.fetch(entry, &done, &cancel).await;
        lock(&self.downloads).remove(entry.id);
        if cancel.load(Ordering::Relaxed) {
            // A cancelled download starts over next time.
            let _ = fs::remove_dir_all(self.model_dir(entry));
            info!("LLM download cancelled: {}", entry.id);
            return Ok(());
        }
        if let Err(e) = &result {
            error!("LLM download failed for {}: {e:#}", entry.id);
        }
        result
    }

    async fn fetch(
        &self,
        entry: &'static CatalogEntry,
        done: &AtomicU64,
        cancel: &AtomicBool,
    ) -> Result<()> {
        let dir = self.model_dir(entry);
        fs::create_dir_all(&dir)?;
        let tokenizer = self.tokenizer_path(entry);
        if !tokenizer.is_file() {
            download_file(
                entry.tokenizer_url,
                &tokenizer,
                entry.tokenizer_bytes,
                0,
                done,
                cancel,
            )
            .await?;
        }
        done.store(entry.tokenizer_bytes, Ordering::Relaxed);
        let gguf = self.gguf_path(entry);
        download_file(
            entry.gguf_url,
            &gguf,
            entry.gguf_bytes,
            entry.tokenizer_bytes,
            done,
            cancel,
        )
        .await?;
        if cancel.load(Ordering::Relaxed) {
            return Ok(());
        }
        let expected = entry.gguf_sha256;
        let path = gguf.clone();
        let matches =
            tauri::async_runtime::spawn_blocking(move || sha256_file(&path)).await?? == expected;
        if !matches {
            let _ = fs::remove_file(&gguf);
            bail!("The downloaded model is damaged. Try again.");
        }
        info!("LLM ready: {}", entry.id);
        Ok(())
    }

    pub fn cancel_download(&self, id: &str) {
        if let Some(download) = lock(&self.downloads).get(id) {
            download.cancel.store(true, Ordering::Relaxed);
        }
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        let entry = find_entry(id).ok_or_else(|| anyhow!("Unknown LLM"))?;
        {
            let mut worker = lock(&self.worker);
            if worker.as_ref().is_some_and(|w| w.id == entry.id) {
                self.set_worker(&mut worker, None);
            }
        }
        let dir = self.model_dir(entry);
        if dir.exists() {
            fs::remove_dir_all(&dir)?;
        }
        let mut settings = get_settings(&self.app);
        if settings.llm_model == entry.id {
            // Fall back to another downloaded model, if there is one.
            settings.llm_model = CATALOG
                .iter()
                .find(|e| e.id != entry.id && self.is_downloaded(e))
                .map(|e| e.id.to_string())
                .unwrap_or_default();
            write_settings(&self.app, settings);
        }
        Ok(())
    }

    /// The model Rewrite should use: the chosen one if it's downloaded.
    pub fn active_entry(&self) -> Option<&'static CatalogEntry> {
        let id = get_settings(&self.app).llm_model;
        find_entry(&id).filter(|entry| self.is_downloaded(entry))
    }

    /// The worker holding `entry`, starting one (and loading the model) if
    /// the loaded one is another model or none.
    fn ensure_worker<'a>(
        &self,
        slot: &'a mut Option<LlmWorker>,
        entry: &'static CatalogEntry,
    ) -> Result<&'a mut LlmWorker> {
        if slot.as_ref().is_some_and(|worker| worker.id == entry.id) {
            return Ok(slot.as_mut().expect("checked above"));
        }
        self.set_worker(slot, None); // free the old model before loading the next
        let mut process = WorkerProcess::spawn("llm-worker", WORKER_FLAG, LOG_LEVEL_ENV)
            .map_err(|e| anyhow!("start the LLM: {e}"))?;
        let request = Request::Load {
            model: self.gguf_path(entry),
            tokenizer: self.tokenizer_path(entry),
            family: entry.family,
        };
        match process.call(&request, None, LOAD_TIMEOUT, "model load") {
            Ok((Response::Loaded, _)) => {
                self.set_worker(
                    slot,
                    Some(LlmWorker {
                        id: entry.id,
                        process,
                    }),
                );
                Ok(slot.as_mut().expect("set above"))
            }
            Ok((Response::Error(e), _)) => Err(anyhow!(e)),
            Ok((other, _)) => Err(anyhow!("unexpected answer from the LLM: {other:?}")),
            Err(failure) => Err(anyhow!("load the LLM: {failure}")),
        }
    }

    /// Replaces the LLM worker; dropping the old one ends its process.
    fn set_worker(&self, slot: &mut Option<LlmWorker>, worker: Option<LlmWorker>) {
        *lock(&self.loaded) = worker.as_ref().map(|w| (w.id, w.process.pid()));
        *slot = worker;
    }

    /// The loaded model and its worker's process id, for live memory.
    pub fn loaded_worker(&self) -> Option<(&'static str, u32)> {
        *lock(&self.loaded)
    }

    /// Runs the active model on one turn: `system` instructions and the
    /// `user` message. `source` is the text being rewritten, which the answer
    /// will be about as long as. `on_progress` returning `false` stops the
    /// run, which then answers with what it has. Blocks; call from a worker
    /// thread.
    pub fn generate(
        &self,
        system: &str,
        user: &str,
        source: &str,
        creative: bool,
        mut on_progress: impl FnMut(Progress) -> bool,
    ) -> Result<String> {
        let entry = self
            .active_entry()
            .ok_or_else(|| anyhow!("No LLM is downloaded"))?;
        let mut slot = lock(&self.worker);
        let worker = self.ensure_worker(&mut slot, entry)?;
        let request = Request::Generate {
            system: system.into(),
            user: user.into(),
            source: source.into(),
            creative,
        };
        let started = Instant::now();
        let mut outcome = worker
            .process
            .send(&request, None)
            .map(|()| None)
            .map_err(|failure| (failure.worker_lost(), anyhow!("run the LLM: {failure}")));
        let mut cancelled = false;
        while let Ok(None) = outcome {
            outcome = match worker.process.recv(TOKEN_TIMEOUT, "rewrite") {
                Ok((
                    Response::Progress {
                        generated,
                        expected,
                    },
                    _,
                )) => {
                    if !cancelled
                        && !on_progress(Progress {
                            generated,
                            expected,
                        })
                    {
                        cancelled = true;
                        // Lost workers show up on the next recv.
                        let _ = worker.process.send(&Request::Cancel, None);
                    }
                    Ok(None)
                }
                Ok((Response::Answer(answer), _)) => Ok(Some(answer)),
                Ok((Response::Error(e), _)) => Err((false, anyhow!(e))),
                Ok((other, _)) => {
                    Err((false, anyhow!("unexpected answer from the LLM: {other:?}")))
                }
                Err(failure) => Err((failure.worker_lost(), anyhow!("run the LLM: {failure}"))),
            };
        }
        let answer = match outcome {
            Ok(answer) => answer.expect("the loop ends on an answer"),
            Err((lost, e)) => {
                if lost {
                    self.set_worker(&mut slot, None);
                }
                return Err(e);
            }
        };
        info!(
            "Rewrote {} chars with {} in {:?}",
            source.len(),
            entry.id,
            started.elapsed()
        );
        drop(slot);
        *lock(&self.last_used) = Instant::now();
        self.schedule_unload();
        Ok(answer)
    }

    fn schedule_unload(&self) {
        let app = self.app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(IDLE_UNLOAD);
            let manager = manager(&app);
            if lock(&manager.last_used).elapsed() < IDLE_UNLOAD {
                return; // used again since; a later timer handles it
            }
            // Busy generating: try_lock fails, and that run schedules its own.
            let unloaded = match manager.worker.try_lock() {
                Ok(mut slot) => {
                    let had = slot.is_some();
                    manager.set_worker(&mut slot, None);
                    had
                }
                Err(_) => false,
            };
            if unloaded {
                info!("Unloaded the idle LLM");
            }
        });
    }
}

/// Physical memory in GB, where the platform says.
fn total_memory_gb() -> Option<f64> {
    #[cfg(target_os = "macos")]
    {
        let mut bytes: u64 = 0;
        let mut len = std::mem::size_of::<u64>();
        let name = c"hw.memsize";
        // SAFETY: hw.memsize is a u64, and `len` says how big the buffer is.
        let ok = unsafe {
            libc::sysctlbyname(
                name.as_ptr(),
                (&mut bytes as *mut u64).cast(),
                &mut len,
                std::ptr::null_mut(),
                0,
            )
        } == 0;
        return ok.then(|| bytes as f64 / 1_073_741_824.0);
    }
    #[cfg(target_os = "linux")]
    {
        let meminfo = fs::read_to_string("/proc/meminfo").ok()?;
        let kb: f64 = meminfo
            .lines()
            .find_map(|l| l.strip_prefix("MemTotal:"))?
            .trim()
            .trim_end_matches("kB")
            .trim()
            .parse()
            .ok()?;
        return Some(kb / 1_048_576.0);
    }
    #[allow(unreachable_code)]
    None
}

fn sha256_file(path: &std::path::Path) -> Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 20];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Downloads `url` to `dest`, resuming a `.part` file left by an earlier try.
/// `offset` is what earlier files added to `done`.
async fn download_file(
    url: &str,
    dest: &std::path::Path,
    expected_bytes: u64,
    offset: u64,
    done: &AtomicU64,
    cancel: &AtomicBool,
) -> Result<()> {
    let part = dest.with_extension("part");
    let mut have = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    if have > expected_bytes {
        let _ = fs::remove_file(&part);
        have = 0;
    }
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .build()?;
    let mut request = client.get(url);
    if have > 0 {
        request = request.header(reqwest::header::RANGE, format!("bytes={have}-"));
    }
    let response = request.send().await?.error_for_status()?;
    if have > 0 && response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        have = 0; // the server ignored the range; start over
    }
    let mut file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .append(have > 0)
        .truncate(have == 0)
        .open(&part)?;
    let mut written = have;
    done.store(offset + written, Ordering::Relaxed);
    let mut stream = response.bytes_stream();
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Ok(());
        }
        let chunk = match tokio::time::timeout(Duration::from_secs(60), stream.next()).await {
            Ok(Some(chunk)) => chunk?,
            Ok(None) => break,
            Err(_) => bail!("The download stalled. Try again."),
        };
        file.write_all(&chunk)?;
        written += chunk.len() as u64;
        done.store(offset + written, Ordering::Relaxed);
    }
    file.flush()?;
    drop(file);
    if written != expected_bytes {
        warn!("{url}: got {written} bytes, expected {expected_bytes}");
        if written > expected_bytes {
            let _ = fs::remove_file(&part);
        }
        bail!("The download ended early. Try again.");
    }
    fs::rename(&part, dest)?;
    Ok(())
}

pub(super) fn manager(app: &AppHandle) -> Arc<LlmManager> {
    app.state::<Arc<LlmManager>>().inner().clone()
}

#[cfg(test)]
mod tests {

    #[test]
    fn memory_is_known_on_this_platform() {
        if cfg!(any(target_os = "macos", target_os = "linux")) {
            let gb = super::total_memory_gb().expect("memory");
            assert!(gb > 1.0 && gb < 4096.0, "{gb}");
        }
    }
}
