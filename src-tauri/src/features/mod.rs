//! One folder per feature. Each holds its commands (what the frontend calls),
//! its logic, its model catalog and, for model features, its worker.

pub(crate) mod history;
pub(crate) mod insights;
pub(crate) mod llm;
pub mod stt;
pub(crate) mod tts;
