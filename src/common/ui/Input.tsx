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
    "g-input px-2 py-1 text-[13px] text-start transition-[border-color,background-color,box-shadow] duration-150";

  const interactiveClasses = disabled
    ? "opacity-60 cursor-not-allowed"
    : "focus:outline-none";

  const variantClasses = {
    default: "h-(--g-field-h) px-2.5",
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
