import React from "react";
import { keycapLabel, keycapLabels, type OSType } from "@/common/lib/keyboard";

interface KeycapsProps {
  /** The binding to draw, e.g. "option+space". */
  binding: string;
  osType: OSType;
  /** sm: standalone; screen: Demo's drawn screen; line: inline in body text;
   * hero: set inside Home's serif shortcut lines. */
  size?: "sm" | "screen" | "line" | "hero";
  /** Draw every key as held down. */
  pressed?: boolean;
  /** The shortcut is working right now: held down, lit in the accent. */
  live?: boolean;
  /** A combination still being captured: dashed, no drop. */
  partial?: boolean;
  /** Raise the keys on hover/focus of a parent `group/keycaps` control. */
  lift?: boolean;
  className?: string;
}

// The canvas keycaps: .kc, .kc.line and .kc.hero (src/styles/glider-ui.css).
const SIZES = {
  sm: "h-[30px] min-w-[30px] px-[9px] mb-[3px] rounded-[7px] text-[14px]",
  screen: "h-[24px] min-w-[24px] px-[7px] rounded-[6px] text-[11px]",
  line: "h-[24px] min-w-[24px] px-[7px] mb-[2px] rounded-[6px] text-[12px]",
  hero: "h-[32px] min-w-[32px] px-[9px] mb-[3px] rounded-[8px] text-[15px]",
};
const DROP = {
  sm: "shadow-[0_3px_0_0_var(--color-plum)]",
  screen: "shadow-[0_3px_0_0_var(--color-plum)]",
  line: "shadow-[0_2px_0_0_var(--color-plum)]",
  hero: "shadow-[0_3px_0_0_var(--color-plum)]",
};

/** A shortcut binding drawn as physical keycaps. */
export const Keycaps: React.FC<KeycapsProps> = ({
  binding,
  osType,
  size = "sm",
  pressed = false,
  live = false,
  partial = false,
  lift = false,
  className = "",
}) => {
  const labels = keycapLabels(binding, osType);
  const state = live
    ? "translate-y-[3px] shadow-none bg-logo-primary bg-[image:var(--color-accent-grad)] text-on-accent border-logo-primary"
    : pressed
      ? "translate-y-[3px] shadow-none bg-plum text-background border-plum"
      : partial
        ? "translate-y-[3px] shadow-none border-dashed bg-background text-plum border-plum"
        : `${DROP[size]} bg-background text-plum border-plum ${
            lift
              ? "group-hover/keycaps:-translate-y-[2px] group-hover/keycaps:shadow-[0_5px_0_0_var(--color-plum)] group-focus-visible/keycaps:-translate-y-[2px] group-focus-visible/keycaps:shadow-[0_5px_0_0_var(--color-plum)]"
              : ""
          }`;

  return (
    <span
      className={`inline-flex items-center gap-[4px] align-middle ${className}`}
      role="img"
      aria-label={keycapLabel(binding, osType)}
    >
      {labels.map((label, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`relative inline-flex items-center justify-center border font-display font-semibold leading-none select-none transition-[transform,box-shadow,background-color,color,border-color] duration-[150ms] ease-out ${SIZES[size]} ${state}`}
        >
          {label}
        </span>
      ))}
    </span>
  );
};
