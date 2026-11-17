import { listen } from "@tauri-apps/api/event";
import { commands } from "@/bindings";

/** Helpers for the looping examples on the feature pages' intro cards. */

/** Resolves after `ms`; rejects as soon as `signal` aborts, ending the loop. */
export const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/** True when the user asked the system for less motion. */
export const prefersStill = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A line split into words and the spaces between them. */
// shortcut: splits on spaces, so a language without them animates as one word; use Intl.Segmenter once the TS lib has it.
export const tokens = (text: string) => text.split(/(\s+)/).filter(Boolean);

/** How long each token shows, sharing `total` ms by word length; spaces take none. */
export const paces = (parts: string[], total: number) => {
  const weights = parts.map((p) => (p.trim() ? p.length + 2 : 0));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => (w * total) / sum);
};

/** A word's pace when no voice is playing. */
export const WORD_MS = 300;

/**
 * Reads `text` aloud in the user's chosen voice. Resolves with how long the
 * audio runs once it starts playing, or null if it never starts (no voice, an
 * error, or 8s of loading). Aborting stops the voice if it's still ours.
 */
export const narrate = (text: string, signal: AbortSignal) =>
  new Promise<number | null>((resolve) => {
    let settled = false;
    let asked = false;
    let off: (() => void) | undefined;
    // While the audio might still be playing; stopping after that could cut
    // off a read the user started themselves.
    let until = Infinity;
    const stop = () => {
      if (asked && Date.now() < until) void commands.stopSpeaking();
    };
    const settle = (ms: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      off?.();
      until = ms == null ? 0 : Date.now() + ms + 500;
      resolve(ms);
    };
    const timer = setTimeout(() => {
      stop();
      settle(null);
    }, 8000);
    signal.addEventListener(
      "abort",
      () => {
        stop();
        settle(null);
      },
      { once: true },
    );
    // Rust reports each sentence as it starts playing; a demo line is one.
    void listen<{ index: number; ms: number }>("reading-progress", (e) => {
      if (asked && e.payload.index === 0) settle(e.payload.ms);
    }).then((unlisten) => {
      if (settled) return unlisten();
      off = unlisten;
      asked = true;
      void commands.speakDemo(text).then((r) => {
        if (r.status === "error") settle(null);
      });
    });
  });
