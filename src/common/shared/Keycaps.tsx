import React from "react";
import { keycapLabel, keycapLabels, type OSType } from "@/common/lib/keyboard";

interface KeycapsProps {
  /** The binding to draw, e.g. "option+space". */
  binding: string;
  osType: OSType;
  /** sm: in a row or a sentence; screen: a demo's drawn screen; line: inline
   * in small text; hero: the big sentence on a feature's intro card. */
  size?: "sm" | "screen" | "line" | "hero";
  /** Draw every key as held down. */
  pressed?: boolean;
  /** The shortcut is working right now: lit in the accent. */
  live?: boolean;
  /** A combination still being captured: dashed. */
  partial?: boolean;
  className?: string;
}

// The keys' looks live in glider-ui.css (.g-kc, .line, .hero).
const SIZES = { sm: "", screen: "line", line: "line", hero: "hero" };

/** A shortcut binding drawn as keys. */
export const Keycaps: React.FC<KeycapsProps> = ({
  binding,
  osType,
  size = "sm",
  pressed = false,
  live = false,
  partial = false,
  className = "",
}) => {
  const labels = keycapLabels(binding, osType);
  const state = live ? "live" : pressed ? "down" : partial ? "cap" : "";
  return (
    <span
      className={`g-keys ${className}`}
      role="img"
      aria-label={keycapLabel(binding, osType)}
    >
      {labels.map((label, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`g-kc ${SIZES[size]} ${state} select-none`}
        >
          {label}
        </span>
      ))}
    </span>
  );
};
