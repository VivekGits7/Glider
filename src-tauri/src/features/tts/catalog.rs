//! The voice models Read Aloud can download, and the voices in each.

use serde::{Deserialize, Serialize};

pub const DEFAULT_MODEL_ID: &str = "kokoro-int8-en-v0_19";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Engine {
    Kokoro,
    Kitten,
    Piper,
    /// Told the language with every sentence.
    Supertonic,
    /// Clones each voice from a short clip in the model's `test_wavs` folder.
    Pocket,
}

impl Engine {
    /// Whether the voice turns text into sounds with espeak-ng's data.
    pub fn uses_espeak(self) -> bool {
        matches!(self, Engine::Kokoro | Engine::Kitten | Engine::Piper)
    }
}

/// The languages Supertonic 3 reads.
const SUPERTONIC_LANGUAGES: &[&str] = &[
    "en", "ko", "ja", "ar", "bg", "cs", "da", "de", "el", "es", "et", "fi", "fr", "hi", "hr", "hu",
    "id", "it", "lt", "lv", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "tr", "uk", "vi",
];

/// The languages Kokoro 1.0's voices speak, in the order the picker lists them.
const KOKORO_LANGUAGES: &[&str] = &["en", "hi", "es", "fr", "it", "pt", "ja", "zh"];

/// One downloadable voice model. `id` is also the archive name and the
/// folder it unpacks to.
pub(super) struct CatalogEntry {
    pub(super) id: &'static str,
    pub(super) name: &'static str,
    pub(super) description: &'static str,
    /// ISO 639-1 codes it reads, the default first.
    pub(super) languages: &'static [&'static str],
    /// The language of each voice, when voices are tied to one (Kokoro 1.0);
    /// empty when every voice reads every language.
    pub(super) voice_languages: &'static [&'static str],
    /// A to C: how natural it sounds to us.
    pub(super) quality: &'static str,
    /// `very_fast`, `fast` or `moderate`, the same words Rewrite's models use.
    pub(super) speed: &'static str,
    pub(super) size_mb: u32,
    pub(super) engine: Engine,
    pub(super) model_file: &'static str,
    pub(super) voices: &'static [&'static str],
}

pub(super) const CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        id: "kokoro-int8-en-v0_19",
        name: "Kokoro",
        description: "Most natural voices. 11 American and British speakers.",
        languages: &["en"],
        voice_languages: &[],
        quality: "A",
        speed: "fast",
        size_mb: 98,
        engine: Engine::Kokoro,
        model_file: "model.int8.onnx",
        voices: &[
            "Default (US)",
            "Bella (US)",
            "Nicole (US)",
            "Sarah (US)",
            "Sky (US)",
            "Adam (US)",
            "Michael (US)",
            "Emma (UK)",
            "Isabella (UK)",
            "George (UK)",
            "Lewis (UK)",
        ],
    },
    CatalogEntry {
        id: "kitten-nano-en-v0_2-fp16",
        name: "Kitten Nano",
        description: "Tiny and fast. Good for older computers. 8 speakers.",
        languages: &["en"],
        voice_languages: &[],
        quality: "C",
        speed: "very_fast",
        size_mb: 25,
        engine: Engine::Kitten,
        model_file: "model.fp16.onnx",
        voices: &[
            "Male 1", "Female 1", "Male 2", "Female 2", "Male 3", "Female 3", "Male 4", "Female 4",
        ],
    },
    CatalogEntry {
        id: "kokoro-int8-multi-lang-v1_0",
        name: "Kokoro Multilingual",
        description: "Kokoro 1.0. 53 voices, best in English and Chinese.",
        languages: KOKORO_LANGUAGES,
        voice_languages: &[
            "en", "en", "en", "en", "en", "en", "en", "en", "en", "en", "en", "en", "en", "en",
            "en", "en", "en", "en", "en", "en", "en", "en", "en", "en", "en", "en", "en", "en",
            "es", "es", "fr", "hi", "hi", "hi", "hi", "it", "it", "ja", "ja", "ja", "ja", "ja",
            "pt", "pt", "pt", "zh", "zh", "zh", "zh", "zh", "zh", "zh", "zh",
        ],
        quality: "A",
        speed: "fast",
        size_mb: 126,
        engine: Engine::Kokoro,
        model_file: "model.int8.onnx",
        // In speaker id order (sid 0-52), from sherpa-onnx's model page.
        voices: &[
            "Alloy (US)",
            "Aoede (US)",
            "Bella (US)",
            "Heart (US)",
            "Jessica (US)",
            "Kore (US)",
            "Nicole (US)",
            "Nova (US)",
            "River (US)",
            "Sarah (US)",
            "Sky (US)",
            "Adam (US)",
            "Echo (US)",
            "Eric (US)",
            "Fenrir (US)",
            "Liam (US)",
            "Michael (US)",
            "Onyx (US)",
            "Puck (US)",
            "Santa (US)",
            "Alice (UK)",
            "Emma (UK)",
            "Isabella (UK)",
            "Lily (UK)",
            "Daniel (UK)",
            "Fable (UK)",
            "George (UK)",
            "Lewis (UK)",
            "Dora (Spanish)",
            "Alex (Spanish)",
            "Siwis (French)",
            "Alpha (Hindi)",
            "Beta (Hindi)",
            "Omega (Hindi)",
            "Psi (Hindi)",
            "Sara (Italian)",
            "Nicola (Italian)",
            "Alpha (Japanese)",
            "Gongitsune (Japanese)",
            "Nezumi (Japanese)",
            "Tebukuro (Japanese)",
            "Kumo (Japanese)",
            "Dora (Portuguese)",
            "Alex (Portuguese)",
            "Santa (Portuguese)",
            "Xiaobei (Chinese)",
            "Xiaoni (Chinese)",
            "Xiaoxiao (Chinese)",
            "Xiaoyi (Chinese)",
            "Yunjian (Chinese)",
            "Yunxi (Chinese)",
            "Yunxia (Chinese)",
            "Yunyang (Chinese)",
        ],
    },
    CatalogEntry {
        id: "sherpa-onnx-supertonic-3-tts-int8-2026-05-11",
        name: "Supertonic 3",
        description: "Natural voices in 31 languages, Hindi included. 10 speakers.",
        languages: SUPERTONIC_LANGUAGES,
        voice_languages: &[],
        quality: "A",
        speed: "fast",
        size_mb: 123,
        engine: Engine::Supertonic,
        model_file: "vocoder.int8.onnx",
        voices: &[
            "Voice 1", "Voice 2", "Voice 3", "Voice 4", "Voice 5", "Voice 6", "Voice 7", "Voice 8",
            "Voice 9", "Voice 10",
        ],
    },
    CatalogEntry {
        id: "sherpa-onnx-pocket-tts-int8-2026-01-26",
        name: "Pocket TTS",
        description: "Copies a voice from a short clip. 3 voices.",
        languages: &["en"],
        voice_languages: &[],
        quality: "B",
        speed: "fast",
        size_mb: 94,
        engine: Engine::Pocket,
        model_file: "lm_main.int8.onnx",
        // One per clip in `test_wavs`, in file name order: bria, loona,
        // sample_fr_hibiki_crepes.
        voices: &["Bria", "Loona", "Hibiki"],
    },
    CatalogEntry {
        id: "kitten-mini-en-v0_8",
        name: "Kitten Mini",
        description: "Kitten 0.8, the clearest Kitten voices. 8 speakers.",
        languages: &["en"],
        voice_languages: &[],
        quality: "B",
        speed: "fast",
        size_mb: 64,
        engine: Engine::Kitten,
        model_file: "model.onnx",
        voices: &[
            "Male 1", "Female 1", "Male 2", "Female 2", "Male 3", "Female 3", "Male 4", "Female 4",
        ],
    },
    CatalogEntry {
        id: "kitten-micro-en-v0_8",
        name: "Kitten Micro",
        description: "Kitten 0.8. Small and quick. 8 speakers.",
        languages: &["en"],
        voice_languages: &[],
        quality: "B",
        speed: "very_fast",
        size_mb: 42,
        engine: Engine::Kitten,
        model_file: "model.onnx",
        voices: &[
            "Male 1", "Female 1", "Male 2", "Female 2", "Male 3", "Female 3", "Male 4", "Female 4",
        ],
    },
    CatalogEntry {
        id: "kitten-nano-en-v0_8-int8",
        name: "Kitten Nano 0.8",
        description: "Tiniest and fastest, newer than Kitten Nano. 8 speakers.",
        languages: &["en"],
        voice_languages: &[],
        quality: "C",
        speed: "very_fast",
        size_mb: 30,
        engine: Engine::Kitten,
        model_file: "model.int8.onnx",
        voices: &[
            "Male 1", "Female 1", "Male 2", "Female 2", "Male 3", "Female 3", "Male 4", "Female 4",
        ],
    },
    CatalogEntry {
        id: "vits-piper-en_US-lessac-medium-int8",
        name: "Piper Lessac",
        description: "Fast, clear American English voice.",
        languages: &["en"],
        voice_languages: &[],
        quality: "B",
        speed: "very_fast",
        size_mb: 19,
        engine: Engine::Piper,
        model_file: "en_US-lessac-medium.onnx",
        voices: &["Lessac"],
    },
    CatalogEntry {
        id: "vits-piper-hi_IN-pratham-medium-int8",
        name: "Piper Pratham",
        description: "Hindi voice. Reads Devanagari text.",
        languages: &["hi"],
        voice_languages: &[],
        quality: "B",
        speed: "very_fast",
        size_mb: 20,
        engine: Engine::Piper,
        model_file: "hi_IN-pratham-medium.onnx",
        voices: &["Pratham"],
    },
];

pub(super) fn find_entry(id: &str) -> Option<&'static CatalogEntry> {
    CATALOG.iter().find(|entry| entry.id == id)
}

impl CatalogEntry {
    /// The language to read in: the one picked for this model in `chosen`
    /// (model id → language), or the model's default.
    pub(super) fn reading_language(
        &self,
        chosen: &std::collections::HashMap<String, String>,
    ) -> &'static str {
        chosen
            .get(self.id)
            .and_then(|code| self.languages.iter().find(|l| *l == code))
            .unwrap_or(&self.languages[0])
    }

    /// What the voice is told when it loads: Kokoro 1.0 takes espeak's name
    /// for the language. A different language reloads the voice.
    pub(super) fn load_language(&self, language: &str) -> Option<&'static str> {
        (self.engine == Engine::Kokoro && self.languages.len() > 1)
            .then(|| kokoro_espeak_language(language))
    }

    /// What each sentence is told: Supertonic reads in the language it gets.
    pub(super) fn sentence_language(&self, language: &'static str) -> Option<&'static str> {
        (self.engine == Engine::Supertonic).then_some(language)
    }

    /// `voice` if it speaks `language`, else the first voice that does.
    pub(super) fn voice_for(&self, voice: i32, language: &str) -> i32 {
        let speaks = |index: usize| {
            self.voice_languages
                .get(index)
                .is_none_or(|voice_language| *voice_language == language)
        };
        if speaks(voice.max(0) as usize) {
            return voice;
        }
        (0..self.voices.len())
            .find(|&index| speaks(index))
            .map_or(voice, |index| index as i32)
    }
}

/// espeak-ng's name for a language Kokoro 1.0 reads.
fn kokoro_espeak_language(code: &str) -> &'static str {
    match code {
        "hi" => "hi",
        "es" => "es",
        "fr" => "fr-fr",
        "it" => "it",
        "pt" => "pt-br",
        "ja" => "ja",
        "zh" => "cmn",
        _ => "en-us",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn catalog_is_consistent() {
        assert!(find_entry(DEFAULT_MODEL_ID).is_some());
        // Voices map to speaker ids by position, so the counts must match.
        let kokoro = find_entry("kokoro-int8-multi-lang-v1_0").unwrap();
        assert_eq!(kokoro.voices.len(), 53);
        assert_eq!(kokoro.voices[3], "Heart (US)");
        assert_eq!(kokoro.voices[52], "Yunyang (Chinese)");
        assert_eq!(kokoro.voice_languages.len(), kokoro.voices.len());
        let mut ids = HashSet::new();
        for entry in CATALOG {
            assert!(ids.insert(entry.id), "duplicate id {}", entry.id);
            assert!(!entry.voices.is_empty(), "{} has no voices", entry.id);
            assert!(
                !entry.languages.is_empty(),
                "{} reads no language",
                entry.id
            );
            assert!(
                entry.voice_languages.is_empty()
                    || entry.voice_languages.len() == entry.voices.len(),
                "{}",
                entry.id
            );
            assert!(["A", "B", "C"].contains(&entry.quality), "{}", entry.id);
            assert!(
                ["very_fast", "fast", "moderate"].contains(&entry.speed),
                "{}",
                entry.id
            );
        }
    }

    #[test]
    fn a_picked_language_chooses_a_voice_that_speaks_it() {
        let kokoro = find_entry("kokoro-int8-multi-lang-v1_0").unwrap();
        let none = std::collections::HashMap::new();
        assert_eq!(kokoro.reading_language(&none), "en");
        let hindi = std::collections::HashMap::from([(kokoro.id.to_string(), "hi".to_string())]);
        assert_eq!(kokoro.reading_language(&hindi), "hi");
        // A language the model doesn't read falls back to its default.
        let klingon = std::collections::HashMap::from([(kokoro.id.to_string(), "tlh".to_string())]);
        assert_eq!(kokoro.reading_language(&klingon), "en");
        // Alloy (US) can't read Hindi: the first Hindi voice, Alpha, does.
        assert_eq!(kokoro.voice_for(0, "hi"), 31);
        assert_eq!(kokoro.voice_for(32, "hi"), 32);
        // Supertonic's voices read every language.
        let supertonic = find_entry("sherpa-onnx-supertonic-3-tts-int8-2026-05-11").unwrap();
        assert_eq!(supertonic.voice_for(6, "hi"), 6);
        assert_eq!(kokoro.load_language("pt"), Some("pt-br"));
        assert_eq!(supertonic.load_language("hi"), None);
        assert_eq!(supertonic.sentence_language("hi"), Some("hi"));
        assert_eq!(kokoro.sentence_language("hi"), None);
    }
}
