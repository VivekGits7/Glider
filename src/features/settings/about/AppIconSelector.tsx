import React from "react";
import { useTranslation } from "react-i18next";
import { platform } from "@tauri-apps/plugin-os";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { useSettings } from "@/common/settings/useSettings";
import type { AppIcon } from "@/bindings";
// The bundled icons themselves, so the picker always shows what the Dock will.
import darkIcon from "../../../../src-tauri/icons/dark/128x128@2x.png";
import lightIcon from "../../../../src-tauri/icons/light/128x128@2x.png";

const OPTIONS: AppIcon[] = ["automatic", "light", "dark"];

interface AppIconSelectorProps {
  grouped?: boolean;
}

/** Picks the Dock (taskbar elsewhere) icon: follow light and dark, or always one. */
export const AppIconSelector: React.FC<AppIconSelectorProps> = React.memo(
  ({ grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting } = useSettings();

    const current: AppIcon = getSetting("app_icon") ?? "automatic";

    return (
      <SettingContainer
        title={t("appIcon.title")}
        description={
          platform() === "macos"
            ? t("appIcon.description")
            : t("appIcon.descriptionTaskbar")
        }
        grouped={grouped}
      >
        <div
          className="flex gap-1.5"
          role="radiogroup"
          aria-label={t("appIcon.title")}
        >
          {OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={current === value}
              onClick={() => updateSetting("app_icon", value)}
              className={`flex w-[84px] cursor-pointer flex-col items-center gap-1 rounded-[10px] border-2 px-1.5 pt-2 pb-1.5 text-[12px] transition-colors ${
                current === value
                  ? "border-logo-primary bg-logo-primary/10 text-text"
                  : "border-transparent text-ink-2 hover:bg-raised/60"
              }`}
            >
              {/* Automatic shows both, the dark one in front. */}
              <span className="relative block h-12 w-16" aria-hidden="true">
                {value !== "dark" && (
                  <img
                    src={lightIcon}
                    alt=""
                    className={`absolute top-0 h-12 w-12 ${value === "automatic" ? "left-0" : "left-2"}`}
                  />
                )}
                {value !== "light" && (
                  <img
                    src={darkIcon}
                    alt=""
                    className={`absolute top-0 h-12 w-12 ${value === "automatic" ? "left-4" : "left-2"}`}
                  />
                )}
              </span>
              {value === "automatic"
                ? t("appIcon.automatic")
                : t(`theme.options.${value}`)}
            </button>
          ))}
        </div>
      </SettingContainer>
    );
  },
);

AppIconSelector.displayName = "AppIconSelector";
