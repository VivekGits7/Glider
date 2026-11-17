import React from "react";

type ModelStatus =
  | "ready"
  | "loading"
  | "downloading"
  | "verifying"
  | "error"
  | "unloaded"
  | "none";

interface ModelStatusButtonProps {
  status: ModelStatus;
  displayText: string;
  isDropdownOpen: boolean;
  /** Ready, and transcribing in the background. */
  busy?: boolean;
  onClick: () => void;
  className?: string;
}

const ModelStatusButton: React.FC<ModelStatusButtonProps> = ({
  status,
  displayText,
  isDropdownOpen,
  busy = false,
  onClick,
  className = "",
}) => {
  // The mic matches the other footer icons when ready; colour flags trouble.
  const getStatusColor = (status: ModelStatus): string => {
    switch (status) {
      case "ready":
        return busy ? "animate-pulse motion-reduce:animate-none" : "";
      case "loading":
        return "text-warning animate-pulse";
      case "downloading":
        return "text-logo-primary animate-pulse";
      case "verifying":
        return "animate-pulse";
      case "error":
      case "none":
        return "text-error";
      default:
        return "text-ink-3";
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isDropdownOpen}
      className={`g-fbtn cursor-pointer transition-colors ${className}`}
      title={displayText}
    >
      <i
        className={`g-ic g-i-mic ${getStatusColor(status)}`}
        aria-hidden="true"
      />
      <span className="max-w-32 truncate">{displayText}</span>
      <i
        className={`g-ic cv g-i-chev transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
};

export default ModelStatusButton;
