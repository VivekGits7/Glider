//! App and OS plumbing: CLI flags, portable mode, autostart, system languages,
//! laptop detection and the Linux WebKit renderer.

pub(crate) mod autostart;
pub(crate) mod clamshell;
pub mod cli;
pub(crate) mod languages;
pub mod portable;
pub mod webkit_renderer;
