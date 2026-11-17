//! The worker side: setup every worker process does before its native code
//! runs, logging back to the app, and the stdin reader that ends the process
//! the moment the app goes away.

use super::frame::read_message;
use log::{error, LevelFilter, Log, Metadata, Record};
use serde::de::DeserializeOwned;
use std::fs::File;
use std::io::{self, BufReader, Write};

/// Prefix on worker log lines so the app can tell them apart from raw native
/// output (e.g. a `GGML_ASSERT` message right before an abort).
pub const LOG_LINE_PREFIX: &str = "\u{1}";

/// First thing a worker does, before any native code runs: the glibc tuning
/// the app also uses (#1792), signals meant for the app, and the real stdout
/// claimed for the protocol with fd 1 pointed at stderr, since native code
/// writes to stdout in places and any stray byte there would corrupt the
/// protocol stream. Logging goes to stderr at the level `log_level_env` names.
pub fn prepare(log_level_env: &str) -> io::Result<File> {
    crate::common::memory::init_allocator();
    #[cfg(unix)]
    ignore_app_signals();
    #[cfg(target_os = "linux")]
    set_process_name();
    let protocol_out = take_stdout_for_protocol()?;
    init_logger(log_level_env);
    Ok(protocol_out)
}

/// The stdin reader: hands each request to `handle`, and ends the process
/// when the app closes stdin (unload, quit, or the app died) or when `handle`
/// returns `false` (the worker's main loop is gone). `_exit` skips C++ static
/// destructors, so a model still alive at that point can't trip native
/// teardown asserts, and the OS reclaims its CPU and GPU memory.
pub fn read_requests<T: DeserializeOwned>(mut handle: impl FnMut(T, Vec<f32>) -> bool) -> ! {
    let mut input = BufReader::new(io::stdin().lock());
    loop {
        match read_message::<T>(&mut input) {
            Ok(Some((request, payload))) => {
                if !handle(request, payload) {
                    exit_now(1);
                }
            }
            Ok(None) => exit_now(0),
            Err(e) => {
                error!("Protocol read failed: {}", e);
                exit_now(1);
            }
        }
    }
}

pub fn exit_now(code: i32) -> ! {
    let _ = io::stderr().flush();
    // SAFETY: `_exit` only ends the process; nothing runs afterwards.
    unsafe { libc::_exit(code) }
}

/// Logs go to stderr as `\x01LEVEL\ttarget\tmessage` lines; the app re-logs
/// them at the same level.
struct StderrLogger;

impl Log for StderrLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= log::max_level()
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        let message = record.args().to_string();
        let mut stderr = io::stderr().lock();
        for line in message.lines() {
            let _ = writeln!(
                stderr,
                "{LOG_LINE_PREFIX}{}\t{}\t{}",
                record.level(),
                record.target(),
                line
            );
        }
    }

    fn flush(&self) {
        let _ = io::stderr().flush();
    }
}

fn init_logger(log_level_env: &str) {
    static LOGGER: StderrLogger = StderrLogger;
    let level = std::env::var(log_level_env)
        .ok()
        .and_then(|v| v.parse::<LevelFilter>().ok())
        .unwrap_or(LevelFilter::Info);
    if log::set_logger(&LOGGER).is_ok() {
        log::set_max_level(level);
    }
}

/// SIGUSR2 toggles transcription in the app (and WebKitGTK uses SIGUSR1).
/// Aimed at Glider by name, e.g. the README's `pkill -USR2 -n glider`, one
/// can reach a worker instead, and its default action would kill it.
#[cfg(unix)]
fn ignore_app_signals() {
    // SAFETY: setting a signal's disposition to SIG_IGN has no preconditions.
    unsafe {
        libc::signal(libc::SIGUSR1, libc::SIG_IGN);
        libc::signal(libc::SIGUSR2, libc::SIG_IGN);
    }
}

/// Started from /proc/self/exe, the kernel names this process "exe". Name it
/// as Glider's, but not `glider`: `pkill`/`killall` match names case-sensitively,
/// so `pkill -USR2 -n glider` keeps reaching the app, never a worker.
#[cfg(target_os = "linux")]
fn set_process_name() {
    // SAFETY: PR_SET_NAME copies a NUL-terminated name of up to 16 bytes.
    unsafe {
        libc::prctl(libc::PR_SET_NAME, c"Glider-worker".as_ptr());
    }
}

#[cfg(unix)]
fn take_stdout_for_protocol() -> io::Result<File> {
    use std::os::fd::FromRawFd;
    // SAFETY: plain fd duplication; the new fd is owned by the returned File.
    unsafe {
        let fd = libc::dup(libc::STDOUT_FILENO);
        if fd < 0 {
            return Err(io::Error::last_os_error());
        }
        if libc::dup2(libc::STDERR_FILENO, libc::STDOUT_FILENO) < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(File::from_raw_fd(fd))
    }
}

#[cfg(windows)]
fn take_stdout_for_protocol() -> io::Result<File> {
    use std::os::windows::io::FromRawHandle;
    // Native code writes through the CRT's fd 1, so redirect that one. The
    // protocol uses the OS handle behind a CRT duplicate of the original.
    // SAFETY: CRT fd duplication; the duplicate's handle is owned by the File
    // for the rest of the process.
    unsafe {
        let fd = libc::dup(1);
        if fd < 0 {
            return Err(io::Error::last_os_error());
        }
        if libc::dup2(2, 1) < 0 {
            return Err(io::Error::last_os_error());
        }
        let handle = libc::get_osfhandle(fd);
        if handle == -1 {
            return Err(io::Error::last_os_error());
        }
        Ok(File::from_raw_handle(handle as _))
    }
}
