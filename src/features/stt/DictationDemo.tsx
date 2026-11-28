import React, { useEffect, useState } from "react";
import {
  voiceExample,
  paces,
  prefersStill,
  sleep,
  tokens,
  WORD_MS,
} from "@/common/lib/demo";

/** Bar heights for the listening wave; staggered so it moves like a voice. */
const LEVELS = [5, 8, 11, 6, 3, 7, 10, 6, 4, 8, 5];

type Phase = "idle" | "listening" | "transcribing";

/** The recording overlay's pill in miniature: a wave while listening, a dot
 * sweep while transcribing, gone otherwise. Themed like the real one. */
const MiniPill: React.FC<{ phase: Phase; shown: boolean }> = ({
  phase,
  shown,
}) => (
  <span className={`g-mini ${phase} ${shown ? "" : "away"}`} aria-hidden="true">
    <span className="g-mini-wave">
      {LEVELS.map((h, i) => (
        <i
          key={i}
          style={
            {
              "--h": `${h}px`,
              animationDelay: `${i * 70}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  </span>
);

/** Dictation's example on a loop: the shortcut is held, the words arrive as
 * they're said (spoken by its bundled clip when `sound` is on) while the overlay
 * listens, and on release it transcribes and the clean text types itself out. */
export const DictationDemo: React.FC<{
  said: string;
  typed: string;
  /** The shortcut as plain text, e.g. "fn"; empty when it has none. */
  keys: string;
  label: string;
  sound: boolean;
}> = ({ said, typed, keys, label, sound }) => {
  const parts = tokens(said);
  const [heard, setHeard] = useState(parts.length);
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState(typed.length);
  const [out, setOut] = useState(false);
  // Reduced motion: one still frame, with the pill in view.
  const [still, setStill] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    const { signal } = ctl;
    const words = tokens(said);
    const play = async () => {
      if (prefersStill()) {
        setStill(true);
        if (sound) await voiceExample("dictation", said, signal);
        return;
      }
      for (;;) {
        setOut(false);
        setHeard(0);
        setShown(0);
        await sleep(600, signal);
        setPhase("listening");
        await sleep(250, signal);
        const ms = sound ? await voiceExample("dictation", said, signal) : null;
        const count = words.filter((w) => w.trim()).length;
        const steps = paces(words, ms ?? count * WORD_MS);
        for (let i = 0; i < words.length; i++) {
          setHeard(i + 1);
          if (steps[i]) await sleep(steps[i], signal);
        }
        await sleep(300, signal);
        setPhase("transcribing");
        await sleep(650, signal);
        setPhase("idle");
        for (let n = 1; n <= typed.length; n++) {
          setShown(n);
          await sleep(22, signal);
        }
        await sleep(sound ? 2400 : 2000, signal);
        setOut(true);
        await sleep(320, signal);
      }
    };
    play().catch(() => {});
    return () => {
      ctl.abort();
      setPhase("idle");
    };
  }, [said, typed, sound]);

  return (
    <div className={`g-run ${out ? "out" : ""}`}>
      <p className="g-said">
        {parts.map((part, i) => (
          <span key={i} className={i < heard ? undefined : "ghost"}>
            {part}
          </span>
        ))}
      </p>
      {keys && (
        <p className={`g-k ${phase === "listening" ? "held" : ""}`}>
          <b>{keys}</b>
          {label}
          <MiniPill phase={phase} shown={phase !== "idle" || still} />
        </p>
      )}
      {/* The rest stays in the line, hidden, so the card never changes height. */}
      <p className="g-a">
        {typed.slice(0, shown)}
        <span className="g-caret" aria-hidden="true" />
        <span className="invisible">{typed.slice(shown)}</span>
      </p>
    </div>
  );
};
