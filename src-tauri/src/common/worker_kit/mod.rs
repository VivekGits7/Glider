//! Shared plumbing for model worker processes. Each model kind (speech,
//! voice, LLM) runs in its own process: this executable started with that
//! kind's flag. A crash or hang there kills only the worker, and unloading a
//! model ends its worker, which returns all of its memory to the system.
//!
//! - `frame`: the wire format both sides speak.
//! - `child`: the worker side (setup, logging, the stdin reader).
//! - `process`: the app side ([`process::WorkerProcess`]).
//! - `memory`: how much memory a worker is using, for the Models page.

pub mod child;
pub mod frame;
pub mod memory;
pub mod process;
