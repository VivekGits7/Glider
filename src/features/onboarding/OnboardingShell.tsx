import React from "react";
import { useTranslation } from "react-i18next";

interface OnboardingShellProps {
  /** Where this screen is in the flow; no dashes on a standalone screen. */
  progress?: { index: number; count: number };
  /** Top right: Languages' menu language. */
  pill?: React.ReactNode;
  children: React.ReactNode;
  /** The footer's left slot; replaces Back. */
  left?: React.ReactNode;
  onBack?: () => void;
  hint?: React.ReactNode;
  /** Warnings read as warnings, not hints. */
  hintTone?: "quiet" | "warning";
  primary?: React.ReactNode;
  /** Less space under the title, for screens with a list and downloads. */
  tight?: boolean;
}

/** Frame for every onboarding screen (the canvas's .ob): progress dashes,
 * the screen, and a footer with Back, a hint and the next step. */
export const OnboardingShell: React.FC<OnboardingShellProps> = ({
  progress,
  pill,
  children,
  left,
  onBack,
  hint,
  hintTone = "quiet",
  primary,
  tight = false,
}) => {
  const { t } = useTranslation();
  return (
    <div
      data-onboarding=""
      data-tauri-drag-region
      className="flex h-screen w-full cursor-default overflow-hidden bg-background select-none"
    >
      <div className="g-ob shrink-0 text-[15px] leading-[1.6] text-text antialiased">
        <div className="g-obtop" data-tauri-drag-region>
          {progress ? (
            <div
              className="g-dashes"
              role="img"
              aria-label={t("onboarding.shell.progress", {
                step: progress.index + 1,
                count: progress.count,
              })}
            >
              {Array.from({ length: progress.count }, (_, i) => (
                <i
                  key={i}
                  className={
                    i === progress.index
                      ? "on"
                      : i < progress.index
                        ? "done"
                        : ""
                  }
                />
              ))}
            </div>
          ) : (
            <span />
          )}
          {pill}
        </div>
        <div
          className={`g-obbody ${tight ? "tight" : ""} min-h-0 overflow-y-auto`}
        >
          {children}
        </div>
        <div className="g-obfoot">
          {left ??
            (onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="g-btn ghost cursor-pointer"
              >
                <i className="g-ic g-i-back" aria-hidden="true" />
                {t("onboarding.shell.back")}
              </button>
            ) : (
              <span />
            ))}
          <span
            className={`g-obhint min-w-0 text-center ${hintTone === "warning" ? "text-warning" : ""}`}
          >
            {hint}
          </span>
          {primary}
        </div>
      </div>
    </div>
  );
};

/** The footer's Continue (or another label): lilac when it can go on. */
export const NextButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  arrow?: boolean;
}> = ({ onClick, disabled = false, label, arrow = true }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`g-btn ${disabled ? "off cursor-not-allowed" : "pri cursor-pointer"}`}
    >
      {label ?? t("onboarding.shell.continue")}
      {arrow && <i className="g-ic g-i-next" aria-hidden="true" />}
    </button>
  );
};

/** A screen's title and the line under it (the canvas's .obt/.obs). */
export const ObHeader: React.FC<{
  title: React.ReactNode;
  sub?: React.ReactNode;
  above?: React.ReactNode;
}> = ({ title, sub, above }) => (
  <div>
    {above}
    <h1 className="g-obt">{title}</h1>
    {sub && <p className="g-obs">{sub}</p>}
  </div>
);

/** Horizontal alignment; text is always centred. */
const ALIGN = {
  center: "items-center",
  stretch: "items-stretch",
} as const;

/** Gap between header and content, per layout. */
const GAP = {
  center: "min-h-lead max-h-lead-max flex-[1_1_0]",
  top: "h-lead flex-none",
} as const;

/** A screen's main block: header, gap, content. */
export const ScreenMain = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    align?: keyof typeof ALIGN;
    /** Usually a ScreenHeader. */
    header?: React.ReactNode;
    /** "center" centres everything; "top" pins the header and content fills. */
    layout?: keyof typeof GAP;
  }
>(
  (
    {
      children,
      align = "center",
      header,
      layout = "center",
      className = "",
      ...rest
    },
    ref,
  ) => (
    <div
      ref={ref}
      {...rest}
      className={`flex h-full min-h-0 min-w-0 flex-col ${layout === "center" ? "justify-center-safe" : ""} text-center px-gutter ${className}`}
    >
      {header}
      {header && <div aria-hidden="true" className={GAP[layout]} />}
      <div
        className={`flex min-h-0 w-full flex-col ${layout === "top" ? "flex-1" : ""} ${ALIGN[align]}`}
      >
        {children}
      </div>
    </div>
  ),
);
ScreenMain.displayName = "ScreenMain";

/** A screen's title and subtitle; pass as ScreenMain's header. */
export const ScreenHeader: React.FC<{
  title: React.ReactNode;
  sub?: React.ReactNode;
  subClassName?: string;
  /** Note above the title, out of flow so it doesn't push the title down. */
  above?: React.ReactNode;
}> = ({ title, sub, subClassName, above }) => (
  <div className="relative w-full flex-none">
    {above && (
      <div className="absolute inset-x-0 bottom-full mb-[12px]">{above}</div>
    )}
    <ScreenTitle>{title}</ScreenTitle>
    {sub && <ScreenSub className={subClassName}>{sub}</ScreenSub>}
  </div>
);

export const ScreenTitle: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <h1 className={`g-obt ${className}`}>{children}</h1>
);

export const ScreenSub: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <p className={`mt-[4px] mb-0 text-ink-2 text-pretty ${className}`}>
    {children}
  </p>
);
