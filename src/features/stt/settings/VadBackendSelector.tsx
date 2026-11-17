import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { VadBackend } from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";
import { Dropdown, type DropdownOption } from "@/common/ui/Dropdown";
import { SettingContainer } from "@/common/ui/SettingContainer";

interface VadBackendSelectorProps {
  grouped?: boolean;
}

export const VadBackendSelector: React.FC<VadBackendSelectorProps> = ({
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const selectedBackend = getSetting("vad_backend") ?? "silero";

  const options = useMemo<DropdownOption[]>(
    () => [
      {
        value: "silero",
        label: t("settings.advanced.vadBackend.options.silero"),
      },
      {
        value: "earshot",
        label: t("settings.advanced.vadBackend.options.earshot"),
      },
    ],
    [t],
  );

  return (
    <SettingContainer
      title={t("settings.advanced.vadBackend.title")}
      description={t("settings.advanced.vadBackend.description")}
      grouped={grouped}
      layout="horizontal"
    >
      <Dropdown
        options={options}
        selectedValue={selectedBackend}
        onSelect={(value) => updateSetting("vad_backend", value as VadBackend)}
        disabled={isUpdating("vad_backend")}
      />
    </SettingContainer>
  );
};
