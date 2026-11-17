import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { Dropdown } from "@/common/ui/Dropdown";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { ResetButton } from "@/common/ui/ResetButton";
import { useSettings } from "@/common/settings/useSettings";

interface ClamshellMicrophoneSelectorProps {
  grouped?: boolean;
}

export const ClamshellMicrophoneSelector: React.FC<ClamshellMicrophoneSelectorProps> =
  React.memo(({ grouped = false }) => {
    const { t } = useTranslation();
    const {
      getSetting,
      updateSetting,
      resetSetting,
      isUpdating,
      isLoading,
      audioDevices,
      refreshAudioDevices,
      isDefault,
    } = useSettings();

    const [isLaptop, setIsLaptop] = useState<boolean>(false);

    useEffect(() => {
      const checkIsLaptop = async () => {
        try {
          const result = await commands.isLaptop();
          if (result.status === "ok") {
            setIsLaptop(result.data);
          } else {
            setIsLaptop(false);
          }
        } catch (error) {
          console.error("Failed to check if device is laptop:", error);
          setIsLaptop(false);
        }
      };

      checkIsLaptop();
    }, []);

    // Only render on laptops
    if (!isLaptop) {
      return null;
    }

    const selectedClamshellMicrophone =
      getSetting("clamshell_microphone") === "default"
        ? "Default"
        : getSetting("clamshell_microphone") || "Default";

    const handleClamshellMicrophoneSelect = async (deviceName: string) => {
      await updateSetting("clamshell_microphone", deviceName);
    };

    const handleReset = async () => {
      await resetSetting("clamshell_microphone");
    };

    const microphoneOptions = audioDevices.map((device) => ({
      value: device.name,
      label: device.name,
    }));

    return (
      <SettingContainer
        title={t("settings.debug.clamshellMicrophone.title")}
        description={t("settings.debug.clamshellMicrophone.description")}
        grouped={grouped}
      >
        <div className="flex items-center space-x-1">
          <Dropdown
            options={microphoneOptions}
            selectedValue={selectedClamshellMicrophone}
            onSelect={handleClamshellMicrophoneSelect}
            placeholder={
              isLoading || audioDevices.length === 0
                ? t("common.loading")
                : t("settings.sound.microphone.placeholder")
            }
            disabled={
              isUpdating("clamshell_microphone") ||
              isLoading ||
              audioDevices.length === 0
            }
            onOpen={refreshAudioDevices}
          />
          <ResetButton
            visible={!isDefault("clamshell_microphone")}
            ariaLabel={t("common.resetSetting", {
              setting: t("settings.debug.clamshellMicrophone.title"),
            })}
            onClick={handleReset}
            disabled={isUpdating("clamshell_microphone") || isLoading}
          />
        </div>
      </SettingContainer>
    );
  });

ClamshellMicrophoneSelector.displayName = "ClamshellMicrophoneSelector";
