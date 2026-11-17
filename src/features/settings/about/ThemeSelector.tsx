import React from "react";
import { useTranslation } from "react-i18next";
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

    const handleThemeChange = (value: string) => {
      const theme = value as Theme;
      applyTheme(theme);
      updateSetting("theme", theme);
    };

    return (
      <SettingContainer
        title={t("theme.title")}
        description={t("theme.description")}
        grouped={grouped}
      >
        <div
          className="g-tabs sm"
          role="radiogroup"
          aria-label={t("theme.title")}
        >
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={currentTheme === option.value}
              onClick={() => handleThemeChange(option.value)}
              className={`g-tab ${currentTheme === option.value ? "on" : ""} cursor-pointer`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </SettingContainer>
    );
  },
);

ThemeSelector.displayName = "ThemeSelector";
