import React from "react";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}

/** A setting with a few choices, as a segmented control (the canvas's
 * .tabs.sm): the picked segment raised in a sunk track. */
export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
}: SegmentedProps<T>): React.ReactElement => (
  <div className="g-tabs sm" role="radiogroup" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        disabled={disabled}
        onClick={() => onChange(option.value)}
        className={`g-tab ${value === option.value ? "on" : ""} cursor-pointer disabled:cursor-not-allowed`}
      >
        {option.label}
      </button>
    ))}
  </div>
);
