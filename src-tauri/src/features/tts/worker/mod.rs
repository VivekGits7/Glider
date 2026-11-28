//! The Read Aloud worker: the only place sherpa-onnx runs. The app sends it
//! one sentence at a time and plays the audio it returns, so Stop, pause,
//! skip, speed and the output device all stay in the app.
//!
//! Worker rule: one voice worker at a time, alive only while its voice is
//! loaded. Unloading the voice (idle, delete, or a switch) ends the process.
//!
//! - `protocol`: what the app and the worker say to each other.
//! - `child`: the worker process itself.

mod child;
pub mod protocol;

/// Hidden first argument that turns the executable into the voice worker.
pub const WORKER_FLAG: &str = "--tts-worker";
/// Carries the app's log level to the worker.
pub const LOG_LEVEL_ENV: &str = "GLIDER_TTS_WORKER_LOG";

/// Run the worker until the app closes its stdin. Returns the exit code.
pub fn run() -> i32 {
    child::run()
}

#[cfg(test)]
mod tests {
    use super::protocol::{Request, Response};
    use super::{LOG_LEVEL_ENV, WORKER_FLAG};
    use crate::common::worker_kit::memory::process_memory;
    use crate::common::worker_kit::process::WorkerProcess;
    use crate::features::tts::catalog::{find_entry, Engine, DEFAULT_MODEL_ID};
    use std::path::PathBuf;
    use std::time::Duration;

    /// Voices a sentence in a real worker process, then checks the process is
    /// gone once its handle drops. Needs a built app and a downloaded voice:
    ///   GLIDER_WORKER_EXE=target/debug/glider \
    ///   GLIDER_TEST_TTS_DIR="<app data>/models/tts" \
    ///   cargo test --lib features::tts::worker -- --ignored
    /// `GLIDER_TEST_TTS_MODEL=<catalog id>` checks another voice than the default.
    #[test]
    #[ignore]
    fn voices_a_sentence_in_its_own_process() {
        let models = PathBuf::from(
            std::env::var_os("GLIDER_TEST_TTS_DIR").expect("set GLIDER_TEST_TTS_DIR"),
        );
        let id = std::env::var("GLIDER_TEST_TTS_MODEL").unwrap_or(DEFAULT_MODEL_ID.into());
        let entry = find_entry(&id).expect("a catalog id");
        let mut worker =
            WorkerProcess::<Response>::spawn("tts-worker", WORKER_FLAG, LOG_LEVEL_ENV).unwrap();
        let pid = worker.pid();
        let load = Request::Load {
            engine: entry.engine,
            model_dir: models.join(entry.id),
            model_file: entry.model_file.into(),
            espeak_dir: models.join("espeak-ng-data"),
            lang: None,
        };
        let (loaded, _) = worker
            .call(&load, None, Duration::from_secs(120), "voice load")
            .unwrap();
        let Response::Loaded {
            sample_rate,
            voices,
        } = loaded
        else {
            panic!("expected Loaded, got {loaded:?}");
        };
        assert!(sample_rate > 0);
        assert_eq!(voices as usize, entry.voices.len());
        // The voice lives in the worker: tens of MB at least.
        let bytes = process_memory(pid).expect("worker memory");
        eprintln!("voice worker memory: {} MB", bytes >> 20);
        assert!(bytes > 30 << 20, "{bytes}");

        let speak = |text: &str| Request::Synthesize {
            text: text.into(),
            speed: 1.0,
            voice: 1,
            lang: (entry.engine == Engine::Supertonic).then(|| "en".into()),
        };
        let (audio, samples) = worker
            .call(
                &speak("Hello from the voice worker."),
                None,
                Duration::from_secs(120),
                "sentence",
            )
            .unwrap();
        assert!(matches!(audio, Response::Audio));
        // Over a quarter second of audio, and not silence.
        assert!(
            samples.len() > sample_rate as usize / 4,
            "{}",
            samples.len()
        );
        assert!(samples.iter().any(|s| s.abs() > 0.01));

        drop(worker);
        // SAFETY: signal 0 only checks whether the process exists.
        assert_ne!(
            unsafe { libc::kill(pid as i32, 0) },
            0,
            "worker {pid} still alive"
        );
    }

    /// Renders the intro examples' voice clips (`resources/demo/<lang>/`) with
    /// Supertonic 3: the Dictation line in one voice and the Read Aloud line in
    /// another, from the translations. English always; another language only
    /// once its line is translated (an untranslated one plays the English clip).
    /// Writes WAVs; convert them to the bundled MP3s and drop the WAVs:
    ///   GLIDER_WORKER_EXE=target/debug/glider \
    ///   GLIDER_TEST_TTS_DIR="<app data>/models/tts" \
    ///   cargo test --lib features::tts::worker::tests::renders -- --ignored
    ///   for f in resources/demo/*/*.wav; do
    ///     ffmpeg -loglevel error -y -i "$f" -ac 1 -b:a 48k "${f%.wav}.mp3" && rm "$f"
    ///   done
    #[test]
    #[ignore]
    fn renders_the_demo_clips() {
        const SUPERTONIC: &str = "sherpa-onnx-supertonic-3-tts-int8-2026-05-11";
        // (clip, translation path, voice, speed): Read Aloud's at its default
        // speed, which its example's player shows.
        const CLIPS: [(&str, [&str; 3], i32, f32); 2] = [
            ("dictation", ["dictation", "intro", "said"], 2, 1.0),
            ("read", ["readAloud", "intro", "sample"], 0, 1.3),
        ];
        let models = PathBuf::from(
            std::env::var_os("GLIDER_TEST_TTS_DIR").expect("set GLIDER_TEST_TTS_DIR"),
        );
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let entry = find_entry(SUPERTONIC).expect("Supertonic 3 in the catalog");
        let mut worker =
            WorkerProcess::<Response>::spawn("tts-worker", WORKER_FLAG, LOG_LEVEL_ENV).unwrap();
        let load = Request::Load {
            engine: entry.engine,
            model_dir: models.join(entry.id),
            model_file: entry.model_file.into(),
            espeak_dir: models.join("espeak-ng-data"),
            lang: None,
        };
        let (loaded, _) = worker
            .call(&load, None, Duration::from_secs(120), "voice load")
            .unwrap();
        let Response::Loaded { sample_rate, .. } = loaded else {
            panic!("expected Loaded, got {loaded:?}");
        };

        let locales = root.join("../src/i18n/locales");
        let line = |lang: &str, [page, group, key]: [&str; 3]| -> Option<String> {
            let json = std::fs::read_to_string(locales.join(lang).join("translation.json")).ok()?;
            let strings: serde_json::Value = serde_json::from_str(&json).unwrap();
            strings["settings"][page][group][key]
                .as_str()
                .map(str::to_string)
        };
        for lang in entry.languages {
            let out = root.join("resources/demo").join(lang);
            for (clip, path, voice, speed) in CLIPS {
                // Not an app language, or not translated yet.
                let Some(text) = line(lang, path) else {
                    continue;
                };
                if *lang != "en" && line("en", path).as_deref() == Some(text.as_str()) {
                    continue;
                }
                std::fs::create_dir_all(&out).unwrap();
                let request = Request::Synthesize {
                    text: text.clone(),
                    speed,
                    voice,
                    lang: Some((*lang).into()),
                };
                let (audio, samples) = worker
                    .call(&request, None, Duration::from_secs(120), "sentence")
                    .unwrap();
                assert!(matches!(audio, Response::Audio), "{lang} {clip}: {audio:?}");
                assert!(!samples.is_empty(), "{lang} {clip}: no audio");
                let spec = hound::WavSpec {
                    channels: 1,
                    sample_rate,
                    bits_per_sample: 16,
                    sample_format: hound::SampleFormat::Int,
                };
                let mut wav =
                    hound::WavWriter::create(out.join(format!("{clip}.wav")), spec).unwrap();
                for sample in samples {
                    wav.write_sample((sample.clamp(-1.0, 1.0) * f32::from(i16::MAX)) as i16)
                        .unwrap();
                }
                wav.finalize().unwrap();
                eprintln!("{lang}/{clip}: {text}");
            }
        }
    }
}
