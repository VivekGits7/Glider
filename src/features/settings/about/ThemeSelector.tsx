import React from "react";
import { useTranslation } from "react-i18next";
import { Segmented } from "@/common/ui/Segmented";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { useSettings } from "@/common/settings/useSettings";
import { applyTheme, THEME_OPTIONS } from "@/common/lib/theme";
import type { Theme } from "@/bindings";

interface ThemeSelectorProps {
  grouped?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = React.memo(
  ({ grouped = false }) => {
    const { t } = useTranslation();
    const { settings, updateSetting } = useSettings();

    const currentTheme: Theme = settings?.theme ?? "system";

    const themeOptions = THEME_OPTIONS.map((value) => ({
      value,
      label: t(`theme.options.${value}`),
    }));

    const handleThemeChange = (theme: Theme) => {
      applyTheme(theme);
      updateSetting("theme", theme);
    };

    return (
      <SettingContainer
        title={t("theme.title")}
        description={t("theme.description")}
        grouped={grouped}
      >
        <Segmented
          options={themeOptions}
          value={currentTheme}
          onChange={handleThemeChange}
          label={t("theme.title")}
        />
      </SettingContainer>
    );
  },
);

ThemeSelector.displayName = "ThemeSelector";
