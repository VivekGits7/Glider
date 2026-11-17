import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "@/common/ui/Dropdown";
import { SettingContainer } from "@/common/ui/SettingContainer";
import {
  SUPPORTED_LANGUAGES,
  getSupportedLanguage,
  type SupportedLanguageCode,
} from "@/i18n";
import { useSettings } from "@/common/settings/useSettings";
import { cjkSubsetFont } from "@/common/lib/cjkFont";

interface AppLanguageSelectorProps {
  grouped?: boolean;
}

export const AppLanguageSelector: React.FC<AppLanguageSelectorProps> =
  React.memo(({ grouped = false }) => {
    const { t, i18n } = useTranslation();
    const { settings, updateSetting } = useSettings();

    const currentLanguage = (getSupportedLanguage(settings?.app_language) ||
      i18n.language) as SupportedLanguageCode;

    const languageOptions = SUPPORTED_LANGUAGES.map((lang) => ({
      value: lang.code,
      label: (
        <>
          <span lang={lang.code} className={cjkSubsetFont(lang.nativeName)}>
            {lang.nativeName}
          </span>{" "}
          ({lang.name})
        </>
      ),
    }));

    const handleLanguageChange = (langCode: string) => {
      i18n.changeLanguage(langCode);
      updateSetting("app_language", langCode);
    };

    return (
      <SettingContainer
        title={t("appLanguage.title")}
        description={t("appLanguage.description")}
        grouped={grouped}
      >
        <Dropdown
          options={languageOptions}
          selectedValue={currentLanguage}
          onSelect={handleLanguageChange}
        />
      </SettingContainer>
    );
  });

AppLanguageSelector.displayName = "AppLanguageSelector";
