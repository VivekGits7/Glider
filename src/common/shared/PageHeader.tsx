import React from "react";

interface PageHeaderProps {
  title: React.ReactNode;
  /** Beside the title, e.g. a "New" badge. */
  badge?: React.ReactNode;
  /** On the right of the title row. */
  right?: React.ReactNode;
  /** The sentence under the title. */
  lede?: React.ReactNode;
  /** A link back to the page this one belongs to. */
  back?: { label: string; onClick: () => void };
}

/** A page's title, as every main-window page opens (the canvas's
 * .h1 / .titlebar / .lede / .back). */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  badge,
  right,
  lede,
  back,
}) => (
  <>
    {back && (
      <button
        type="button"
        className="g-back cursor-pointer self-start border-0 bg-transparent p-0 hover:text-text"
        onClick={back.onClick}
      >
        <i className="g-ic g-i-back" aria-hidden="true" />
        {back.label}
      </button>
    )}
    {badge || right ? (
      <div className="g-titlebar items-center">
        <div className="flex items-center gap-3">
          <h1 className="g-h1">{title}</h1>
          {badge}
        </div>
        {right}
      </div>
    ) : (
      <h1 className="g-h1">{title}</h1>
    )}
    {lede && <p className="g-lede">{lede}</p>}
  </>
);
