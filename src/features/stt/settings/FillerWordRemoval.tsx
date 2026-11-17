import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "@/common/ui/ToggleSwitch";
import { useSettings } from "@/common/settings/useSettings";

interface FillerWordRemovalProps {
  grouped?: boolean;
}

export const FillerWordRemoval: React.FC<FillerWordRemovalProps> = React.memo(
  ({ grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const enabled = getSetting("filler_word_removal_enabled") ?? true;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(nextEnabled) =>
          updateSetting("filler_word_removal_enabled", nextEnabled)
        }
        isUpdating={isUpdating("filler_word_removal_enabled")}
        label={t("settings.advanced.fillerWordRemoval.title")}
        description={t("settings.advanced.fillerWordRemoval.description")}
        grouped={grouped}
      />
    );
  },
);
