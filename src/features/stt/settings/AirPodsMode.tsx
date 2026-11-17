import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "@/common/ui/ToggleSwitch";
import { useSettings } from "@/common/settings/useSettings";
import { useOsType } from "@/common/hooks/useOsType";

interface AirPodsModeProps {
  grouped?: boolean;
}

export const AirPodsMode: React.FC<AirPodsModeProps> = React.memo(
  ({ grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const osType = useOsType();

    const enabled = getSetting("airpods_mode") ?? false;

    if (osType !== "macos") {
      return null;
    }

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(enabled) => updateSetting("airpods_mode", enabled)}
        isUpdating={isUpdating("airpods_mode")}
        label={t("settings.advanced.airpodsMode.label")}
        description={t("settings.advanced.airpodsMode.description")}
        grouped={grouped}
      />
    );
  },
);
