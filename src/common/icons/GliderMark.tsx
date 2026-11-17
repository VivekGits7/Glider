import { useId } from "react";

/** The two wing blades, shared by the logo, the tray icon and src-tauri/icons/logo.svg. */
export const WING_TOP =
  "M160 493 C168 410 215 320 290 262 C355 212 440 186 515 175 C506 222 480 262 440 290 C400 316 340 322 300 334 C255 348 220 380 198 425 C185 450 172 472 160 493 Z";
export const WING_LOW =
  "M195 476 C205 440 225 405 258 382 C300 354 360 342 465 328 C462 375 440 418 395 440 C330 470 260 472 195 476 Z";

/** The Glider wing mark in its pink-to-violet colours. Sized by `className`. */
const GliderMark = ({ className = "" }: { className?: string }) => {
  // Gradient ids must be unique per page; useId's colons break url(#...) in WebKit.
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox="155 170 365 328" className={className} aria-hidden="true">
      <defs>
        <linearGradient
          id={`${id}t`}
          gradientUnits="userSpaceOnUse"
          x1="500"
          y1="180"
          x2="170"
          y2="480"
        >
          <stop offset="0" stopColor="#f1c3f0" />
          <stop offset="0.4" stopColor="#e4a6e9" />
          <stop offset="0.8" stopColor="#cd78de" />
          <stop offset="1" stopColor="#bd5fd6" />
        </linearGradient>
        <linearGradient
          id={`${id}l`}
          gradientUnits="userSpaceOnUse"
          x1="460"
          y1="340"
          x2="200"
          y2="470"
        >
          <stop offset="0" stopColor="#b384f6" />
          <stop offset="0.45" stopColor="#b56ff0" />
          <stop offset="1" stopColor="#cf72e2" />
        </linearGradient>
      </defs>
      {/* pathLength 1 lets the loading screen draw the outline with a 0–1 dash. */}
      <path fill={`url(#${id}l)`} d={WING_LOW} pathLength={1} />
      <path fill={`url(#${id}t)`} d={WING_TOP} pathLength={1} />
    </svg>
  );
};

export default GliderMark;
