//! Rewrite (LLM): a small catalog of open models that fit on a laptop, the
//! service that downloads and runs them, online providers, Apple
//! Intelligence, and the Refine shortcuts.

pub mod actions;
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
pub mod apple;
pub mod catalog;
pub mod commands;
pub mod provider;
pub mod rewrite;
pub mod service;
pub mod worker;
