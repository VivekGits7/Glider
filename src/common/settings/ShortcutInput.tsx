import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatKeyCombination } from "../lib/keyboard";
import { Keycaps } from "../shared/Keycaps";
import { ResetButton } from "../ui/ResetButton";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "./useSettings";
import { useOsType } from "../hooks/useOsType";
import { useShortcutCapture } from "../hooks/useShortcutCapture";
import { usePressAway } from "../hooks/usePressAway";

interface ShortcutInputProps {
  grouped?: boolean;
  shortcutId: string;
  disabled?: boolean;
  /** A control shown before the keys, such as the prompt a Refine shortcut uses. */
  extra?: React.ReactNode;
  /** Names the row differently from the binding's own name. */
  title?: string;
  description?: string;
}

/**
 * A binding's shortcut; click to record a new one. Clicking elsewhere cancels;
 * Escape is recorded like any key (Cancel's default is Escape).
 */
export const ShortcutInput: React.FC<ShortcutInputProps> = ({
  grouped = false,
  shortcutId,
  disabled = false,
  extra,
  title,
  description,
}) => {
  const { t } = useTranslation();
  const { getSetting, resetBinding, isUpdating, isLoading } = useSettings();
  const osType = useOsType();
  const { capturing, partial, start, cancel } = useShortcutCapture(
    shortcutId,
    osType,
  );
  const shortcutRef = useRef<HTMLDivElement | null>(null);

  const bindings = getSetting("bindings") || {};

  usePressAway(capturing, shortcutRef, cancel);

  // If still loading, show loading state
  if (isLoading) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.description")}
        grouped={grouped}
      >
        <div className="text-sm text-ink-3">
          {t("settings.general.shortcut.loading")}
        </div>
      </SettingContainer>
    );
  }

  // If no bindings are loaded, show empty state
  if (Object.keys(bindings).length === 0) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.description")}
        grouped={grouped}
      >
        <div className="text-sm text-ink-3">
          {t("settings.general.shortcut.none")}
        </div>
      </SettingContainer>
    );
  }

  const binding = bindings[shortcutId];
  if (!binding) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.notFound")}
        grouped={grouped}
      >
        <div className="text-sm text-ink-3">
          {t("settings.general.shortcut.none")}
        </div>
      </SettingContainer>
    );
  }

  // Get translated name and description for the binding
  const translatedName =
    title ??
    t(`settings.general.shortcut.bindings.${shortcutId}.name`, binding.name);
  const translatedDescription =
    description ??
    t(
      `settings.general.shortcut.bindings.${shortcutId}.description`,
      binding.description,
    );

  return (
    <SettingContainer
      title={translatedName}
      description={translatedDescription}
      grouped={grouped}
      disabled={disabled}
      layout="horizontal"
    >
      <div className="flex items-center gap-1.5">
        {extra}
        {capturing ? (
          <div
            ref={shortcutRef}
            className="flex h-9 items-center rounded-[10px] border border-dashed border-accent-ink px-3 text-[13px] text-ink-2"
          >
            {partial ? (
              <Keycaps binding={partial} osType={osType} size="sm" partial />
            ) : (
              t("settings.general.shortcut.pressKeys")
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label={t("settings.general.shortcut.changeLabel", {
              name: translatedName,
              keys: formatKeyCombination(binding.current_binding, osType),
            })}
            className="g-shortcut group/keycaps cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-ink"
          >
            <Keycaps
              binding={binding.current_binding}
              osType={osType}
              size="sm"
              lift
            />
          </button>
        )}
        {/* Only a changed shortcut has something to go back to. */}
        {binding.current_binding !== binding.default_binding && (
          <ResetButton
            ariaLabel={t("common.resetSetting", { setting: translatedName })}
            onClick={() => resetBinding(shortcutId)}
            disabled={isUpdating(`binding_${shortcutId}`)}
          />
        )}
      </div>
    </SettingContainer>
  );
};
