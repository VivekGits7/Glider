import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "primary-soft"
    | "secondary"
    | "outline"
    | "warning"
    | "danger"
    | "danger-ghost"
    | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}) => {
  const baseClasses =
    "g-btn transition-[background-color,border-color,color,filter] duration-150 disabled:cursor-not-allowed";

  // The canvas's .btn.pri / .sec / .ghost / .danger; the rest are app-only.
  const variantClasses = {
    primary: "pri hover:brightness-105 disabled:opacity-50",
    "primary-soft":
      "text-text bg-logo-primary/15 border-transparent hover:bg-logo-primary/25",
    secondary: "sec disabled:opacity-50",
    // For screens where secondary's grey fill reads as disabled (onboarding)
    outline:
      "text-text bg-background border-line-strong hover:border-plum focus-visible:ring-1 focus-visible:ring-logo-primary",
    // Secondary's neutral resting look, but hover/focus use the semantic
    // --color-warning token (theme.css) instead of the pink accent — for
    // buttons sitting on warning surfaces like SecureInputWarning
    warning:
      "text-text bg-wash border-line hover:bg-warning-wash hover:border-warning focus:ring-1 focus:ring-warning",
    danger:
      "text-background bg-error border-error hover:bg-error/80 hover:border-error/80 focus:ring-1 focus:ring-error",
    "danger-ghost": "danger disabled:opacity-50",
    ghost: "ghost disabled:opacity-50",
  };

  const sizeClasses = {
    sm: "sm",
    md: "",
    lg: "lg",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
