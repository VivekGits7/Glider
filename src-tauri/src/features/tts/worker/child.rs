//! The voice worker process: loads a sherpa-onnx voice and voices sentences.

use super::protocol::{Request, Response};
use super::LOG_LEVEL_ENV;
use crate::common::worker_kit::child;
use crate::common::worker_kit::frame::write_message;
use crate::features::tts::catalog::Engine;
use log::{error, info};
use sherpa_onnx::{
    GenerationConfig, OfflineTts, OfflineTtsConfig, OfflineTtsKittenModelConfig,
    OfflineTtsKokoroModelConfig, OfflineTtsModelConfig, OfflineTtsPocketModelConfig,
    OfflineTtsSupertonicModelConfig, OfflineTtsVitsModelConfig, Wave,
};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;

pub fn run() -> i32 {
    let mut output = match child::prepare(LOG_LEVEL_ENV) {
        Ok(file) => file,
        Err(e) => {
            eprintln!("voice worker: failed to claim stdout: {e}");
            return 2;
        }
    };
    let (requests_tx, requests) = mpsc::channel();
    if let Err(e) = thread::Builder::new()
        .name("tts-worker-in".into())
        .spawn(move || child::read_requests(move |request, _| requests_tx.send(request).is_ok()))
    {
        error!("Failed to start the request reader: {}", e);
        return 2;
    }

    let mut voice: Option<OfflineTts> = None;
    // Pocket's voices: one clip each, as (samples, sample rate).
    let mut clips: Vec<(Vec<f32>, i32)> = Vec::new();
    while let Ok(request) = requests.recv() {
        let (response, audio) = match request {
            Request::Load {
                engine,
                model_dir,
                model_file,
                espeak_dir,
                lang,
            } => {
                // Free the old voice before loading the new one.
                voice = None;
                clips.clear();
                match load(engine, &model_dir, &model_file, &espeak_dir, lang) {
                    Ok(tts) => {
                        if engine == Engine::Pocket {
                            clips = voice_clips(&model_dir)
                                .iter()
                                .filter_map(|path| Wave::read(&path.to_string_lossy()))
                                .map(|wave| (wave.samples().to_vec(), wave.sample_rate()))
                                .collect();
                        }
                        let voices = if engine == Engine::Pocket {
                            clips.len() as i32
                        } else {
                            tts.num_speakers()
                        };
                        let loaded = Response::Loaded {
                            sample_rate: tts.sample_rate().max(1) as u32,
                            voices,
                        };
                        if engine == Engine::Pocket && clips.is_empty() {
                            let e = format!("No voice clips in {}", model_dir.display());
                            (Response::Error(e), Vec::new())
                        } else {
                            voice = Some(tts);
                            (loaded, Vec::new())
                        }
                    }
                    Err(e) => (Response::Error(e), Vec::new()),
                }
            }
            Request::Synthesize {
                text,
                speed,
                voice: sid,
                lang,
            } => match voice.as_ref() {
                Some(tts) => {
                    let clip = clips.get(sid.max(0) as usize);
                    let generation = GenerationConfig {
                        speed,
                        // A cloned voice is its clip, not a speaker id.
                        sid: if clip.is_some() { 0 } else { sid },
                        reference_audio: clip.map(|(samples, _)| samples.clone()),
                        reference_sample_rate: clip.map_or(0, |(_, rate)| *rate),
                        extra: lang.map(|lang| {
                            HashMap::from([("lang".to_string(), serde_json::json!(lang))])
                        }),
                        ..Default::default()
                    };
                    let samples = tts
                        .generate_with_config(&text, &generation, None::<fn(&[f32], f32) -> bool>)
                        .map(|audio| audio.samples().to_vec())
                        .unwrap_or_default();
                    (Response::Audio, samples)
                }
                None => (Response::Error("No voice is loaded".into()), Vec::new()),
            },
        };
        if let Err(e) = write_message(&mut output, &response, Some(&audio)) {
            error!("Protocol write failed: {}", e);
            return 1;
        }
    }
    // Unreachable in practice: the reader exits the process on EOF.
    0
}

fn load(
    engine: Engine,
    dir: &Path,
    model_file: &str,
    espeak_dir: &Path,
    lang: Option<String>,
) -> Result<OfflineTts, String> {
    let path = |name: &str| Some(dir.join(name).to_string_lossy().into_owned());
    let espeak = Some(espeak_dir.to_string_lossy().into_owned());
    let mut model = OfflineTtsModelConfig {
        num_threads: 4,
        ..Default::default()
    };
    let mut rule_fsts = None;
    match engine {
        Engine::Kokoro => {
            // Kokoro 1.0 reads English and Chinese through its word lists;
            // 0.19 has none and uses espeak alone.
            let lexicon = existing(dir, &["lexicon-us-en.txt", "lexicon-zh.txt"]);
            let has_dict = dir.join("dict").is_dir();
            model.kokoro = OfflineTtsKokoroModelConfig {
                model: path(model_file),
                voices: path("voices.bin"),
                tokens: path("tokens.txt"),
                data_dir: espeak,
                lexicon,
                dict_dir: if has_dict { path("dict") } else { None },
                lang,
                ..Default::default()
            };
            rule_fsts = existing(dir, &["phone-zh.fst", "date-zh.fst", "number-zh.fst"]);
        }
        Engine::Kitten => {
            model.kitten = OfflineTtsKittenModelConfig {
                model: path(model_file),
                voices: path("voices.bin"),
                tokens: path("tokens.txt"),
                data_dir: espeak,
                ..Default::default()
            }
        }
        Engine::Piper => {
            model.vits = OfflineTtsVitsModelConfig {
                model: path(model_file),
                tokens: path("tokens.txt"),
                data_dir: espeak,
                ..Default::default()
            }
        }
        Engine::Supertonic => {
            model.supertonic = OfflineTtsSupertonicModelConfig {
                duration_predictor: path("duration_predictor.int8.onnx"),
                text_encoder: path("text_encoder.int8.onnx"),
                vector_estimator: path("vector_estimator.int8.onnx"),
                vocoder: path(model_file),
                tts_json: path("tts.json"),
                unicode_indexer: path("unicode_indexer.bin"),
                voice_style: path("voice.bin"),
            }
        }
        Engine::Pocket => {
            model.pocket = OfflineTtsPocketModelConfig {
                lm_flow: path("lm_flow.int8.onnx"),
                lm_main: path(model_file),
                encoder: path("encoder.onnx"),
                decoder: path("decoder.int8.onnx"),
                text_conditioner: path("text_conditioner.onnx"),
                vocab_json: path("vocab.json"),
                token_scores_json: path("token_scores.json"),
                voice_embedding_cache_capacity: 50,
            }
        }
    }
    let config = OfflineTtsConfig {
        model,
        rule_fsts,
        // One sentence per chunk, so audio starts after the first sentence.
        max_num_sentences: 1,
        ..Default::default()
    };
    info!("Loading voice model {}", dir.display());
    OfflineTts::create(&config)
        .ok_or_else(|| format!("Could not load the voice in {}", dir.display()))
}

/// The files of `names` that are in `dir`, as one comma-separated list of
/// paths (how sherpa-onnx takes several), or `None` when there are none.
fn existing(dir: &Path, names: &[&str]) -> Option<String> {
    let paths: Vec<String> = names
        .iter()
        .map(|name| dir.join(name))
        .filter(|path| path.is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .collect();
    (!paths.is_empty()).then(|| paths.join(","))
}

/// Pocket's voice clips, in file name order: the catalog lists its voices in
/// the same order.
fn voice_clips(dir: &Path) -> Vec<PathBuf> {
    let mut clips: Vec<PathBuf> = std::fs::read_dir(dir.join("test_wavs"))
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.extension().is_some_and(|ext| ext == "wav"))
                .collect()
        })
        .unwrap_or_default();
    clips.sort();
    clips
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn voice_clips_are_the_wavs_in_name_order() {
        let tmp = tempfile::tempdir().unwrap();
        let wavs = tmp.path().join("test_wavs");
        std::fs::create_dir(&wavs).unwrap();
        for name in [
            "sample_fr_hibiki_crepes.wav",
            "bria.wav",
            "notes.txt",
            "loona.wav",
        ] {
            std::fs::write(wavs.join(name), b"").unwrap();
        }
        let names: Vec<_> = voice_clips(tmp.path())
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            names,
            ["bria.wav", "loona.wav", "sample_fr_hibiki_crepes.wav"]
        );
        assert!(voice_clips(&tmp.path().join("missing")).is_empty());
    }

    #[test]
    fn existing_joins_only_files_that_are_there() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("a.txt"), b"").unwrap();
        let a = tmp.path().join("a.txt").to_string_lossy().into_owned();
        assert_eq!(existing(tmp.path(), &["a.txt", "b.txt"]), Some(a));
        assert_eq!(existing(tmp.path(), &["b.txt"]), None);
    }
}
