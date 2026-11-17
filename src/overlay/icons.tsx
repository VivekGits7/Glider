import React from "react";

/** The overlay's icons, drawn as in canvas/Overlay Minimal. */
const Stroke: React.FC<{
  size: number;
  width?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ size, width = 2, children, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={style}
  >
    {children}
  </svg>
);

export const XIcon: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <Stroke size={size} width={2.4}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Stroke>
);

export const CheckIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 12,
  color,
}) => (
  <Stroke size={size} width={2.6} style={color ? { color } : undefined}>
    <path d="M20 6 9 17l-5-5" />
  </Stroke>
);

export const PrevIcon: React.FC = () => (
  <Stroke size={12}>
    <path d="M19 20 9 12l10-8z" fill="currentColor" />
    <path d="M5 19V5" />
  </Stroke>
);

export const NextIcon: React.FC = () => (
  <Stroke size={12}>
    <path d="m5 4 10 8-10 8z" fill="currentColor" />
    <path d="M19 5v14" />
  </Stroke>
);

export const PauseIcon: React.FC = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const PlayIcon: React.FC = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ marginLeft: 2 }}
  >
    <path d="M6 3l14 9-14 9z" />
  </svg>
);

export const MinusIcon: React.FC = () => (
  <Stroke size={11} width={2.2}>
    <path d="M5 12h14" />
  </Stroke>
);

export const PlusIcon: React.FC = () => (
  <Stroke size={11} width={2.2}>
    <path d="M5 12h14M12 5v14" />
  </Stroke>
);

export const CopyIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <Stroke size={size} width={1.9}>
    <rect width="14" height="14" x="8" y="8" rx="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Stroke>
);

export const AgainIcon: React.FC = () => (
  <Stroke size={12} width={1.9}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Stroke>
);

export const BarsIcon: React.FC = () => (
  <Stroke size={13} style={{ color: "var(--mo-pink-ink)" }}>
    <path d="M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3" />
  </Stroke>
);

/** Eight ticks, the brightest leading as it turns. */
export const Spinner: React.FC = () => (
  <svg
    className="mo-spin"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 3v4" opacity="1" />
      <path d="M5.64 5.64l2.83 2.83" opacity=".85" />
      <path d="M3 12h4" opacity=".7" />
      <path d="M5.64 18.36l2.83-2.83" opacity=".56" />
      <path d="M12 21v-4" opacity=".44" />
      <path d="M18.36 18.36l-2.83-2.83" opacity=".34" />
      <path d="M21 12h-4" opacity=".26" />
      <path d="M18.36 5.64l-2.83 2.83" opacity=".18" />
    </g>
  </svg>
);
