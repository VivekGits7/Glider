import React from "react";
import { useTranslation } from "react-i18next";
import { Segmented } from "@/common/ui/Segmented";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { useSettings } from "@/common/settings/useSettings";
import type { OverlayPosition, OverlayStyle } from "@/bindings";

interface ShowOverlayProps {
  grouped?: boolean;
}

export const ShowOverlay: React.FC<ShowOverlayProps> = React.memo(
  ({ grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const styleOptions: { value: OverlayStyle; label: string }[] = [
      {
        value: "none",
        label: t("settings.advanced.overlay.style.options.none"),
      },
      {
        value: "minimal",
        label: t("settings.advanced.overlay.style.options.minimal"),
      },
      {
        value: "live",
        label: t("settings.advanced.overlay.style.options.live"),
      },
    ];

    const positionOptions: { value: OverlayPosition; label: string }[] = [
      {
        value: "bottom",
        label: t("settings.advanced.overlay.position.options.bottom"),
      },
      {
        value: "top",
        label: t("settings.advanced.overlay.position.options.top"),
      },
    ];

    const selectedStyle = (getSetting("overlay_style") ||
      "minimal") as OverlayStyle;
    // Only "top" and "bottom" are selectable; anything else (empty, or a legacy
    // "none" from before the position was retired) falls back to "bottom".
    const selectedPosition: OverlayPosition =
      getSetting("overlay_position") === "top" ? "top" : "bottom";

    return (
      <>
        <SettingContainer
          title={t("settings.advanced.overlay.style.title")}
          description={t("settings.advanced.overlay.style.description")}
          grouped={grouped}
        >
          <Segmented
            options={styleOptions}
            value={selectedStyle}
            onChange={(value) => updateSetting("overlay_style", value)}
            label={t("settings.advanced.overlay.style.title")}
            disabled={isUpdating("overlay_style")}
          />
        </SettingContainer>

        {selectedStyle !== "none" && (
          <SettingContainer
            title={t("settings.advanced.overlay.position.title")}
            description={t("settings.advanced.overlay.position.description")}
            grouped={grouped}
          >
            <Segmented
              options={positionOptions}
              value={selectedPosition}
              onChange={(value) => updateSetting("overlay_position", value)}
              label={t("settings.advanced.overlay.position.title")}
              disabled={isUpdating("overlay_position")}
            />
          </SettingContainer>
        )}
      </>
    );
  },
);
