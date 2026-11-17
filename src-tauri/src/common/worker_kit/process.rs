//! The app side: start a worker process, talk to it, notice when it crashes
//! or hangs, and always reap it.

use super::child::LOG_LINE_PREFIX;
use super::frame::{encode_message, read_message};
use log::{debug, error, warn, Level};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::collections::VecDeque;
use std::fmt;
use std::io::{self, BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, ExitStatus, Stdio};
use std::sync::{mpsc, Arc, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

/// How long a worker gets to exit on its own after its stdin closes.
const SHUTDOWN_GRACE: Duration = Duration::from_secs(2);
/// Raw native output kept to explain a crash.
const STDERR_TAIL_LINES: usize = 64;

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Why a worker call failed. After `Crashed` or `Hung` the worker is gone and
/// its handle should be dropped; the next use starts a new one.
#[derive(Debug)]
pub enum Failure {
    /// The worker exited: its status and the last native output line.
    Crashed(String),
    /// No answer within the deadline; the worker was killed.
    Hung(Duration),
    /// The request could not be encoded (too large); the worker is fine.
    Encode(String),
}

impl Failure {
    /// The worker process is gone.
    pub fn worker_lost(&self) -> bool {
        matches!(self, Failure::Crashed(_) | Failure::Hung(_))
    }
}

impl fmt::Display for Failure {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Failure::Crashed(detail) => write!(f, "the worker stopped unexpectedly ({detail})"),
            Failure::Hung(deadline) => {
                write!(
                    f,
                    "the worker did not answer within {}s",
                    deadline.as_secs()
                )
            }
            Failure::Encode(detail) => write!(f, "{detail}"),
        }
    }
}

/// One worker process. Requests go out in order, responses come back in
/// order; a request may get several responses (progress, then a result).
/// Dropping it closes the worker's stdin, gives it [`SHUTDOWN_GRACE`] to
/// exit, kills it otherwise, and reaps it: once dropped, the worker is gone.
pub struct WorkerProcess<R> {
    name: &'static str,
    pid: u32,
    child: Child,
    stdin: Option<mpsc::Sender<Vec<u8>>>,
    responses: mpsc::Receiver<(R, Vec<f32>)>,
    stderr_done: mpsc::Receiver<()>,
    stderr_tail: Arc<Mutex<VecDeque<String>>>,
}

impl<R: DeserializeOwned + Send + 'static> WorkerProcess<R> {
    /// Start this executable as a worker: `flag` picks which one, and its log
    /// level travels in `log_level_env`. `name` labels its log lines.
    pub fn spawn(name: &'static str, flag: &str, log_level_env: &str) -> io::Result<Self> {
        let mut command = Command::new(worker_exe()?);
        #[cfg(target_os = "linux")]
        if let Some(arg0) = std::env::args_os().next() {
            // Keep `ps` showing Glider's own path rather than /proc/self/exe.
            use std::os::unix::process::CommandExt;
            command.arg0(arg0);
        }
        command
            .arg(flag)
            .env(log_level_env, log::max_level().as_str())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        let mut child = command.spawn()?;
        let pid = child.id();
        let stdin = child.stdin.take().expect("stdin is piped");
        let stdout = child.stdout.take().expect("stdout is piped");
        let stderr = child.stderr.take().expect("stderr is piped");

        let (stdin_tx, frames) = mpsc::channel();
        let (response_tx, responses) = mpsc::channel();
        let (stderr_done_tx, stderr_done) = mpsc::channel();
        // Built before the threads so a failure below still reaps the child.
        let worker = WorkerProcess {
            name,
            pid,
            child,
            stdin: Some(stdin_tx),
            responses,
            stderr_done,
            stderr_tail: Arc::new(Mutex::new(VecDeque::with_capacity(STDERR_TAIL_LINES))),
        };

        thread::Builder::new()
            .name(format!("{name}-in"))
            .spawn(move || write_frames(stdin, frames))?;
        thread::Builder::new()
            .name(format!("{name}-out"))
            .spawn(move || read_responses(name, stdout, response_tx))?;
        // Always drain stderr: a full pipe would block the worker.
        let tail = Arc::clone(&worker.stderr_tail);
        thread::Builder::new()
            .name(format!("{name}-err"))
            .spawn(move || {
                // Split on raw bytes: native code may write non-UTF-8, and
                // `lines()` would stop there, losing the abort message.
                for line in BufReader::new(stderr).split(b'\n') {
                    let Ok(line) = line else { break };
                    let line = String::from_utf8_lossy(&line);
                    let line = line.strip_suffix('\r').unwrap_or(&line).to_string();
                    forward_log(name, &line);
                    let mut tail = lock(&tail);
                    if tail.len() == STDERR_TAIL_LINES {
                        tail.pop_front();
                    }
                    tail.push_back(line);
                }
                let _ = stderr_done_tx.send(());
            })?;

        debug!("Started {name} (pid {pid})");
        Ok(worker)
    }

    pub fn pid(&self) -> u32 {
        self.pid
    }

    /// Send one request without waiting for its response.
    pub fn send<T: Serialize>(
        &mut self,
        request: &T,
        payload: Option<&[f32]>,
    ) -> Result<(), Failure> {
        let frame = encode_message(request, payload).map_err(|e| Failure::Encode(e.to_string()))?;
        let sent = self
            .stdin
            .as_ref()
            .is_some_and(|stdin| stdin.send(frame).is_ok());
        if sent {
            Ok(())
        } else {
            Err(self.died())
        }
    }

    /// Wait up to `deadline` for the next response. Hitting the deadline
    /// kills the worker. `what` names the work in the log.
    pub fn recv(&mut self, deadline: Duration, what: &str) -> Result<(R, Vec<f32>), Failure> {
        match self.responses.recv_timeout(deadline) {
            Ok(response) => Ok(response),
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let _ = self.child.kill();
                let tail = self.native_tail();
                error!(
                    "{} (pid {}) did not answer {} within {:?}; killed it{}",
                    self.name,
                    self.pid,
                    what,
                    deadline,
                    if tail.is_empty() {
                        String::new()
                    } else {
                        format!(". Native output before the hang:\n{}", tail.join("\n"))
                    }
                );
                Err(Failure::Hung(deadline))
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => Err(self.died()),
        }
    }

    /// Send one request and wait for its (first) response.
    pub fn call<T: Serialize>(
        &mut self,
        request: &T,
        payload: Option<&[f32]>,
        deadline: Duration,
        what: &str,
    ) -> Result<(R, Vec<f32>), Failure> {
        self.send(request, payload)?;
        self.recv(deadline, what)
    }

    /// The worker's output closed: collect its exit status and last output.
    fn died(&mut self) -> Failure {
        // Let the stderr thread catch the final lines (the abort message).
        let _ = self.stderr_done.recv_timeout(Duration::from_secs(1));
        let status = match wait_exit(&mut self.child, Duration::from_secs(1)) {
            Some(status) => status.to_string(),
            None => {
                let _ = self.child.kill();
                "unresponsive after closing its output; killed".to_string()
            }
        };
        let tail = self.native_tail();
        if tail.is_empty() {
            error!("{} (pid {}) died: {}", self.name, self.pid, status);
        } else {
            error!(
                "{} (pid {}) died: {}. Native output before exit:\n{}",
                self.name,
                self.pid,
                status,
                tail.join("\n")
            );
        }
        Failure::Crashed(match tail.last() {
            Some(last) => format!("{status}: {last}"),
            None => status,
        })
    }

    /// Recent raw native output (worker log lines are excluded; they were
    /// already re-logged).
    fn native_tail(&self) -> Vec<String> {
        lock(&self.stderr_tail)
            .iter()
            .filter(|line| !line.starts_with(LOG_LINE_PREFIX))
            .cloned()
            .collect()
    }
}

impl<R> Drop for WorkerProcess<R> {
    fn drop(&mut self) {
        // Closing stdin tells the worker to exit (it ends on EOF).
        self.stdin.take();
        if wait_exit(&mut self.child, SHUTDOWN_GRACE).is_none() {
            warn!(
                "{} (pid {}) did not exit within {:?}; killing it",
                self.name, self.pid, SHUTDOWN_GRACE
            );
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
        debug!("Stopped {} (pid {})", self.name, self.pid);
    }
}

/// Wait up to `timeout` for `child` to exit. `None` if it is still running
/// (or its status can't be read).
pub fn wait_exit(child: &mut Child, timeout: Duration) -> Option<ExitStatus> {
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Some(status),
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(5)),
            _ => return None,
        }
    }
}

fn write_frames(mut stdin: ChildStdin, frames: mpsc::Receiver<Vec<u8>>) {
    // Ends when the handle closes stdin (dropping it here sends EOF) or the
    // worker is gone.
    for frame in frames {
        if stdin
            .write_all(&frame)
            .and_then(|()| stdin.flush())
            .is_err()
        {
            break;
        }
    }
}

fn read_responses<R: DeserializeOwned>(
    name: &str,
    stdout: ChildStdout,
    responses: mpsc::Sender<(R, Vec<f32>)>,
) {
    let mut stdout = BufReader::new(stdout);
    loop {
        match read_message::<R>(&mut stdout) {
            Ok(Some(response)) => {
                if responses.send(response).is_err() {
                    break;
                }
            }
            Ok(None) => break,
            Err(e) => {
                error!("{name} protocol error: {}", e);
                break;
            }
        }
    }
}

/// Re-log a worker stderr line in the app under `target`. Structured lines
/// keep their level; anything else is raw native output.
pub fn forward_log(target: &str, line: &str) {
    if let Some(rest) = line.strip_prefix(LOG_LINE_PREFIX) {
        let mut parts = rest.splitn(3, '\t');
        if let (Some(level), Some(source), Some(message)) =
            (parts.next(), parts.next(), parts.next())
        {
            let level = level.parse::<Level>().unwrap_or(Level::Info);
            log::log!(target: target, level, "[{}] {}", source, message);
            return;
        }
    }
    log::info!(target: target, "{}", line);
}

/// The file Glider was started from, with its identity (device and inode),
/// recorded at startup; see [`worker_exe`]. `None` if either couldn't be
/// read, which skips the check.
#[cfg(unix)]
static LAUNCHED_EXE: std::sync::OnceLock<Option<(PathBuf, (u64, u64))>> =
    std::sync::OnceLock::new();

#[cfg(unix)]
fn file_id(path: &std::path::Path) -> io::Result<(u64, u64)> {
    use std::os::unix::fs::MetadataExt;
    let metadata = std::fs::metadata(path)?;
    Ok((metadata.dev(), metadata.ino()))
}

/// Must run before an upgrade can replace the file, so at startup.
pub fn record_launched_exe() {
    #[cfg(unix)]
    LAUNCHED_EXE.get_or_init(|| {
        std::env::current_exe()
            .and_then(|path| {
                let id = file_id(&path)?;
                Ok((path, id))
            })
            .inspect_err(|e| warn!("Could not identify Glider's executable: {}", e))
            .ok()
    });
}

/// The executable a worker runs: always this very binary, so the two agree
/// on the protocol and on the native libraries. Upgrading or moving Glider
/// while it runs replaces or removes the file it started from, and a worker
/// started from there would be the new version (macOS), or this binary
/// loading the new version's libraries (Linux). Only a restart fixes that, so
/// refuse to start one and say so. Windows locks a running executable
/// against replacement. On Linux the worker runs from `/proc/self/exe`, which
/// is this binary even once its file is replaced. Tests point this at a built
/// app with `GLIDER_WORKER_EXE`: their own executable is the test harness.
pub fn worker_exe() -> io::Result<PathBuf> {
    if cfg!(test) {
        if let Some(exe) = std::env::var_os("GLIDER_WORKER_EXE") {
            return Ok(PathBuf::from(exe));
        }
    }
    #[cfg(unix)]
    if let Some((path, launched)) = LAUNCHED_EXE.get().and_then(Option::as_ref) {
        if file_id(path).ok().as_ref() != Some(launched) {
            return Err(io::Error::other(
                "Glider was updated or moved while it was running; restart Glider",
            ));
        }
    }
    #[cfg(target_os = "linux")]
    return Ok(PathBuf::from("/proc/self/exe"));
    #[cfg(not(target_os = "linux"))]
    std::env::current_exe()
}
