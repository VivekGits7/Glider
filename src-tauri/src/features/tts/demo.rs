//! The intro examples' voice: short clips recorded with Supertonic 3 and
//! bundled in `resources/demo/<lang>/<clip>.mp3`, so the examples speak at
//! once, and without a downloaded voice. `worker::tests::renders_the_demo_clips`
//! makes them.

use crate::common::settings;
use rodio::buffer::SamplesBuffer;
use rodio::Source;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use tauri::{AppHandle, Manager};

/// Which play is current: a newer clip or [`stop`] bumps it, and a clip that
/// is no longer current never starts or is stopped.
static CURRENT: AtomicU64 = AtomicU64::new(0);
static PLAYING: Mutex<Option<Arc<rodio::Player>>> = Mutex::new(None);

/// Plays `clip` ("dictation" or "read") in `language`. Returns how long it runs
/// in ms, or `None` when there's no clip for that language (the example then
/// voices its line live).
pub fn play(app: &AppHandle, clip: &str, language: &str) -> Result<Option<u64>, String> {
    if !matches!(clip, "dictation" | "read")
        || language.is_empty()
        || !language
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err("Unknown example clip".into());
    }
    let Ok(path) = app.path().resolve(
        format!("resources/demo/{language}/{clip}.mp3"),
        tauri::path::BaseDirectory::Resource,
    ) else {
        return Ok(None);
    };
    if !path.is_file() {
        return Ok(None);
    }
    let (audio, ms) = load(&path)?;

    stop();
    let play = CURRENT.load(Ordering::SeqCst);
    let device = settings::get_settings(app).selected_output_device;
    std::thread::spawn(move || {
        let sink = match crate::common::audio::feedback::open_output_sink(device) {
            Ok(mut sink) => {
                sink.log_on_drop(false);
                sink
            }
            Err(e) => {
                log::warn!("Could not open the speaker for the example: {e}");
                return;
            }
        };
        let player = Arc::new(rodio::Player::connect_new(sink.mixer()));
        {
            let mut playing = PLAYING.lock().unwrap_or_else(PoisonError::into_inner);
            if CURRENT.load(Ordering::SeqCst) != play {
                return; // stopped, or replaced, while the speaker opened
            }
            player.append(audio);
            *playing = Some(player.clone());
        }
        player.sleep_until_end();
        let mut playing = PLAYING.lock().unwrap_or_else(PoisonError::into_inner);
        if playing.as_ref().is_some_and(|p| Arc::ptr_eq(p, &player)) {
            *playing = None;
        }
    });
    Ok(Some(ms))
}

/// Decodes a clip, and how long it runs in ms. A few seconds of audio, decoded
/// up front so its exact length is known.
fn load(path: &Path) -> Result<(SamplesBuffer, u64), String> {
    let file = File::open(path).map_err(|e| format!("Could not open the example: {e}"))?;
    let decoder = rodio::Decoder::new(BufReader::new(file))
        .map_err(|e| format!("Could not read the example: {e}"))?;
    let (channels, rate) = (decoder.channels(), decoder.sample_rate());
    let samples: Vec<f32> = decoder.collect();
    let ms = samples.len() as u64 * 1000 / (u64::from(rate.get()) * u64::from(channels.get()));
    Ok((SamplesBuffer::new(channels, rate, samples), ms))
}

/// Stops the example's clip, if one is playing or about to.
pub fn stop() {
    CURRENT.fetch_add(1, Ordering::SeqCst);
    if let Some(player) = PLAYING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take()
    {
        player.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::load;
    use std::path::PathBuf;

    /// The English clips ship with the app, so the examples always have a voice.
    #[test]
    fn english_clips_decode() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/demo/en");
        for clip in ["dictation", "read"] {
            let (_, ms) = load(&dir.join(format!("{clip}.mp3"))).unwrap();
            assert!((1_000..10_000).contains(&ms), "{clip}: {ms} ms");
        }
    }
}
