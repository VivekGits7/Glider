//! The Rewrite worker: the only place the local LLM (candle) runs. The app
//! sends it a rewrite and hears its progress token by token, then the answer.
//!
//! Worker rule: one LLM worker at a time, alive only while its model is
//! loaded. Unloading the model (idle, delete, or a switch) ends the process,
//! which gives all of its memory back, GPU memory included.
//!
//! - `protocol`: what the app and the worker say to each other.
//! - `engine`: the model, its tokenizer and its chat template.
//! - `child`: the worker process itself.

mod child;
pub mod engine;
pub mod protocol;

/// Hidden first argument that turns the executable into the LLM worker.
pub const WORKER_FLAG: &str = "--llm-worker";
/// Carries the app's log level to the worker.
pub const LOG_LEVEL_ENV: &str = "GLIDER_LLM_WORKER_LOG";

/// Run the worker until the app closes its stdin. Returns the exit code.
pub fn run() -> i32 {
    child::run()
}

#[cfg(test)]
mod tests {
    use super::protocol::{Request, Response};
    use super::{LOG_LEVEL_ENV, WORKER_FLAG};
    use crate::common::worker_kit::memory::process_memory;
    use crate::common::worker_kit::process::WorkerProcess;
    use crate::features::llm::catalog::CATALOG;
    use std::path::PathBuf;
    use std::time::Duration;

    const WAIT: Duration = Duration::from_secs(600);

    /// Runs a rewrite to the end and a cancelled one in a real worker
    /// process, then checks the process is gone once its handle drops. Needs
    /// a built app and a downloaded model:
    ///   GLIDER_WORKER_EXE=target/debug/glider \
    ///   GLIDER_TEST_LLM_DIR="<app data>/models/llm" \
    ///   cargo test --lib features::llm::worker -- --ignored
    #[test]
    #[ignore]
    fn rewrites_and_cancels_in_its_own_process() {
        let models = PathBuf::from(
            std::env::var_os("GLIDER_TEST_LLM_DIR").expect("set GLIDER_TEST_LLM_DIR"),
        );
        let entry = CATALOG
            .iter()
            .find(|e| models.join(e.id).join("model.gguf").is_file())
            .expect("a downloaded LLM");
        let mut worker =
            WorkerProcess::<Response>::spawn("llm-worker", WORKER_FLAG, LOG_LEVEL_ENV).unwrap();
        let pid = worker.pid();
        let load = Request::Load {
            model: models.join(entry.id).join("model.gguf"),
            tokenizer: models.join(entry.id).join("tokenizer.json"),
            family: entry.family,
        };
        let (loaded, _) = worker.call(&load, None, WAIT, "model load").unwrap();
        assert!(matches!(loaded, Response::Loaded), "{loaded:?}");
        // The weights live in the worker: hundreds of MB at least.
        let bytes = process_memory(pid).expect("worker memory");
        eprintln!("LLM worker memory: {} MB", bytes >> 20);
        assert!(bytes > 300 << 20, "{bytes}");

        let generate = |text: &str| Request::Generate {
            system: "Fix the grammar of the user's text. Answer with the fixed text only.".into(),
            user: text.into(),
            source: text.into(),
            creative: false,
        };
        // Runs one generation; `cancel_after` progress messages, it cancels.
        let mut run = |text: &str, cancel_after: Option<usize>| {
            worker.send(&generate(text), None).unwrap();
            let mut progress = 0;
            loop {
                match worker.recv(WAIT, "rewrite").unwrap().0 {
                    Response::Progress { generated, .. } => {
                        progress += 1;
                        assert_eq!(generated, progress);
                        if Some(progress) == cancel_after {
                            worker.send(&Request::Cancel, None).unwrap();
                        }
                    }
                    Response::Answer(answer) => return (answer, progress),
                    other => panic!("unexpected {other:?}"),
                }
            }
        };

        let (answer, tokens) = run("this are a test of the worker", None);
        assert!(!answer.trim().is_empty());
        assert!(tokens > 0);

        let long = "she go to school every days and she like it very much because her friends is there and they plays together after class. ".repeat(4);
        let (_, tokens) = run(&long, Some(3));
        // Stops within a few tokens of the cancel, far short of the answer.
        assert!(tokens < 10, "kept going for {tokens} tokens after cancel");

        drop(worker);
        // SAFETY: signal 0 only checks whether the process exists.
        assert_ne!(
            unsafe { libc::kill(pid as i32, 0) },
            0,
            "worker {pid} still alive"
        );
    }
}
