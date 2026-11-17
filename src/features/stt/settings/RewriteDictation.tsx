import React from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/common/settings/useSettings";
import { Switch } from "@/common/ui/Switch";
import { SettingsGroup } from "@/common/ui/SettingsGroup";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { ShortcutInput } from "@/common/settings/ShortcutInput";

/** After you dictate: rewrite every dictation, or only on a second shortcut.
 * Both use the one dictation prompt (`DICTATION_POLISH_PROMPT` in Rust). */
export const RewriteDictation: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  return (
    <SettingsGroup title={t("rewrite.afterDictate.title")}>
      <SettingContainer
        title={t("rewrite.afterDictate.everyTitle")}
        description={t("rewrite.afterDictate.everyDescription")}
        grouped
      >
        <Switch
          checked={getSetting("rewrite_dictation") ?? false}
          onChange={(on) => updateSetting("rewrite_dictation", on)}
          ariaLabel={t("rewrite.afterDictate.everyTitle")}
        />
      </SettingContainer>
      <ShortcutInput
        shortcutId="transcribe_with_post_process"
        grouped
        title={t("rewrite.afterDictate.shortcutTitle")}
        description={t("rewrite.afterDictate.shortcutDescription")}
      />
    </SettingsGroup>
  );
};
