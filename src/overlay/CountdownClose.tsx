import React from "react";
import { XIcon } from "./icons";

/** The key that closes a card, and stops Read Aloud, on a Mac. */
export const ESC_KEY = "Esc";

/** A card's ✕ with a ring that counts down and then closes it. Hovering the
 * card pauses the ring (RecordingOverlay.css). Remount it (a `key`) to start
 * the count again for a new card. */
export const CountdownClose: React.FC<{
  label: string;
  mac: boolean;
  onClose: () => void;
}> = ({ label, mac, onClose }) => (
  <span className="mo-tipwrap">
    <button
      type="button"
      className="mo-close"
      aria-label={label}
      onClick={onClose}
    >
      <svg
        className="mo-ring"
        width="22"
        height="22"
        viewBox="0 0 32 32"
        aria-hidden="true"
        onAnimationEnd={onClose}
      >
        <circle cx="16" cy="16" r="14" />
      </svg>
      <XIcon size={10} />
    </button>
    <span className={`mo-tip ${mac ? "keyed" : ""}`}>
      {label}
      {mac && <kbd>{ESC_KEY}</kbd>}
    </span>
  </span>
);
