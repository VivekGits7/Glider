import React from "react";

interface SettingContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
  grouped?: boolean;
  layout?: "horizontal" | "stacked";
  disabled?: boolean;
  /** Horizontal only: the control takes the row's free width, for content that fits itself to it. */
  grow?: boolean;
}

/** One setting: title with its description under it on the left, its control
 * on the right (the canvas's .row). Inside a SettingsGroup card when `grouped`. */
export const SettingContainer: React.FC<SettingContainerProps> = ({
  title,
  description,
  children,
  grouped = false,
  layout = "horizontal",
  disabled = false,
  grow = false,
}) => {
  const dim = disabled ? "opacity-50" : "";
  const heading = (
    <>
      <h3 className={`g-rt m-0 ${dim}`}>{title}</h3>
      {description && <p className={`g-rd m-0 mt-0.5 ${dim}`}>{description}</p>}
    </>
  );

  const row =
    layout === "stacked" ? (
      <div className="g-row stack">
        <div>{heading}</div>
        <div className="w-full">{children}</div>
      </div>
    ) : (
      <div className="g-row">
        <div className={`g-rl ${grow ? "shrink-0" : ""}`}>{heading}</div>
        <div
          className={`g-rr relative ${grow ? "min-w-0 flex-1 justify-end" : ""}`}
        >
          {children}
        </div>
      </div>
    );

  return grouped ? row : <div className="g-card">{row}</div>;
};
