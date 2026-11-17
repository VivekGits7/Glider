import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Beside the heading, on the right. */
  action?: React.ReactNode;
}

/** A card of setting rows, with an optional heading above it. */
export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
  action,
}) => (
  <section className="g-group">
    {title && (
      <div className="flex items-end justify-between gap-4">
        <div className="g-ghead">
          <h2 className="g-gt">{title}</h2>
          {description && <p className="g-gd">{description}</p>}
        </div>
        {action}
      </div>
    )}
    <div className="g-card">{children}</div>
  </section>
);
