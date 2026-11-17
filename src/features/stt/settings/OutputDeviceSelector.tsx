import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "@/common/ui/Dropdown";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { ResetButton } from "@/common/ui/ResetButton";
import { useSettings } from "@/common/settings/useSettings";
import type { AudioDevice } from "@/bindings";

interface OutputDeviceSelectorProps {
  grouped?: boolean;
  disabled?: boolean;
}

export const OutputDeviceSelector: React.FC<OutputDeviceSelectorProps> =
  React.memo(({ grouped = false, disabled = false }) => {
    const { t } = useTranslation();
    const {
      getSetting,
      updateSetting,
      resetSetting,
      isUpdating,
      isLoading,
      outputDevices,
      refreshOutputDevices,
      isDefault,
    } = useSettings();

    const selectedOutputDevice =
      getSetting("selected_output_device") === "default"
        ? "Default"
        : getSetting("selected_output_device") || "Default";

    const handleOutputDeviceSelect = async (deviceName: string) => {
      await updateSetting("selected_output_device", deviceName);
    };

    const handleReset = async () => {
      await resetSetting("selected_output_device");
    };

    const outputDeviceOptions = outputDevices.map((device: AudioDevice) => ({
      value: device.name,
      label: device.name,
    }));

    return (
      <SettingContainer
        title={t("settings.sound.outputDevice.title")}
        description={t("settings.sound.outputDevice.description")}
        grouped={grouped}
        disabled={disabled}
      >
        <div className="flex items-center space-x-1">
          <Dropdown
            options={outputDeviceOptions}
            selectedValue={selectedOutputDevice}
            onSelect={handleOutputDeviceSelect}
            placeholder={
              isLoading || outputDevices.length === 0
                ? t("settings.sound.outputDevice.loading")
                : t("settings.sound.outputDevice.placeholder")
            }
            disabled={
              disabled ||
              isUpdating("selected_output_device") ||
              isLoading ||
              outputDevices.length === 0
            }
            onOpen={refreshOutputDevices}
          />
          <ResetButton
            visible={!isDefault("selected_output_device")}
            ariaLabel={t("common.resetSetting", {
              setting: t("settings.sound.outputDevice.title"),
            })}
            onClick={handleReset}
            disabled={
              disabled || isUpdating("selected_output_device") || isLoading
            }
          />
        </div>
      </SettingContainer>
    );
  });
