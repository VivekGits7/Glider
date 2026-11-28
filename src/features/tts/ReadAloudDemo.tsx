import React, { useEffect, useState } from "react";
import {
  voiceExample,
  paces,
  prefersStill,
  sleep,
  tokens,
  WORD_MS,
} from "@/common/lib/demo";
import {
  MinusIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  PrevIcon,
} from "@/overlay/icons";

const SEGMENTS = 6;

/** Read Aloud's overlay player in miniature: its controls, a progress strip
 * that follows the read, and the speed. Themed like the real one. */
const MiniPlayer: React.FC<{
  /** Off screen until a read starts, like the real overlay. */
  shown: boolean;
  playing: boolean;
  /** 0 to 1 through the read. */
  progress: number;
  speed: number;
}> = ({ shown, playing, progress, speed }) => {
  const current = playing
    ? Math.min(SEGMENTS - 1, Math.floor(progress * SEGMENTS))
    : progress >= 1
      ? SEGMENTS
      : -1;
  return (
    <span className={`g-mplayer ${shown ? "" : "away"}`} aria-hidden="true">
      <span className="g-mbtn">
        <PrevIcon />
      </span>
      <span className="g-mplay">{playing ? <PauseIcon /> : <PlayIcon />}</span>
      <span className="g-mbtn">
        <NextIcon />
      </span>
      <span className="g-msegs">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`g-mseg ${i < current ? "done" : i === current ? "cur" : ""}`}
          />
        ))}
      </span>
      <span className="g-mspeed">
        <MinusIcon />
        <b>{`${speed.toFixed(1)}x`}</b>
        <PlusIcon />
      </span>
    </span>
  );
};

/** Read Aloud's example on a loop: the text gets selected, the shortcut is
 * pressed, the overlay player comes up, and each word lights up as it's read,
 * spoken by its bundled clip when `sound` is on. */
export const ReadAloudDemo: React.FC<{
  text: string;
  /** The shortcut as plain text, e.g. "⌥ R"; empty when it has none. */
  keys: string;
  label: string;
  /** The user's reading speed, shown on the player. */
  speed: number;
  sound: boolean;
}> = ({ text, keys, label, speed, sound }) => {
  const parts = tokens(text);
  const [selected, setSelected] = useState(parts.length);
  const [at, setAt] = useState(-1);
  const [pressed, setPressed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [out, setOut] = useState(false);
  // Reduced motion: one still frame, with the player in view.
  const [still, setStill] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    const { signal } = ctl;
    const words = tokens(text);
    const play = async () => {
      if (prefersStill()) {
        setStill(true);
        if (sound) await voiceExample("read", text, signal);
        return;
      }
      for (;;) {
        setOut(false);
        setSelected(0);
        setAt(-1);
        await sleep(600, signal);
        // A quick drag across the text, like selecting it with the mouse.
        for (let i = 1; i <= words.length; i++) {
          setSelected(i);
          await sleep(26, signal);
        }
        await sleep(400, signal);
        setPressed(true);
        await sleep(280, signal);
        setPressed(false);
        setPlaying(true);
        const ms = sound ? await voiceExample("read", text, signal) : null;
        const count = words.filter((w) => w.trim()).length;
        const steps = paces(words, ms ?? count * WORD_MS);
        for (let i = 0; i < words.length; i++) {
          if (!words[i].trim()) continue;
          setAt(i);
          await sleep(steps[i], signal);
        }
        setAt(words.length);
        setPlaying(false);
        await sleep(sound ? 2600 : 1800, signal);
        setOut(true);
        await sleep(320, signal);
      }
    };
    play().catch(() => {});
    return () => {
      ctl.abort();
      setPlaying(false);
    };
  }, [text, sound]);

  return (
    <div className={`g-run ${out ? "out" : ""}`}>
      <p>
        {parts.map((part, i) => (
          <span
            key={i}
            className={
              [
                i < selected && "sel",
                at >= 0 && i < at && "on",
                i === at && "now",
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            {part}
          </span>
        ))}
      </p>
      {keys && (
        <p className={`g-k ${pressed ? "held" : ""}`}>
          <b>{keys}</b>
          {label}
        </p>
      )}
      <MiniPlayer
        shown={playing || still}
        playing={playing}
        progress={at < 0 ? 0 : at / parts.length}
        speed={speed}
      />
    </div>
  );
};
