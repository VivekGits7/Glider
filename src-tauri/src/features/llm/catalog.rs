//! The open models Rewrite can download: a GGUF file and its tokenizer each.

use super::worker::engine::Family;
use serde::Serialize;
use specta::Type;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum LlmSpeed {
    VeryFast,
    Fast,
    Moderate,
}

/// One downloadable model: a GGUF file and the tokenizer it was trained with.
pub struct CatalogEntry {
    pub id: &'static str,
    pub name: &'static str,
    /// The name in tight spots: the overlay, chips, onboarding.
    pub short_name: &'static str,
    pub description: &'static str,
    pub family: Family,
    /// A to C: how well it follows rewrite instructions in our tests.
    pub quality: &'static str,
    pub speed: LlmSpeed,
    /// Memory the computer should have, in GB.
    pub memory_gb: u32,
    pub gguf_url: &'static str,
    pub gguf_bytes: u64,
    pub gguf_sha256: &'static str,
    pub tokenizer_url: &'static str,
    pub tokenizer_bytes: u64,
    pub license: &'static str,
    pub recommended: bool,
    pub older_computers: bool,
}

pub const CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        id: "qwen3-4b-instruct-2507",
        name: "Qwen3 4B Instruct",
        short_name: "Qwen3 4B",
        description: "Best balance of quality and speed for rewriting.",
        family: Family::Qwen3 { thinking: false },
        quality: "A",
        speed: LlmSpeed::Fast,
        memory_gb: 8,
        gguf_url: "https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
        gguf_bytes: 2_497_281_120,
        gguf_sha256: "3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597",
        tokenizer_url: "https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507/resolve/main/tokenizer.json",
        tokenizer_bytes: 11_422_654,
        license: "Apache-2.0",
        recommended: true,
        older_computers: false,
    },
    CatalogEntry {
        id: "gemma-3-4b-it",
        name: "Gemma 3 4B",
        short_name: "Gemma 3 4B",
        description: "Careful rewrites in many languages.",
        family: Family::Gemma3,
        quality: "A",
        speed: LlmSpeed::Moderate,
        memory_gb: 8,
        gguf_url: "https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf",
        gguf_bytes: 2_489_894_016,
        gguf_sha256: "04a43a22e8d2003deda5acc262f68ec1005fa76c735a9962a8c77042a74a7d19",
        tokenizer_url: "https://huggingface.co/unsloth/gemma-3-4b-it/resolve/main/tokenizer.json",
        tokenizer_bytes: 33_384_568,
        license: "Gemma Terms of Use",
        recommended: false,
        older_computers: false,
    },
    CatalogEntry {
        id: "llama-3.2-3b-instruct",
        name: "Llama 3.2 3B Instruct",
        short_name: "Llama 3.2 3B",
        description: "Quick and steady. Good at short rewrites.",
        family: Family::Llama3,
        quality: "B",
        speed: LlmSpeed::Fast,
        memory_gb: 6,
        gguf_url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        gguf_bytes: 2_019_377_696,
        gguf_sha256: "6c1a2b41161032677be168d354123594c0e6e67d2b9227c84f296ad037c728ff",
        tokenizer_url: "https://huggingface.co/unsloth/Llama-3.2-3B-Instruct/resolve/main/tokenizer.json",
        tokenizer_bytes: 17_209_920,
        license: "Llama 3.2 Community License",
        recommended: false,
        older_computers: false,
    },
    CatalogEntry {
        id: "qwen3-8b",
        name: "Qwen3 8B",
        short_name: "Qwen3 8B",
        description: "Strong at following detailed instructions.",
        family: Family::Qwen3 { thinking: true },
        quality: "A",
        speed: LlmSpeed::Moderate,
        memory_gb: 16,
        gguf_url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf",
        gguf_bytes: 5_027_783_488,
        gguf_sha256: "d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785",
        tokenizer_url: "https://huggingface.co/Qwen/Qwen3-8B/resolve/main/tokenizer.json",
        tokenizer_bytes: 11_422_654,
        license: "Apache-2.0",
        recommended: false,
        older_computers: false,
    },
    CatalogEntry {
        id: "qwen3-1.7b",
        name: "Qwen3 1.7B",
        short_name: "Qwen3 1.7B",
        description: "Fastest. Fine for grammar fixes, weaker at big rewrites.",
        family: Family::Qwen3 { thinking: true },
        quality: "C",
        speed: LlmSpeed::VeryFast,
        memory_gb: 4,
        gguf_url: "https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf",
        gguf_bytes: 1_107_409_472,
        gguf_sha256: "b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897",
        tokenizer_url: "https://huggingface.co/Qwen/Qwen3-1.7B/resolve/main/tokenizer.json",
        tokenizer_bytes: 11_422_654,
        license: "Apache-2.0",
        recommended: false,
        older_computers: true,
    },
];

pub fn find_entry(id: &str) -> Option<&'static CatalogEntry> {
    CATALOG.iter().find(|entry| entry.id == id)
}

#[cfg(test)]
mod tests {
    use super::CATALOG;

    #[test]
    fn catalog_is_consistent() {
        assert_eq!(CATALOG.iter().filter(|e| e.recommended).count(), 1);
        for entry in CATALOG {
            assert_eq!(entry.gguf_sha256.len(), 64, "{}", entry.id);
            assert!(entry.gguf_url.ends_with(".gguf"), "{}", entry.id);
            assert!(
                entry.tokenizer_url.ends_with("tokenizer.json"),
                "{}",
                entry.id
            );
            assert_eq!(CATALOG.iter().filter(|e| e.id == entry.id).count(), 1);
        }
    }
}
