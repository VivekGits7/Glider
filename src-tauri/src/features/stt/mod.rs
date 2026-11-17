//! Dictation (speech to text): recording, transcription, the model catalog
//! and downloads, and typing the result into the focused app.
//!
//! Worker rule: all transcribe.cpp code runs in the worker process (`worker/`),
//! never in the app.

pub(crate) mod actions;
pub(crate) mod catalog;
pub(crate) mod commands;
pub(crate) mod coordinator;
pub(crate) mod language;
pub(crate) mod models;
pub(crate) mod output;
pub mod processing;
pub(crate) mod recorder;
pub(crate) mod signal_handle;
pub(crate) mod transcription;
pub(crate) mod transcription_jobs;
pub mod worker;
