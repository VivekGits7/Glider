import React from "react";
import ResetIcon from "../icons/ResetIcon";

interface ResetButtonProps {
  onClick: () => void;
  /** False hides it: there's nothing to reset to. */
  visible?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}

export const ResetButton: React.FC<ResetButtonProps> = React.memo(
  ({
    onClick,
    visible = true,
    disabled = false,
    className = "",
    ariaLabel,
    children,
  }) =>
    visible ? (
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`g-ib cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        onClick={onClick}
        disabled={disabled}
      >
        {children ?? <ResetIcon />}
      </button>
    ) : null,
);
