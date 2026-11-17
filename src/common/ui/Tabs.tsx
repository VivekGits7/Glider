import React from "react";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  /** A canvas icon name, e.g. "mic" for g-i-mic. */
  icon?: string;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "md" | "sm";
  className?: string;
}

/** A segmented switch between a page's views (the canvas's .tabs). */
export const Tabs = <T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className = "",
}: TabsProps<T>): React.ReactElement => (
  <div
    role="tablist"
    aria-label={label}
    className={`g-tabs ${size === "sm" ? "sm" : ""} self-start ${className}`}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(option.value)}
          className={`g-tab ${selected ? "on" : ""} cursor-pointer transition-colors duration-150 ${selected ? "" : "hover:text-text"}`}
        >
          {option.icon && (
            <i className={`g-ic g-i-${option.icon}`} aria-hidden="true" />
          )}
          {option.label}
        </button>
      );
    })}
  </div>
);
