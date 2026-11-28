import React from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "compact";
}

export const Textarea: React.FC<TextareaProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  const baseClasses =
    "g-input px-2 py-1 text-[13px] leading-relaxed text-start transition-[border-color,box-shadow] duration-150 focus:outline-none resize-y";

  const variantClasses = {
    default: "px-2.5 py-2 min-h-[96px]",
    compact: "px-2 py-1 min-h-[80px]",
  };

  return (
    <textarea
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};
