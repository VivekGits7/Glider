import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "@/common/ui/ToggleSwitch";
import { useSettings } from "@/common/settings/useSettings";

interface UpdateChecksToggleProps {
  grouped?: boolean;
}

export const UpdateChecksToggle: React.FC<UpdateChecksToggleProps> = ({
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating, updateChecksLocked } =
    useSettings();
  const updateChecksEnabled = getSetting("update_checks_enabled") ?? true;

  return (
    <ToggleSwitch
      checked={updateChecksLocked ? false : updateChecksEnabled}
      onChange={(enabled) => updateSetting("update_checks_enabled", enabled)}
      isUpdating={isUpdating("update_checks_enabled")}
      disabled={updateChecksLocked !== false}
      label={t("settings.debug.updateChecks.label")}
      description={
        updateChecksLocked
          ? t("settings.debug.updateChecks.lockedDescription")
          : t("settings.debug.updateChecks.description")
      }
      grouped={grouped}
    />
  );
};
