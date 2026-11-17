//! The LLM worker process: loads a model and runs rewrites on it.

use super::engine::{Engine, Sampler};
use super::protocol::{Request, Response};
use super::LOG_LEVEL_ENV;
use crate::common::worker_kit::child;
use crate::common::worker_kit::frame::write_message;
use log::{error, info};
use std::fs::File;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::Instant;

pub fn run() -> i32 {
    let mut output = match child::prepare(LOG_LEVEL_ENV) {
        Ok(file) => file,
        Err(e) => {
            eprintln!("LLM worker: failed to claim stdout: {e}");
            return 2;
        }
    };
    // Cancel is handled by the reader itself: queued behind the generation
    // it is meant to stop, it would arrive too late.
    let cancel = Arc::new(AtomicBool::new(false));
    let (requests_tx, requests) = mpsc::channel();
    let reader_cancel = Arc::clone(&cancel);
    if let Err(e) = thread::Builder::new()
        .name("llm-worker-in".into())
        .spawn(move || {
            child::read_requests(move |request: Request, _| match request {
                Request::Cancel => {
                    reader_cancel.store(true, Ordering::SeqCst);
                    true
                }
                request => {
                    // A cancel that came after the last generation ended
                    // must not stop this one.
                    if matches!(request, Request::Generate { .. }) {
                        reader_cancel.store(false, Ordering::SeqCst);
                    }
                    requests_tx.send(request).is_ok()
                }
            })
        })
    {
        error!("Failed to start the request reader: {}", e);
        return 2;
    }

    let mut engine: Option<Engine> = None;
    while let Ok(request) = requests.recv() {
        let response = match request {
            Request::Load {
                model,
                tokenizer,
                family,
            } => {
                // Free the old model before loading the next.
                engine = None;
                match Engine::load(&model, &tokenizer, family) {
                    Ok(loaded) => {
                        engine = Some(loaded);
                        Response::Loaded
                    }
                    Err(e) => Response::Error(format!("{e:#}")),
                }
            }
            Request::Generate {
                system,
                user,
                source,
                creative,
            } => match engine.as_mut() {
                Some(engine) => {
                    match generate(
                        engine,
                        &system,
                        &user,
                        &source,
                        creative,
                        &cancel,
                        &mut output,
                    ) {
                        Ok(answer) => Response::Answer(answer),
                        Err(e) => Response::Error(format!("{e:#}")),
                    }
                }
                None => Response::Error("No LLM is loaded".into()),
            },
            Request::Cancel => continue, // handled by the reader
        };
        if let Err(e) = write_message(&mut output, &response, None) {
            error!("Protocol write failed: {}", e);
            return 1;
        }
    }
    // Unreachable in practice: the reader exits the process on EOF.
    0
}

/// One rewrite, reporting each token as it comes.
fn generate(
    engine: &mut Engine,
    system: &str,
    user: &str,
    source: &str,
    creative: bool,
    cancel: &AtomicBool,
    output: &mut File,
) -> anyhow::Result<String> {
    let prompt = engine.family().chat_prompt(system, user);
    // A rewrite runs about as long as the text, plus room for lists.
    let expected = engine.count_tokens(source).max(8);
    let sampler = Sampler {
        temperature: if creative { 0.8 } else { 0.3 },
        top_p: 0.9,
        max_new_tokens: (expected * 2 + 64).min(4096),
    };
    let started = Instant::now();
    let answer = engine.generate(&prompt, &sampler, |generated| {
        let progress = Response::Progress {
            generated,
            expected,
        };
        // A failed write means the app is gone; stop and let the reader exit.
        write_message(output, &progress, None).is_ok() && !cancel.load(Ordering::SeqCst)
    })?;
    info!(
        "Generated {} chars for {} chars of text in {:?}",
        answer.len(),
        source.len(),
        started.elapsed()
    );
    Ok(answer)
}
