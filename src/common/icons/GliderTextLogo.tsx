import GliderMark from "./GliderMark";

// Brand name, not translated.
const WORDMARK = "Glider";

/** The wing mark beside the "Glider" wordmark. `height` is the wordmark's font size in px. */
const GliderTextLogo = ({
  height = 32,
  className = "",
}: {
  height?: number;
  className?: string;
}) => (
  <span
    role="img"
    aria-label={WORDMARK}
    className={`inline-flex items-center gap-[0.3em] font-ui leading-none font-medium tracking-[-0.02em] text-text ${className}`}
    style={{ fontSize: height }}
  >
    <GliderMark className="h-[1.2em] w-auto shrink-0" />
    {WORDMARK}
  </span>
);

export default GliderTextLogo;
