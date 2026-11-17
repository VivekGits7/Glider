//! Read Aloud: speaks text with local voice models through
//! sherpa-onnx. Voices are downloaded on demand from sherpa-onnx's
//! `tts-models` release, like the speech-to-text models.

use super::catalog::{find_entry, CatalogEntry, CATALOG};
use super::worker::protocol::{Request, Response};
use super::worker::{LOG_LEVEL_ENV, WORKER_FLAG};
use crate::common::notices::{self, Notice, NoticeCode, NoticeSource};
use crate::common::overlay;
use crate::common::settings::{self, get_settings};
use crate::common::worker_kit::process::WorkerProcess;
use futures_util::StreamExt;
use log::{error, info};
use serde::Serialize;
use specta::Type;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::num::NonZero;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

/// Instructions for the voice model. None of the voices take any, so this
/// stays empty until a voice model that reads instructions is added.
#[allow(dead_code)]
pub const TTS_INSTRUCTION: &str = "";

const RELEASE_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models";
pub const SPEED_RANGE: std::ops::RangeInclusive<f32> = 0.5..=3.0;
/// espeak-ng keeps the first data path it is given for the whole process, so
/// every voice shares one copy that deleting a voice never removes.
const ESPEAK_DIR: &str = "espeak-ng-data";
/// The voice worker idles this long before its memory is given back.
const IDLE_UNLOAD: Duration = Duration::from_secs(5 * 60);
/// Loading a voice takes a second or two; past this the worker is stuck.
const LOAD_TIMEOUT: Duration = Duration::from_secs(120);
/// One sentence takes well under a second to voice on most computers.
const SENTENCE_TIMEOUT: Duration = Duration::from_secs(120);

/// The worker process voicing reads, and the voice it has loaded.
struct VoiceWorker {
    id: &'static str,
    /// The language it was loaded in (Kokoro 1.0 only).
    lang: Option<&'static str>,
    process: WorkerProcess<Response>,
    sample_rate: u32,
    voices: i32,
}

#[derive(Clone, Debug, Serialize, Type)]
pub struct TtsModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    /// ISO 639-1 codes it reads, the default first.
    pub languages: Vec<String>,
    /// Each voice's language when voices are tied to one; empty when every
    /// voice reads every language.
    pub voice_languages: Vec<String>,
    /// A to C.
    pub quality: String,
    /// `very_fast`, `fast` or `moderate`.
    pub speed: String,
    pub size_mb: u32,
    pub voices: Vec<String>,
    pub is_downloaded: bool,
    pub is_downloading: bool,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

/// Why a read could not start; mapped to a notice by the caller.
pub enum SpeakError {
    MissingModel,
    Failed(String),
}

struct Playback {
    stop: Arc<AtomicBool>,
    player: Arc<rodio::Player>,
    /// The read's sentences and the one playing, for the overlay's controls.
    sentences: Arc<Vec<String>>,
    index: Arc<AtomicUsize>,
}

pub struct TtsManager {
    app: AppHandle,
    models_dir: PathBuf,
    /// The voice worker. Each call holds this lock, so sentences are voiced
    /// one at a time.
    voice: Mutex<Option<VoiceWorker>>,
    /// The loaded voice and its worker's process id. Never held across a
    /// call, so live memory can read it while a sentence is being voiced.
    loaded: Mutex<Option<(&'static str, u32)>>,
    last_used: Mutex<Instant>,
    /// Bytes (downloaded, total) per voice being downloaded. The settings page
    /// polls this, so progress survives leaving and reopening the page.
    downloads: Mutex<HashMap<&'static str, (u64, u64)>>,
    /// Set to stop a download; the download removes itself when it sees it.
    cancels: Mutex<HashMap<&'static str, Arc<AtomicBool>>>,
    playback: Mutex<Option<Playback>>,
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

impl TtsManager {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let models_dir = crate::common::models_dir::ModelFolder::Voices
            .path(app)
            .map_err(|e| e.to_string())?;
        fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
        crate::features::stt::output::clipboard::watch_recent_copies();
        Ok(Self {
            app: app.clone(),
            models_dir,
            voice: Mutex::new(None),
            loaded: Mutex::new(None),
            last_used: Mutex::new(Instant::now()),
            downloads: Mutex::new(HashMap::new()),
            cancels: Mutex::new(HashMap::new()),
            playback: Mutex::new(None),
        })
    }

    fn model_dir(&self, entry: &CatalogEntry) -> PathBuf {
        self.models_dir.join(entry.id)
    }

    fn is_downloaded(&self, entry: &CatalogEntry) -> bool {
        self.model_dir(entry).join(entry.model_file).is_file()
            && (!entry.engine.uses_espeak() || self.models_dir.join(ESPEAK_DIR).is_dir())
    }

    pub fn models(&self) -> Vec<TtsModelInfo> {
        let downloads = lock(&self.downloads);
        CATALOG
            .iter()
            .map(|entry| {
                let progress = downloads.get(entry.id);
                TtsModelInfo {
                    id: entry.id.into(),
                    name: entry.name.into(),
                    description: entry.description.into(),
                    languages: entry.languages.iter().map(|l| l.to_string()).collect(),
                    voice_languages: entry
                        .voice_languages
                        .iter()
                        .map(|l| l.to_string())
                        .collect(),
                    quality: entry.quality.into(),
                    speed: entry.speed.into(),
                    size_mb: entry.size_mb,
                    voices: entry.voices.iter().map(|v| v.to_string()).collect(),
                    is_downloaded: self.is_downloaded(entry),
                    is_downloading: progress.is_some(),
                    downloaded_bytes: progress.map_or(0, |p| p.0),
                    total_bytes: progress.map_or(0, |p| p.1),
                }
            })
            .collect()
    }

    pub async fn download(&self, id: &str) -> Result<(), String> {
        let entry = find_entry(id).ok_or("Unknown voice model")?;
        {
            let mut downloads = lock(&self.downloads);
            if downloads.contains_key(entry.id) {
                return Err("This voice is already downloading".into());
            }
            downloads.insert(entry.id, (0, 0));
        }
        let cancel = Arc::new(AtomicBool::new(false));
        lock(&self.cancels).insert(entry.id, cancel.clone());
        let result = self.download_and_unpack(entry, &cancel).await;
        lock(&self.downloads).remove(entry.id);
        lock(&self.cancels).remove(entry.id);
        if cancel.load(Ordering::SeqCst) {
            info!("Voice model download cancelled: {}", entry.id);
            return Ok(());
        }
        if let Err(e) = &result {
            error!("Voice model download failed for {}: {e}", entry.id);
        }
        result
    }

    /// Stops a voice download in progress.
    pub fn cancel_download(&self, id: &str) {
        if let Some(cancel) = lock(&self.cancels).get(id) {
            cancel.store(true, Ordering::SeqCst);
        }
    }

    async fn download_and_unpack(
        &self,
        entry: &'static CatalogEntry,
        cancel: &AtomicBool,
    ) -> Result<(), String> {
        let archive = self.models_dir.join(format!("{}.tar.bz2.part", entry.id));
        let url = format!("{RELEASE_URL}/{}.tar.bz2", entry.id);
        info!("Downloading voice model {url}");

        let response = reqwest::get(&url)
            .await
            .and_then(|r| r.error_for_status())
            .map_err(|e| format!("Download failed: {e}"))?;
        // The catalog size stands in if the server doesn't send a length.
        let total = response
            .content_length()
            .unwrap_or(u64::from(entry.size_mb) * 1024 * 1024);
        let mut file = fs::File::create(&archive).map_err(|e| e.to_string())?;
        let mut stream = response.bytes_stream();
        let mut downloaded = 0u64;
        while let Some(chunk) = stream.next().await {
            if cancel.load(Ordering::SeqCst) {
                drop(file);
                let _ = fs::remove_file(&archive);
                return Ok(());
            }
            let chunk = chunk.map_err(|e| format!("Download failed: {e}"))?;
            file.write_all(&chunk).map_err(|e| e.to_string())?;
            downloaded += chunk.len() as u64;
            lock(&self.downloads).insert(entry.id, (downloaded, total));
        }
        drop(file);
        info!("Downloaded {downloaded} bytes for {}, unpacking", entry.id);

        let models_dir = self.models_dir.clone();
        let archive_path = archive.clone();
        let unpacked = tauri::async_runtime::spawn_blocking(move || {
            unpack(&archive_path, &models_dir, entry.id)
        })
        .await
        .map_err(|e| e.to_string())?;
        let _ = fs::remove_file(&archive);
        unpacked.map_err(|e| format!("Could not unpack the voice: {e}"))?;

        if !self.is_downloaded(entry) {
            return Err("The downloaded voice is missing its model file".into());
        }
        Ok(())
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let entry = find_entry(id).ok_or("Unknown voice model")?;
        let mut voice = lock(&self.voice);
        if voice.as_ref().is_some_and(|worker| worker.id == entry.id) {
            self.stop();
            self.set_voice(&mut voice, None);
        }
        drop(voice);
        let dir = self.model_dir(entry);
        if dir.exists() {
            fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// The worker holding `entry`'s voice in `language`, starting one (and
    /// loading the voice) if the loaded one is another voice or none.
    fn ensure_voice<'a>(
        &self,
        slot: &'a mut Option<VoiceWorker>,
        entry: &'static CatalogEntry,
        language: &str,
    ) -> Result<&'a mut VoiceWorker, String> {
        let lang = entry.load_language(language);
        if slot
            .as_ref()
            .is_some_and(|worker| worker.id == entry.id && worker.lang == lang)
        {
            return Ok(slot.as_mut().expect("checked above"));
        }
        // Free the old voice, and its worker, before loading the new one.
        self.set_voice(slot, None);
        let mut process = WorkerProcess::spawn("tts-worker", WORKER_FLAG, LOG_LEVEL_ENV)
            .map_err(|e| format!("Could not start the voice: {e}"))?;
        info!("Loading voice model {}", entry.id);
        let request = Request::Load {
            engine: entry.engine,
            model_dir: self.model_dir(entry),
            model_file: entry.model_file.into(),
            espeak_dir: self.models_dir.join(ESPEAK_DIR),
            lang: lang.map(str::to_string),
        };
        match process.call(&request, None, LOAD_TIMEOUT, "voice load") {
            Ok((
                Response::Loaded {
                    sample_rate,
                    voices,
                },
                _,
            )) => {
                self.set_voice(
                    slot,
                    Some(VoiceWorker {
                        id: entry.id,
                        lang,
                        process,
                        sample_rate,
                        voices,
                    }),
                );
                Ok(slot.as_mut().expect("set above"))
            }
            Ok((Response::Error(e), _)) => {
                error!("Could not load voice {}: {e}", entry.id);
                Err(format!("Could not load {}", entry.name))
            }
            Ok((other, _)) => Err(format!("Unexpected answer from the voice: {other:?}")),
            Err(failure) => Err(format!("Could not load {}: {failure}", entry.name)),
        }
    }

    /// Replaces the voice worker; dropping the old one ends its process.
    fn set_voice(&self, slot: &mut Option<VoiceWorker>, voice: Option<VoiceWorker>) {
        *lock(&self.loaded) = voice
            .as_ref()
            .map(|worker| (worker.id, worker.process.pid()));
        *slot = voice;
    }

    /// Voices one sentence with `entry`. Skipped once the read is stopped, so
    /// a stopped read never reloads its voice over a newer read's. A worker
    /// that crashed or hung is dropped; the next read starts a fresh one.
    fn synthesize(
        &self,
        entry: &'static CatalogEntry,
        text: &str,
        speed: f32,
        voice: i32,
        language: &'static str,
        stop: &AtomicBool,
    ) -> Result<Vec<f32>, String> {
        let mut slot = lock(&self.voice);
        if stop.load(Ordering::SeqCst) {
            return Ok(Vec::new());
        }
        let worker = self.ensure_voice(&mut slot, entry, language)?;
        let request = Request::Synthesize {
            text: text.into(),
            speed,
            voice,
            lang: entry.sentence_language(language).map(str::to_string),
        };
        match worker
            .process
            .call(&request, None, SENTENCE_TIMEOUT, "sentence")
        {
            Ok((Response::Audio, samples)) => Ok(samples),
            Ok((Response::Error(e), _)) => Err(e),
            Ok((other, _)) => Err(format!("Unexpected answer from the voice: {other:?}")),
            Err(failure) => {
                if failure.worker_lost() {
                    self.set_voice(&mut slot, None);
                }
                Err(format!("The voice stopped working: {failure}"))
            }
        }
    }

    /// The loaded voice and its worker's process id, for live memory.
    pub fn loaded_worker(&self) -> Option<(&'static str, u32)> {
        *lock(&self.loaded)
    }

    /// Ends the voice worker once no read has used it for [`IDLE_UNLOAD`],
    /// which gives all of its memory back.
    fn schedule_unload(&self) {
        *lock(&self.last_used) = Instant::now();
        let app = self.app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(IDLE_UNLOAD);
            let tts = manager(&app);
            if lock(&tts.last_used).elapsed() < IDLE_UNLOAD || tts.is_speaking() {
                return; // used again since; a later timer handles it
            }
            // Busy voicing: try_lock fails, and that read schedules its own.
            // Ends with `;` so the guard drops before `tts`.
            if let Ok(mut slot) = tts.voice.try_lock() {
                if slot.is_some() {
                    tts.set_voice(&mut slot, None);
                    info!("Unloaded the idle voice");
                }
            };
        });
    }

    /// Stops the current read. Returns whether something was playing.
    pub fn stop(&self) -> bool {
        match lock(&self.playback).take() {
            Some(playback) => {
                playback.stop.store(true, Ordering::SeqCst);
                playback.player.stop();
                true
            }
            None => false,
        }
    }

    /// The user stopped the read (Esc, the shortcut): put the player away
    /// now. The read's own thread can be busy loading the voice or voicing a
    /// sentence for seconds before it notices, so it can't be the one to.
    pub fn stop_and_close(&self) -> bool {
        let stopped = self.stop();
        overlay::hide_reading_overlay(&self.app);
        stopped
    }

    pub fn is_speaking(&self) -> bool {
        lock(&self.playback).is_some()
    }

    /// Pauses or resumes the read. Returns whether it's paused now.
    pub fn toggle_pause(&self) -> bool {
        let paused = match lock(&self.playback).as_ref() {
            Some(playback) if playback.player.is_paused() => {
                playback.player.play();
                false
            }
            Some(playback) => {
                playback.player.pause();
                true
            }
            None => false,
        };
        // F8 pauses without the overlay asking, so tell it either way.
        overlay::emit_reading_paused(&self.app, paused);
        paused
    }

    /// The read's sentences and the one playing, when something is reading.
    fn position(&self) -> Option<(Arc<Vec<String>>, usize)> {
        lock(&self.playback)
            .as_ref()
            .map(|p| (p.sentences.clone(), p.index.load(Ordering::SeqCst)))
    }

    /// Next sentence: skips the one playing. Each sentence is queued as a
    /// marker then its audio, so skipping the audio lands on the next marker.
    pub fn skip_forward(&self) {
        if let Some(playback) = lock(&self.playback).as_ref() {
            if playback.player.is_paused() {
                playback.player.play();
            }
            playback.player.skip_one();
        }
    }
}

/// Reads again from sentence `start` on its own thread: Previous, and a speed
/// change (the rest is voiced again at the new speed, so the pitch stays).
pub(crate) fn restart_at(app: &AppHandle, start: impl FnOnce(usize) -> usize + Send + 'static) {
    let app = app.clone();
    std::thread::spawn(move || {
        let tts = app.state::<Arc<TtsManager>>();
        let Some((sentences, index)) = tts.position() else {
            return;
        };
        let from = start(index).min(sentences.len().saturating_sub(1));
        if let Err(e) = tts.speak_from(sentences, from, None, false) {
            raise_speak_error(&app, e);
        }
    });
}

impl TtsManager {
    /// Speaks `text` and blocks until it finishes or is stopped. Run it on
    /// its own thread.
    pub fn speak(&self, text: &str) -> Result<(), SpeakError> {
        self.speak_with(text, None)
    }

    /// Speaks `text` with `preview`'s voice instead of the chosen one, for
    /// "Hear a sample": no overlay, no history.
    pub(super) fn speak_with(
        &self,
        text: &str,
        preview: Option<&'static CatalogEntry>,
    ) -> Result<(), SpeakError> {
        let sentences = split_sentences(text);
        if sentences.is_empty() {
            self.stop();
            return Ok(());
        }
        self.speak_from(Arc::new(sentences), 0, preview, true)
    }

    /// Reads `sentences` from `start`. `record` saves the read to History and
    /// Insights; a restart from the overlay's controls doesn't, so a read
    /// counts once.
    fn speak_from(
        &self,
        sentences: Arc<Vec<String>>,
        start: usize,
        preview: Option<&'static CatalogEntry>,
        record: bool,
    ) -> Result<(), SpeakError> {
        self.stop();
        let text = sentences.join(" ");

        let mut settings = get_settings(&self.app);
        let entry = match preview {
            Some(entry) => {
                if entry.id != settings.tts_model {
                    settings.tts_voice = 0;
                }
                entry
            }
            None => find_entry(&settings.tts_model).ok_or(SpeakError::MissingModel)?,
        };
        if !self.is_downloaded(entry) {
            return Err(SpeakError::MissingModel);
        }

        let mut device_sink = crate::common::audio::feedback::open_output_sink(
            settings.selected_output_device.clone(),
        )
        .map_err(|e| SpeakError::Failed(format!("Could not open the speaker: {e}")))?;
        device_sink.log_on_drop(false);
        let player = Arc::new(rodio::Player::connect_new(device_sink.mixer()));
        let stop = Arc::new(AtomicBool::new(false));
        let index = Arc::new(AtomicUsize::new(start));
        // Registered before the voice loads, so the shortcut can stop a slow start.
        *lock(&self.playback) = Some(Playback {
            stop: stop.clone(),
            player: player.clone(),
            sentences: sentences.clone(),
            index: index.clone(),
        });
        if preview.is_none() {
            overlay::show_reading_overlay(&self.app);
        }

        let started = std::time::Instant::now();
        let queued =
            self.queue_sentences(entry, &settings, &sentences, start, &index, &player, &stop);
        let record = record && preview.is_none();
        if queued.is_ok() && record {
            self.save_to_history(entry, &settings, &sentences);
        }
        if queued.is_ok() && !stop.load(Ordering::SeqCst) {
            player.sleep_until_end();
        }
        if queued.is_ok() && record {
            if let Some(history) = self
                .app
                .try_state::<Arc<crate::features::history::service::HistoryManager>>()
            {
                history.record_activity(crate::features::insights::service::Activity::Read {
                    words: crate::features::history::service::word_count(&text),
                    duration_ms: started.elapsed().as_millis() as u64,
                    speed: settings.tts_speed,
                });
            }
        }
        self.finish(&stop, queued.is_ok());
        self.schedule_unload();
        queued
    }

    /// Keeps the read in History and Home's word count. Never blocks reading.
    fn save_to_history(
        &self,
        entry: &CatalogEntry,
        settings: &settings::AppSettings,
        sentences: &[String],
    ) {
        let Some(history) = self
            .app
            .try_state::<Arc<crate::features::history::service::HistoryManager>>()
        else {
            return;
        };
        let language = entry.reading_language(&settings.tts_languages);
        let index = entry.voice_for(settings.tts_voice.max(0), language);
        let voice = entry
            .voices
            .get(index as usize)
            .map_or(entry.name.to_string(), |speaker| {
                if entry.voices.len() > 1 {
                    format!("{} · {speaker}", entry.name)
                } else {
                    entry.name.to_string()
                }
            });
        if let Err(e) = history.save_read_aloud(&sentences.join(" "), &voice, settings.tts_speed) {
            error!("Failed to save the read to history: {e}");
        }
    }

    /// Generates each sentence and queues it behind a marker that tells the
    /// overlay which sentence is playing once playback reaches it. Generation
    /// runs ahead of playback, so there are no gaps between sentences.
    // The read's state travels as plain arguments: bundling them would only
    // move the same eight names into a struct used once.
    #[allow(clippy::too_many_arguments)]
    fn queue_sentences(
        &self,
        entry: &'static CatalogEntry,
        settings: &settings::AppSettings,
        sentences: &[String],
        start: usize,
        playing: &Arc<AtomicUsize>,
        player: &rodio::Player,
        stop: &Arc<AtomicBool>,
    ) -> Result<(), SpeakError> {
        let language = entry.reading_language(&settings.tts_languages);
        let (sample_rate, voices) = {
            let mut slot = lock(&self.voice);
            let worker = self
                .ensure_voice(&mut slot, entry, language)
                .map_err(SpeakError::Failed)?;
            (worker.sample_rate, worker.voices)
        };
        let sample_rate = NonZero::new(sample_rate.max(1)).expect("max(1) is non-zero");
        let speed = settings
            .tts_speed
            .clamp(*SPEED_RANGE.start(), *SPEED_RANGE.end());
        let voice = entry.voice_for(settings.tts_voice.clamp(0, (voices - 1).max(0)), language);

        let mut spoken = 0;
        for (index, sentence) in sentences.iter().enumerate().skip(start) {
            if stop.load(Ordering::SeqCst) {
                break;
            }
            let samples = self
                .synthesize(entry, sentence, speed, voice, language, stop)
                .map_err(SpeakError::Failed)?;
            if samples.is_empty() {
                // A sentence of only symbols has nothing to say; keep going.
                continue;
            }
            let app = self.app.clone();
            let marker_stop = stop.clone();
            let marker_index = playing.clone();
            let progress = overlay::ReadingProgress {
                // The overlay shows a few lines, so the recent past is enough.
                done: sentences[index.saturating_sub(3)..index].join(" "),
                current: sentence.clone(),
                index,
                total: sentences.len(),
                ms: samples.len() as u64 * 1000 / u64::from(sample_rate.get()),
            };
            player.append(rodio::source::EmptyCallback::new(Box::new(move || {
                if !marker_stop.load(Ordering::SeqCst) {
                    marker_index.store(index, Ordering::SeqCst);
                    overlay::emit_reading_progress(&app, progress.clone());
                }
            })));
            player.append(rodio::buffer::SamplesBuffer::new(
                NonZero::<u16>::MIN,
                sample_rate,
                samples,
            ));
            spoken += 1;
        }

        if spoken == 0 && !stop.load(Ordering::SeqCst) {
            return Err(SpeakError::Failed(
                "The voice could not read this text".into(),
            ));
        }
        Ok(())
    }

    /// Clears the playback slot if it still belongs to this read, and puts the
    /// overlay away unless a newer read took over. A read that reached its end
    /// says "Done reading" first; a stopped or failed one just goes.
    fn finish(&self, stop: &Arc<AtomicBool>, completed: bool) {
        let mut playback = lock(&self.playback);
        if playback
            .as_ref()
            .is_some_and(|p| Arc::ptr_eq(&p.stop, stop))
        {
            *playback = None;
        }
        drop(playback);
        if !self.is_speaking() {
            if completed && !stop.load(Ordering::SeqCst) && overlay::is_reading_showing() {
                overlay::show_read_done(&self.app);
            } else {
                overlay::hide_reading_overlay(&self.app);
            }
            let _ = tauri::Emitter::emit(&self.app, "read-aloud-finished", ());
        }
    }
}

/// Selected text often carries hard line breaks (PDFs, terminals); reading
/// them as one flowing text sounds natural.
fn clean_text(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Splits text into the sentences the overlay shows one at a time: at blank
/// lines, and after . ! ? । … when followed by a space. Single line breaks are
/// joined, since PDFs and terminals wrap mid-sentence.
fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    for paragraph in text.replace("\r\n", "\n").split("\n\n") {
        let mut current = String::new();
        let mut chars = paragraph.chars().peekable();
        while let Some(c) = chars.next() {
            current.push(c);
            let ends = matches!(c, '.' | '!' | '?' | '।' | '…')
                && chars.peek().is_none_or(|next| next.is_whitespace());
            if ends {
                sentences.push(clean_text(&current));
                current.clear();
            }
        }
        sentences.push(clean_text(&current));
    }
    sentences.retain(|sentence| !sentence.is_empty());
    sentences
}

/// Unpacks `<id>.tar.bz2` into `models_dir/<id>` atomically: it is extracted
/// to a scratch folder first, so a half-unpacked voice never looks installed.
/// Its espeak-ng data moves to the shared folder (see [`ESPEAK_DIR`]).
fn unpack(archive: &Path, models_dir: &Path, id: &str) -> std::io::Result<()> {
    let scratch = models_dir.join(format!("{id}.unpacking"));
    let _ = fs::remove_dir_all(&scratch);
    fs::create_dir_all(&scratch)?;
    // tar's unpack refuses entries that escape the target (`..`, absolute paths).
    tar::Archive::new(bzip2::read::BzDecoder::new(fs::File::open(archive)?)).unpack(&scratch)?;
    let bundled_espeak = scratch.join(id).join(ESPEAK_DIR);
    let shared_espeak = models_dir.join(ESPEAK_DIR);
    if bundled_espeak.is_dir() && !shared_espeak.is_dir() {
        fs::rename(&bundled_espeak, &shared_espeak)?;
    }
    let _ = fs::remove_dir_all(&bundled_espeak);
    let target = models_dir.join(id);
    let _ = fs::remove_dir_all(&target);
    fs::rename(scratch.join(id), &target)?;
    let _ = fs::remove_dir_all(&scratch);
    Ok(())
}

pub(super) fn raise_speak_error(app: &AppHandle, error: SpeakError) {
    let notice = match error {
        SpeakError::MissingModel => {
            Notice::new(NoticeCode::VoiceModelMissing, NoticeSource::ReadAloud)
        }
        SpeakError::Failed(detail) => {
            error!("Read Aloud failed: {detail}");
            Notice::new(NoticeCode::ReadAloudFailed, NoticeSource::ReadAloud).with_detail(detail)
        }
    };
    notices::raise(app, notice);
}

pub(super) fn speak_on_thread(app: &AppHandle, text: Option<String>) {
    let app = app.clone();
    std::thread::spawn(move || {
        let tts = app.state::<Arc<TtsManager>>();
        // `None` means: grab the selection from the focused app.
        let text = match text {
            Some(text) => text,
            None => match crate::features::stt::output::clipboard::selected_text(&app) {
                Ok(Some(text)) => text,
                Ok(None) => {
                    notices::raise(
                        &app,
                        Notice::new(NoticeCode::NoTextSelected, NoticeSource::ReadAloud),
                    );
                    return;
                }
                Err(e) => return raise_speak_error(&app, SpeakError::Failed(e)),
            },
        };
        notices::clear(&app, NoticeSource::ReadAloud);
        if let Err(e) = tts.speak(&text) {
            raise_speak_error(&app, e);
        }
    });
}

/// The Read Aloud shortcut: stops a read in progress, otherwise reads the
/// current selection.
pub fn toggle_read_selection(app: &AppHandle) {
    let Some(tts) = app.try_state::<Arc<TtsManager>>() else {
        return;
    };
    if !tts.stop_and_close() {
        speak_on_thread(app, None);
    }
}

pub(super) fn manager(app: &AppHandle) -> Arc<TtsManager> {
    app.state::<Arc<TtsManager>>().inner().clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_text_joins_hard_line_breaks() {
        assert_eq!(
            clean_text("  Hello\nworld.\n\n  Next\tline "),
            "Hello world. Next line"
        );
        assert_eq!(clean_text(" \n "), "");
    }

    #[test]
    fn split_sentences_follows_punctuation_and_paragraphs() {
        assert_eq!(
            split_sentences("Hello there. How are you?\nFine!\n\nNew  para"),
            vec!["Hello there.", "How are you?", "Fine!", "New para"]
        );
        // Decimals and versions are not sentence ends; Hindi danda is.
        assert_eq!(
            split_sentences("Pi is 3.14 today. नमस्ते। ठीक है"),
            vec!["Pi is 3.14 today.", "नमस्ते।", "ठीक है"]
        );
        assert!(split_sentences(" \n\n ").is_empty());
    }

    #[test]
    fn unpack_installs_only_complete_archives() {
        let tmp = tempfile::tempdir().unwrap();
        let id = "voice-test";
        // Build a tiny .tar.bz2 shaped like a sherpa release archive.
        let archive_path = tmp.path().join("voice.tar.bz2");
        {
            let encoder = bzip2::write::BzEncoder::new(
                fs::File::create(&archive_path).unwrap(),
                bzip2::Compression::fast(),
            );
            let mut builder = tar::Builder::new(encoder);
            for name in ["model.onnx", "espeak-ng-data/phontab"] {
                let data = b"onnx";
                let mut header = tar::Header::new_gnu();
                header.set_size(data.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder
                    .append_data(&mut header, format!("{id}/{name}"), &data[..])
                    .unwrap();
            }
            builder.into_inner().unwrap().finish().unwrap();
        }
        unpack(&archive_path, tmp.path(), id).unwrap();
        assert_eq!(
            fs::read(tmp.path().join(id).join("model.onnx")).unwrap(),
            b"onnx"
        );
        assert!(!tmp.path().join(format!("{id}.unpacking")).exists());
        // espeak data is moved to the shared folder, out of the voice folder.
        assert!(tmp.path().join(ESPEAK_DIR).join("phontab").is_file());
        assert!(!tmp.path().join(id).join(ESPEAK_DIR).exists());

        // A corrupt archive fails without leaving an installed folder behind.
        fs::write(&archive_path, b"not bzip2").unwrap();
        fs::remove_dir_all(tmp.path().join(id)).unwrap();
        assert!(unpack(&archive_path, tmp.path(), id).is_err());
        assert!(!tmp.path().join(id).exists());
    }
}
