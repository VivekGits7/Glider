//! LLM inference for Rewrite: a GGUF model loaded with candle, its
//! tokenizer, and the chat template of its family.

use anyhow::{anyhow, bail, Context, Result};
use candle_core::quantized::gguf_file;
use candle_core::{DType, Device, Tensor};
use candle_transformers::generation::{LogitsProcessor, Sampling};
use candle_transformers::models::{quantized_gemma3, quantized_llama, quantized_qwen3};
use log::info;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokenizers::Tokenizer;

/// How a model expects a conversation to be written out.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Family {
    /// ChatML. `thinking` models get an empty think block so they answer
    /// straight away instead of reasoning first.
    Qwen3 {
        thinking: bool,
    },
    /// No system role: the instructions open the user's turn.
    Gemma3,
    Llama3,
}

impl Family {
    /// The prompt for one turn, ending where the model starts its answer.
    pub fn chat_prompt(self, system: &str, user: &str) -> String {
        match self {
            Family::Qwen3 { thinking } => {
                let mut prompt = format!(
                    "<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n"
                );
                if thinking {
                    prompt.push_str("<think>\n\n</think>\n\n");
                }
                prompt
            }
            Family::Gemma3 => format!(
                "<bos><start_of_turn>user\n{system}\n\n{user}<end_of_turn>\n<start_of_turn>model\n"
            ),
            Family::Llama3 => format!(
                "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{user}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
            ),
        }
    }

    /// Tokens that end the model's turn.
    fn stop_tokens(self) -> &'static [&'static str] {
        match self {
            Family::Qwen3 { .. } => &["<|im_end|>", "<|endoftext|>"],
            Family::Gemma3 => &["<end_of_turn>", "<eos>"],
            Family::Llama3 => &["<|eot_id|>", "<|end_of_text|>", "<|eom_id|>"],
        }
    }
}

enum Weights {
    Qwen3(quantized_qwen3::ModelWeights),
    Gemma3(quantized_gemma3::ModelWeights),
    Llama(quantized_llama::ModelWeights),
}

impl Weights {
    fn forward(&mut self, input: &Tensor, position: usize) -> candle_core::Result<Tensor> {
        match self {
            Weights::Qwen3(m) => m.forward(input, position),
            Weights::Gemma3(m) => m.forward(input, position),
            Weights::Llama(m) => m.forward(input, position),
        }
    }

    /// Forget the previous conversation. Gemma and Llama start over on their
    /// own when a forward pass begins at position 0.
    fn reset(&mut self) {
        if let Weights::Qwen3(m) = self {
            m.clear_kv_cache();
        }
    }
}

/// Settings for one generation.
pub struct Sampler {
    /// 0 picks the likeliest token every time.
    pub temperature: f64,
    pub top_p: f64,
    pub max_new_tokens: usize,
}

pub struct Engine {
    weights: Weights,
    tokenizer: Tokenizer,
    device: Device,
    family: Family,
    stop_ids: Vec<u32>,
}

/// The GPU on Apple Silicon, the CPU everywhere else. One Metal device per
/// worker process; unloading ends the process, kernels and all.
fn pick_device() -> Device {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        static METAL: std::sync::OnceLock<Option<Device>> = std::sync::OnceLock::new();
        let metal = METAL.get_or_init(|| match Device::new_metal(0) {
            Ok(device) => Some(device),
            Err(e) => {
                log::warn!("Metal is unavailable for the LLM, using the CPU: {e}");
                None
            }
        });
        if let Some(device) = metal {
            return device.clone();
        }
    }
    Device::Cpu
}

/// Inputs longer than this many tokens are refused rather than truncated.
pub const MAX_PROMPT_TOKENS: usize = 6144;

impl Engine {
    pub fn load(model_path: &Path, tokenizer_path: &Path, family: Family) -> Result<Self> {
        let device = pick_device();
        let started = std::time::Instant::now();
        let mut file = std::fs::File::open(model_path)
            .with_context(|| format!("open {}", model_path.display()))?;
        let content = gguf_file::Content::read(&mut file)
            .map_err(|e| e.with_path(model_path))
            .context("read the model file")?;
        let architecture = content
            .metadata
            .get("general.architecture")
            .and_then(|v| v.to_string().ok())
            .cloned()
            .unwrap_or_default();
        let weights = match architecture.as_str() {
            "qwen3" => Weights::Qwen3(quantized_qwen3::ModelWeights::from_gguf(
                content, &mut file, &device,
            )?),
            "gemma3" => Weights::Gemma3(quantized_gemma3::ModelWeights::from_gguf(
                content, &mut file, &device,
            )?),
            "llama" => Weights::Llama(quantized_llama::ModelWeights::from_gguf(
                content, &mut file, &device,
            )?),
            other => bail!("unsupported model architecture '{other}'"),
        };
        let tokenizer =
            Tokenizer::from_file(tokenizer_path).map_err(|e| anyhow!("load the tokenizer: {e}"))?;
        let stop_ids = family
            .stop_tokens()
            .iter()
            .filter_map(|t| tokenizer.token_to_id(t))
            .collect::<Vec<_>>();
        if stop_ids.is_empty() {
            bail!("the tokenizer has none of the model's end-of-turn tokens");
        }
        info!(
            "Loaded LLM {} ({architecture}) on {:?} in {:?}",
            model_path.display(),
            device,
            started.elapsed()
        );
        Ok(Self {
            weights,
            tokenizer,
            device,
            family,
            stop_ids,
        })
    }

    pub fn family(&self) -> Family {
        self.family
    }

    /// Tokens in `text`, without special tokens.
    pub fn count_tokens(&self, text: &str) -> usize {
        self.tokenizer
            .encode(text, false)
            .map(|e| e.get_ids().len())
            .unwrap_or_else(|_| text.split_whitespace().count() * 4 / 3)
    }

    /// Runs `prompt` (already in the chat template) and returns the answer.
    /// `on_token` hears the count of tokens generated so far and returns
    /// `false` to stop early.
    pub fn generate(
        &mut self,
        prompt: &str,
        sampler: &Sampler,
        mut on_token: impl FnMut(usize) -> bool,
    ) -> Result<String> {
        let encoding = self
            .tokenizer
            .encode(prompt, false)
            .map_err(|e| anyhow!("tokenize the prompt: {e}"))?;
        let prompt_ids = encoding.get_ids();
        if prompt_ids.is_empty() {
            bail!("empty prompt");
        }
        if prompt_ids.len() > MAX_PROMPT_TOKENS {
            bail!(
                "the text is too long for this model ({} tokens, at most {MAX_PROMPT_TOKENS})",
                prompt_ids.len()
            );
        }

        let sampling = if sampler.temperature <= 0.0 {
            Sampling::ArgMax
        } else {
            Sampling::TopP {
                p: sampler.top_p,
                temperature: sampler.temperature,
            }
        };
        let seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(42);
        let mut logits_processor = LogitsProcessor::from_sampling(seed, sampling);

        self.weights.reset();
        let input = Tensor::new(prompt_ids, &self.device)?.unsqueeze(0)?;
        let logits = self.weights.forward(&input, 0)?;
        let mut next = logits_processor.sample(&last_logits(&logits)?)?;

        let mut generated = Vec::with_capacity(sampler.max_new_tokens);
        let mut position = prompt_ids.len();
        while !self.stop_ids.contains(&next) && generated.len() < sampler.max_new_tokens {
            generated.push(next);
            if !on_token(generated.len()) {
                break;
            }
            let input = Tensor::new(&[next], &self.device)?.unsqueeze(0)?;
            let logits = self.weights.forward(&input, position)?;
            position += 1;
            next = logits_processor.sample(&last_logits(&logits)?)?;
        }

        self.tokenizer
            .decode(&generated, true)
            .map_err(|e| anyhow!("decode the answer: {e}"))
    }
}

/// The logits for the last position as a 1-D f32 vector.
fn last_logits(logits: &Tensor) -> candle_core::Result<Tensor> {
    let logits = logits.squeeze(0)?;
    let logits = if logits.rank() == 2 {
        logits.get(logits.dim(0)? - 1)?
    } else {
        logits
    };
    logits.to_dtype(DType::F32)
}

#[cfg(test)]
mod tests {
    use super::{Engine, Family, Sampler};
    use crate::common::settings::{builtin_rewrite, rewrite_template};

    /// Rewrites a real dictation with a downloaded model. Run with
    /// `GLIDER_LLM_TEST_DIR=<dir with model.gguf and tokenizer.json>` (and
    /// `GLIDER_LLM_TEST_THINKING=1` for a hybrid Qwen3 such as 1.7B):
    /// `cargo test --lib rewrites_with_a_real_model -- --ignored --nocapture`
    #[test]
    #[ignore = "needs a downloaded model"]
    fn rewrites_with_a_real_model() {
        let dir = std::path::PathBuf::from(std::env::var("GLIDER_LLM_TEST_DIR").unwrap());
        let thinking = std::env::var("GLIDER_LLM_TEST_THINKING").is_ok();
        let started = std::time::Instant::now();
        let mut engine = Engine::load(
            &dir.join("model.gguf"),
            &dir.join("tokenizer.json"),
            Family::Qwen3 { thinking },
        )
        .unwrap();
        println!("loaded in {:?}", started.elapsed());
        let dictation = crate::features::llm::service::DICTATION_POLISH_PROMPT.to_string();
        for (id, text) in [
            ("default_refine_polish", "ok so um the overlay breaks when i press read while its dictating"),
            ("default_refine_grammar", "i has went to the store yesterday and buyed three apple"),
            ("default_refine_prompt", "so basically can you like make the history page not jump when a new entry comes in, keep the scroll where it was, and also dont touch the settings page"),
            ("dictation", "um so open the readme dot md file and uh change the port to three thousand no wait four thousand"),
            ("dictation", "i has went to the store yesterday and buyed three apple"),
            ("dictation", "what time is the meeting tomorrow"),
            ("dictation", "hey john uh i think we should um move the standup to two thirty tomorrow if thats ok with you"),
            ("dictation", "run npm run dev and then open the app dot tsx file in the src folder"),
        ] {
            let template = if id == "dictation" {
                dictation.clone()
            } else {
                rewrite_template(&builtin_rewrite(id).unwrap())
            };
            let user = template.replace("${output}", text);
            let prompt = engine.family().chat_prompt(crate::features::llm::service::LLM_SYSTEM, &user);
            let started = std::time::Instant::now();
            let mut tokens = 0;
            let answer = engine
                .generate(
                    &prompt,
                    &Sampler { temperature: 0.0, top_p: 0.9, max_new_tokens: 200 },
                    |n| {
                        tokens = n;
                        true
                    },
                )
                .unwrap();
            let secs = started.elapsed().as_secs_f32();
            println!("[{id}] {tokens} tokens in {secs:.1}s ({:.1} tok/s)\n  in:  {text}\n  out: {answer}", tokens as f32 / secs);
            assert!(!answer.trim().is_empty());
            assert!(!answer.contains("<think>"));
            assert!(!answer.contains("<|im_end|>"));
        }
    }

    #[test]
    fn chat_prompts_end_where_the_answer_starts() {
        let qwen = Family::Qwen3 { thinking: true }.chat_prompt("Be brief.", "hi");
        assert!(qwen.starts_with("<|im_start|>system\nBe brief.<|im_end|>"));
        assert!(qwen.ends_with("<|im_start|>assistant\n<think>\n\n</think>\n\n"));
        let instruct = Family::Qwen3 { thinking: false }.chat_prompt("s", "u");
        assert!(instruct.ends_with("<|im_start|>assistant\n"));
        let gemma = Family::Gemma3.chat_prompt("s", "u");
        assert_eq!(
            gemma,
            "<bos><start_of_turn>user\ns\n\nu<end_of_turn>\n<start_of_turn>model\n"
        );
        let llama = Family::Llama3.chat_prompt("s", "u");
        assert!(llama.ends_with("<|start_header_id|>assistant<|end_header_id|>\n\n"));
    }
}
