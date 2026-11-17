import React from "react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "@/common/ui/SettingsGroup";
import { useSettings } from "@/common/settings/useSettings";
import { PreferredLanguages } from "./PreferredLanguages";
import { ChineseScriptSetting } from "./ChineseScript";
import { StartHidden } from "./StartHidden";
import { AutostartToggle } from "./AutostartToggle";
import { ShowTrayIcon } from "./ShowTrayIcon";
import { ShowOverlay } from "./ShowOverlay";
import { isChinese } from "@/common/lib/languageSuggestions";
import { PageHeader } from "@/common/shared/PageHeader";

/** Settings shared by Dictation, Read Aloud and Rewrite. */
export const GeneralSettings: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  // Only for Chinese speakers, or anyone who already picked a script.
  const speaksChinese =
    (getSetting("spoken_languages") ?? []).some(isChinese) ||
    (getSetting("chinese_script") ?? "as_transcribed") !== "as_transcribed";
  return (
    <>
      <PageHeader title={t("sidebar.general")} />
      <SettingsGroup title={t("settings.languages.title")}>
        <PreferredLanguages grouped={true} />
        {speaksChinese && <ChineseScriptSetting grouped={true} />}
      </SettingsGroup>
      <SettingsGroup title={t("settings.advanced.groups.app")}>
        <StartHidden grouped={true} />
        <AutostartToggle grouped={true} />
        <ShowTrayIcon grouped={true} />
        <ShowOverlay grouped={true} />
      </SettingsGroup>
    </>
  );
};
