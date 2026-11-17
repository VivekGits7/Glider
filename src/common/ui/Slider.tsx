import React from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "./SettingContainer";
import { ResetButton } from "./ResetButton";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label: string;
  description: string;
  grouped?: boolean;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  onReset?: () => void;
  /** Shows the reset button; pass whether the value differs from its default. */
  showReset?: boolean;
  isResetting?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  disabled = false,
  label,
  description,
  grouped = false,
  showValue = true,
  formatValue = (v) => v.toFixed(2),
  onReset,
  showReset = true,
  isResetting = false,
}) => {
  const { t } = useTranslation();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <SettingContainer
      title={label}
      description={description}
      grouped={grouped}
      layout="horizontal"
      disabled={disabled}
    >
      <div className="flex items-center gap-6">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="g-range cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={
            {
              "--p": `${((value - min) / (max - min)) * 100}%`,
            } as React.CSSProperties
          }
        />
        {showValue && <span className="g-val">{formatValue(value)}</span>}
        {onReset && (
          <ResetButton
            onClick={onReset}
            visible={showReset}
            disabled={disabled || isResetting}
            ariaLabel={t("common.resetSetting", { setting: label })}
          />
        )}
      </div>
    </SettingContainer>
  );
};
