import React from "react";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Names the switch for assistive tech when no visible label points at it. */
  ariaLabel?: string;
  /** The id of a visible label that names the switch. */
  ariaLabelledBy?: string;
}

/** The on/off switch on its own; ToggleSwitch puts it in a settings row. */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  ariaLabelledBy,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledBy}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`g-sw ${checked ? "on" : ""} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink disabled:cursor-not-allowed disabled:opacity-50`}
  />
);
