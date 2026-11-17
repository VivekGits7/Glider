import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "@/common/ui/ToggleSwitch";
import { useSettings } from "@/common/settings/useSettings";

interface LongFormChunkingProps {
  grouped?: boolean;
}

export const LongFormChunking: React.FC<LongFormChunkingProps> = ({
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const enabled = getSetting("long_form_chunking") ?? true;

  return (
    <ToggleSwitch
      checked={enabled}
      onChange={(enabled) => updateSetting("long_form_chunking", enabled)}
      isUpdating={isUpdating("long_form_chunking")}
      label={t("settings.advanced.longFormChunking.title")}
      description={t("settings.advanced.longFormChunking.description")}
      grouped={grouped}
    />
  );
};
