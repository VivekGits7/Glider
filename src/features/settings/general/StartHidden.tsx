import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "@/common/ui/ToggleSwitch";
import { useSettings } from "@/common/settings/useSettings";

interface StartHiddenProps {
  grouped?: boolean;
}

export const StartHidden: React.FC<StartHiddenProps> = React.memo(
  ({ grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const startHidden = getSetting("start_hidden") ?? false;

    return (
      <ToggleSwitch
        checked={startHidden}
        onChange={(enabled) => updateSetting("start_hidden", enabled)}
        isUpdating={isUpdating("start_hidden")}
        label={t("settings.advanced.startHidden.label")}
        description={t("settings.advanced.startHidden.description")}
        grouped={grouped}
      />
    );
  },
);
