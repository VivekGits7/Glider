import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "compact";
}

export const Input: React.FC<InputProps> = ({
  className = "",
  variant = "default",
  disabled,
  ...props
}) => {
  const baseClasses =
    "px-2 py-1 text-sm bg-ground border border-line-strong rounded-[10px] text-start transition-[border-color,background-color] duration-150";

  const interactiveClasses = disabled
    ? "opacity-60 cursor-not-allowed bg-wash border-line"
    : "hover:border-ink-3 focus:outline-none focus:border-logo-primary";

  const variantClasses = {
    default: "h-9 px-3",
    compact: "px-2 py-1",
  } as const;

  return (
    <input
      className={`${baseClasses} ${variantClasses[variant]} ${interactiveClasses} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
};
