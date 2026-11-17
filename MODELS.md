# Models in Glider

Every model Glider uses runs on your computer. Nothing you say, read or rewrite is uploaded, unless you turn on a provider for Rewrite in **Models → Large language model**.

There are three kinds of model:

1. **Dictation** (speech to text): turns your voice into text.
2. **Speech** (text to speech): reads selected text aloud (Read Aloud).
3. **Refining** (LLM): rewrites selected text (Rewrite and the Refine shortcuts).

The engines that run them are listed at the end.

> **Open source or open weights?** Most models below are released under an open-source license (Apache-2.0, MIT, CC-BY-4.0). A few, marked below, are _open weights_: free to download and run, but under the maker's own license terms. Check the license before shipping Glider commercially.

## 1. Dictation (Speech to Text)

Glider downloads these as GGUF files built for transcribe.cpp, from the handy-computer organization on Hugging Face. The Models page grades each one for your languages, from our test recordings.

- **Links**:
  - transcribe.cpp: `https://github.com/handy-computer/transcribe.cpp`
  - handy-computer on Hugging Face: `https://huggingface.co/handy-computer`

### Main Picks

#### Whisper Small

- **Parameters**: 242M
- **Languages**: 99
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/openai/whisper`
  - Glider's file: `https://huggingface.co/handy-computer/whisper-small-gguf`

#### Whisper Medium

- **Parameters**: 764M
- **Languages**: 99
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/openai/whisper`
  - Glider's file: `https://huggingface.co/handy-computer/whisper-medium-gguf`

#### Whisper Large v3 Turbo

- **Parameters**: 809M
- **Languages**: 100
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/openai/whisper`
  - Glider's file: `https://huggingface.co/handy-computer/whisper-large-v3-turbo-gguf`

#### Whisper Large v3

- **Parameters**: 1.5B
- **Languages**: 100
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/openai/whisper`
  - Glider's file: `https://huggingface.co/handy-computer/whisper-large-v3-gguf`

#### Parakeet TDT 0.6B v3 (Parakeet V3)

- **Parameters**: 627M
- **Languages**: 25
- **License**: CC-BY-4.0
- **Links**:
  - Source: `https://github.com/NVIDIA/NeMo`
  - Glider's file: `https://huggingface.co/handy-computer/parakeet-tdt-0.6b-v3-gguf`

#### Parakeet TDT 0.6B v2

- **Parameters**: 618M
- **Languages**: 1 (English)
- **License**: CC-BY-4.0
- **Links**:
  - Source: `https://github.com/NVIDIA/NeMo`
  - Glider's file: `https://huggingface.co/handy-computer/parakeet-tdt-0.6b-v2-gguf`

#### Parakeet Ultra

- **Parameters**: 627M
- **Languages**: 25
- **License**: CC-BY-4.0
- **Links**:
  - Source: `https://github.com/NVIDIA/NeMo`
  - Glider's file: `https://huggingface.co/handy-computer/parakeet-ultra-gguf`

#### Canary 1B v2

- **Parameters**: 980M
- **Languages**: 25
- **License**: CC-BY-4.0
- **Links**:
  - Source: `https://github.com/NVIDIA/NeMo`
  - Glider's file: `https://huggingface.co/handy-computer/canary-1b-v2-gguf`

#### Canary 180M Flash

- **Parameters**: 189M
- **Languages**: 4
- **License**: CC-BY-4.0
- **Links**:
  - Source: `https://github.com/NVIDIA/NeMo`
  - Glider's file: `https://huggingface.co/handy-computer/canary-180m-flash-gguf`

#### Qwen3-ASR 0.6B

- **Parameters**: 782M
- **Languages**: 30
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/QwenLM/Qwen3-ASR`
  - Glider's file: `https://huggingface.co/handy-computer/Qwen3-ASR-0.6B-gguf`

#### Qwen3-ASR 1.7B

- **Parameters**: 2.0B
- **Languages**: 30
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/QwenLM/Qwen3-ASR`
  - Glider's file: `https://huggingface.co/handy-computer/Qwen3-ASR-1.7B-gguf`

#### SenseVoice Small

- **Parameters**: 234M
- **Languages**: 5
- **License**: Model license (open weights)
- **Links**:
  - Source: `https://github.com/FunAudioLLM/SenseVoice`
  - Glider's file: `https://huggingface.co/handy-computer/SenseVoiceSmall-gguf`

#### Fun-ASR Nano / Nano Multilingual

- **Parameters**: 830M
- **Languages**: 3 / 31
- **License**: Model license (open weights)
- **Links**:
  - Source: `https://github.com/FunAudioLLM/Fun-ASR`
  - Glider's file: `https://huggingface.co/handy-computer/Fun-ASR-MLT-Nano-2512-gguf`

#### Moonshine Tiny / Base / Streaming (Live Preview)

- **Parameters**: 27M to 266M
- **Languages**: 1 each
- **License**: MIT
- **Links**:
  - Source: `https://github.com/moonshine-ai/moonshine`
  - Glider's files: `https://huggingface.co/handy-computer`

#### Granite Speech 4.1 2B / 5.0 470M TurboCTC

- **Parameters**: 473M to 2.3B
- **Languages**: 1 to 6
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/ibm-granite/granite-speech-models`
  - Glider's file: `https://huggingface.co/handy-computer/granite-speech-4.1-2b-gguf`

#### GigaAM v3 (CTC / RNN-T)

- **Parameters**: 221M
- **Languages**: 1 (Russian)
- **License**: MIT
- **Links**:
  - Source: `https://github.com/salute-developers/GigaAM`
  - Glider's file: `https://huggingface.co/handy-computer/gigaam-v3-e2e-ctc-gguf`

#### Voxtral Mini 3B / Mini 4B Realtime

- **Parameters**: 4.4B to 4.7B
- **Languages**: 8 to 13
- **License**: Apache-2.0
- **Links**:
  - Source (Hugging Face): `https://huggingface.co/mistralai/Voxtral-Mini-3B-2507`
  - Glider's file: `https://huggingface.co/handy-computer/Voxtral-Mini-3B-2507-gguf`

#### Cohere Transcribe

- **Parameters**: 2.0B
- **Languages**: 14
- **License**: Apache-2.0
- **Links**:
  - Source (Hugging Face): `https://huggingface.co/CohereLabs`
  - Glider's file: `https://huggingface.co/handy-computer/cohere-transcribe-03-2026-gguf`

#### Nemotron Speech Streaming 3.5

- **Parameters**: 638M
- **Languages**: 32
- **License**: NVIDIA model license (open weights)
- **Links**:
  - Source: `https://github.com/NVIDIA/NeMo`
  - Glider's file: `https://huggingface.co/handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf`

#### Breeze-ASR-25 (Taiwanese Mandarin)

- **Parameters**: 1.5B
- **Languages**: 2
- **License**: Apache-2.0
- **Links**:
  - Source (Hugging Face): `https://huggingface.co/MediaTek-Research/Breeze-ASR-25`
  - Glider's file: `https://huggingface.co/handy-computer/Breeze-ASR-25-gguf`

#### MedASR (Medical English)

- **Parameters**: 105M
- **Languages**: 1
- **License**: Model license (open weights)
- **Links**:
  - Source: `https://github.com/google-health/medasr`
  - Glider's file: `https://huggingface.co/handy-computer/medasr-gguf`

The full list, with every size and quantization, is in the `@handy-computer/models` catalog that Glider ships with. Search for any of them on the Models page.

- **Links**:
  - Catalog: `https://www.npmjs.com/package/@handy-computer/models`

### Helpers for Dictation

#### Silero VAD v6

- **What it does**: Finds where you're speaking, so silence isn't transcribed
- **License**: MIT
- **Links**:
  - Source: `https://github.com/snakers4/silero-vad`

#### VoxLingua107 ECAPA

- **What it does**: Detects which language you're speaking ("Limit auto to my languages")
- **License**: Apache-2.0
- **Links**:
  - Source (Hugging Face): `https://huggingface.co/speechbrain/lang-id-voxlingua107-ecapa`
  - Glider's file: `https://huggingface.co/handy-computer/lang-id-voxlingua107-ecapa-gguf`

## 2. Speech (Text to Speech)

Read Aloud voices come from sherpa-onnx's TTS releases and download once, on demand.

- **Links**:
  - sherpa-onnx TTS releases: `https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models`

#### Kokoro (int8, v0.19)

- **Language**: English (US and UK)
- **Speakers**: 11
- **Size**: 98 MB
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/hexgrad/kokoro`

#### Kitten Nano (v0.2)

- **Language**: English
- **Speakers**: 8
- **Size**: 25 MB
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/KittenML/KittenTTS`

#### Piper Lessac (en_US, Medium)

- **Language**: English (US)
- **Speakers**: 1
- **Size**: 19 MB
- **License**: MIT engine, voice dataset license
- **Links**:
  - Source: `https://github.com/rhasspy/piper`
  - Voices: `https://huggingface.co/rhasspy/piper-voices`

#### Piper Pratham (hi_IN, Medium)

- **Language**: Hindi
- **Speakers**: 1
- **Size**: 20 MB
- **License**: MIT engine, voice dataset license
- **Links**:
  - Source: `https://github.com/rhasspy/piper`
  - Voices: `https://huggingface.co/rhasspy/piper-voices`

All voices use espeak-ng data (GPL-3.0) to turn words into sounds. Piper's development continues at OHF-Voice/piper1-gpl.

- **Links**:
  - espeak-ng: `https://github.com/espeak-ng/espeak-ng`
  - piper1-gpl: `https://github.com/OHF-Voice/piper1-gpl`

## 3. Refining (LLM)

These power **Rewrite**: select text in any app, press a Refine shortcut (`Option+1` to `4`, or `Alt+1` to `4`), and the LLM rewrites it where it is. Glider downloads one quantized GGUF file (Q4_K_M) plus the model's tokenizer, checks the file's SHA-256, and runs it with candle. On Apple Silicon it runs on the GPU (Metal).

- **Links**:
  - candle: `https://github.com/huggingface/candle`

#### Qwen3 4B Instruct (2507), Recommended

- **Quality**: A
- **Speed**: Fast
- **Memory**: 8 GB
- **Download**: 2.5 GB
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/QwenLM/Qwen3`
  - GGUF file: `https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF`
  - Tokenizer: `https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507`

#### Gemma 3 4B (Instruction Tuned)

- **Quality**: A
- **Speed**: Moderate
- **Memory**: 8 GB
- **Download**: 2.5 GB
- **License**: Gemma Terms of Use (open weights)
- **Links**:
  - Source: `https://github.com/google-deepmind/gemma`
  - GGUF file: `https://huggingface.co/unsloth/gemma-3-4b-it-GGUF`
  - Tokenizer (ungated mirror): `https://huggingface.co/unsloth/gemma-3-4b-it`

#### Llama 3.2 3B Instruct

- **Quality**: B
- **Speed**: Fast
- **Memory**: 6 GB
- **Download**: 2.0 GB
- **License**: Llama 3.2 Community License (open weights)
- **Links**:
  - Source: `https://github.com/meta-llama/llama-models`
  - GGUF file: `https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF`
  - Tokenizer (ungated mirror): `https://huggingface.co/unsloth/Llama-3.2-3B-Instruct`

#### Qwen3 8B

- **Quality**: A
- **Speed**: Moderate
- **Memory**: 16 GB
- **Download**: 5.0 GB
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/QwenLM/Qwen3`
  - GGUF file: `https://huggingface.co/Qwen/Qwen3-8B-GGUF`
  - Tokenizer: `https://huggingface.co/Qwen/Qwen3-8B`

#### Qwen3 1.7B, for Older Computers

- **Quality**: C
- **Speed**: Very fast
- **Memory**: 4 GB
- **Download**: 1.1 GB
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/QwenLM/Qwen3`
  - GGUF file: `https://huggingface.co/unsloth/Qwen3-1.7B-GGUF`
  - Tokenizer: `https://huggingface.co/Qwen/Qwen3-1.7B`

**Measured on an Apple M5 (16 GB):** Qwen3 4B rewrites at about 23 tokens a second and Qwen3 1.7B at about 30 to 40. The first rewrite after launch also loads the model, which takes a few seconds.

**Why these five.** They are small enough to run on a laptop, follow rewrite instructions well, and run in candle without extra native libraries. Phi-4 mini was in an early design; it was swapped for Qwen3 8B because candle's Phi-3 loader can't read Phi-4 mini's file layout.

**Use a provider instead.** In **Models → Large language model** you can send rewrites to OpenAI, Anthropic, OpenRouter, Groq, Cerebras, Z.ai, a custom OpenAI-compatible server (such as Ollama or LM Studio), or Apple Intelligence on supported Macs. Only the selected text is sent.

## Engines

#### transcribe.cpp

- **Runs**: Dictation models (GGUF), with Metal, Vulkan or CPU
- **License**: MIT
- **Links**:
  - Source: `https://github.com/handy-computer/transcribe.cpp`

#### ggml

- **Runs**: The tensor library under transcribe.cpp
- **License**: MIT
- **Links**:
  - Source: `https://github.com/ggml-org/ggml`

#### sherpa-onnx (1.13.8)

- **Runs**: Read Aloud voices (ONNX)
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/k2-fsa/sherpa-onnx`

#### candle (0.11)

- **Runs**: Rewrite's LLMs (GGUF), with Metal or CPU
- **License**: Apache-2.0 / MIT
- **Links**:
  - Source: `https://github.com/huggingface/candle`

#### tokenizers (0.23)

- **Runs**: Splits text into the LLM's tokens
- **License**: Apache-2.0
- **Links**:
  - Source: `https://github.com/huggingface/tokenizers`

#### Handy

- **Runs**: The dictation app Glider is built on
- **License**: MIT
- **Links**:
  - Source: `https://github.com/cjpais/Handy`

## Where the Files Go

Every model sits in one `models` folder, with a folder per kind:

- **Speech to text (dictation)**: `models/stt`
- **Text to speech (Read Aloud voices)**: `models/tts`
- **Large language models (Rewrite)**: `models/llm`

The `models` folder is in Glider's app data:

- **macOS**: `~/Library/Application Support/com.glider.app/models`
- **Windows**: `C:\Users\<you>\AppData\Roaming\com.glider.app\models`

The folder button on the Models page opens the one for the tab you're on. Delete any model from the Models page; Glider downloads it again when you pick it. Glider still finds speech models other tools put in the shared Hugging Face cache (`~/.cache/huggingface/hub`), but downloads its own into `models/stt`. Models from older versions of Glider move into these folders on their own the next time it starts.
