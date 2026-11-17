import React from "react";
import { useTranslation } from "react-i18next";
import { Slider } from "@/common/ui/Slider";
import { useSettings } from "@/common/settings/useSettings";

interface LanguageDetectionWindowProps {
  grouped?: boolean;
}

export const LanguageDetectionWindow: React.FC<
  LanguageDetectionWindowProps
> = ({ grouped = false }) => {
  const { t } = useTranslation();
  const { settings, updateSetting, resetSetting, isUpdating, isDefault } =
    useSettings();

  return (
    <Slider
      value={settings?.language_detection_window_secs ?? 5}
      onChange={(value) =>
        updateSetting("language_detection_window_secs", value)
      }
      onReset={() => resetSetting("language_detection_window_secs")}
      showReset={!isDefault("language_detection_window_secs")}
      isResetting={isUpdating("language_detection_window_secs")}
      min={2}
      max={30}
      step={1}
      label={t("settings.debug.languageDetectionWindow.title")}
      description={t("settings.debug.languageDetectionWindow.description")}
      grouped={grouped}
      formatValue={(v) => `${v} s`}
    />
  );
};
