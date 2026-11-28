import React from "react";

interface PageHeaderProps {
  title: React.ReactNode;
  /** Beside the title, e.g. a "New" badge. */
  badge?: React.ReactNode;
  /** On the right of the title bar: the page's one or two actions. */
  right?: React.ReactNode;
  /** The sentence under the title bar. */
  lede?: React.ReactNode;
  /** A link back to the page this one belongs to. */
  back?: { label: string; onClick: () => void };
}

/** A page's title bar: the title (15px on macOS, 18px elsewhere) on the left,
 * its actions on the right. It stays at the top while the page scrolls, and
 * drags the window on macOS, where there is no title bar. */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  badge,
  right,
  lede,
  back,
}) => (
  <>
    <header className="g-pagehead" data-tauri-drag-region>
      <div className="flex min-w-0 items-center gap-2" data-tauri-drag-region>
        {back && (
          <button
            type="button"
            className="g-back"
            onClick={back.onClick}
            aria-label={back.label}
            title={back.label}
          >
            <i className="g-ic g-i-back" aria-hidden="true" />
          </button>
        )}
        <h1 className="g-h1 truncate" data-tauri-drag-region>
          {title}
        </h1>
        {badge}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
    {lede && <p className="g-lede">{lede}</p>}
  </>
);
