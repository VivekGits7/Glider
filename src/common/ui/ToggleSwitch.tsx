import React from "react";
import { SettingContainer } from "./SettingContainer";
import { Switch } from "./Switch";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isUpdating?: boolean;
  label: string;
  description: string;
  grouped?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  isUpdating = false,
  label,
  description,
  grouped = false,
}) => {
  return (
    <SettingContainer
      title={label}
      description={description}
      grouped={grouped}
      disabled={disabled}
    >
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled || isUpdating}
        ariaLabel={label}
      />
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-logo-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </SettingContainer>
  );
};
