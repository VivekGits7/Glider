//! Requests the app sends the voice worker and what it answers. Strict
//! request/response: every request gets exactly one response.

use crate::features::tts::catalog::Engine;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub enum Request {
    /// Load a voice, freeing any loaded one first.
    Load {
        engine: Engine,
        /// The voice's folder: `model_file` and the rest of what its engine
        /// needs (see `child::load`).
        model_dir: PathBuf,
        model_file: String,
        /// The shared espeak-ng data.
        espeak_dir: PathBuf,
        /// espeak's name for the language to read, for Kokoro 1.0.
        lang: Option<String>,
    },
    /// Voice one sentence.
    Synthesize {
        text: String,
        speed: f32,
        voice: i32,
        /// ISO 639-1 code, for voices that are told what language to read.
        lang: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Response {
    Loaded {
        sample_rate: u32,
        voices: i32,
    },
    /// The samples are the frame's payload; empty when the text had nothing
    /// to say (only symbols).
    Audio,
    Error(String),
}
