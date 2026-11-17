import React from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/common/settings/useSettings";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { Switch } from "@/common/ui/Switch";

/** Your words above the overlay pill as you speak: the Live overlay style.
 * Off goes back to the plain pill; off too while the overlay is hidden. */
export const LivePreview: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const style = getSetting("overlay_style") ?? "live";
  return (
    <SettingContainer
      title={t("settings.dictation.livePreview.title")}
      description={t("settings.dictation.livePreview.description")}
      grouped
    >
      <Switch
        checked={style === "live"}
        disabled={style === "none" || isUpdating("overlay_style")}
        onChange={(on) =>
          updateSetting("overlay_style", on ? "live" : "minimal")
        }
        ariaLabel={t("settings.dictation.livePreview.title")}
      />
    </SettingContainer>
  );
};
