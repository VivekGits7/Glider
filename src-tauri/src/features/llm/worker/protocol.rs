//! Requests the app sends the LLM worker and what it answers. `Load` gets one
//! response. `Generate` gets a `Progress` per token, then one `Answer` or
//! `Error`. `Cancel` gets none: it makes the running `Generate` answer early
//! with what it has.

use super::engine::Family;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub enum Request {
    /// Load a model, freeing any loaded one first.
    Load {
        model: PathBuf,
        tokenizer: PathBuf,
        family: Family,
    },
    /// One rewrite: `system` instructions and the `user` message. `source`
    /// is the text being rewritten, which the answer will be about as long as.
    Generate {
        system: String,
        user: String,
        source: String,
        creative: bool,
    },
    Cancel,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Response {
    Loaded,
    Progress {
        generated: usize,
        /// About how many tokens the answer will take.
        expected: usize,
    },
    Answer(String),
    /// The error with its causes, as `{:#}` prints it.
    Error(String),
}
