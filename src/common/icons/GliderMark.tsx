import { useId } from "react";

/** The mic's centerlines on the 1024 app-icon grid, as in src-tauri/icons/{dark,light}/logo.svg. */
export const MIC_CAPSULE = "M423 368a89 89 0 0 1 178 0v128a89 89 0 0 1-178 0z";
export const MIC_CRADLE = "M350 491a162 162 0 0 0 324 0";
export const MIC_STEM = "M512 653v60";

/** The Glider mic in the app icon's violet, deeper on light grounds. Sized by `className`. */
const GliderMark = ({ className = "" }: { className?: string }) => {
  // Gradient ids must be unique per page; useId's colons break url(#...) in WebKit.
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    // A bolder line than the 1024px icon so it holds up at sidebar size.
    <svg
      viewBox="330 259 364 474"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke={`url(#${id})`}
      strokeWidth={40}
      strokeLinecap="round"
    >
      <defs>
        <linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1="400"
          y1="259"
          x2="624"
          y2="725"
        >
          <stop offset="0" style={{ stopColor: "var(--color-mark-from)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-mark-to)" }} />
        </linearGradient>
      </defs>
      {/* pathLength 1 lets the loading screen draw each stroke with a 0–1 dash. */}
      <path d={MIC_CAPSULE} pathLength={1} />
      <path d={MIC_CRADLE} pathLength={1} />
      <path d={MIC_STEM} pathLength={1} />
    </svg>
  );
};

export default GliderMark;
