import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Monitor, Moon, PanelLeft, Sun } from "lucide-react";
import type { Theme } from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";
import { useOsType } from "@/common/hooks/useOsType";
import { usePressAway } from "@/common/hooks/usePressAway";
import { applyTheme } from "@/common/lib/theme";

const THEMES: { value: Theme; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/** The theme button and its Light / Dark / System menu. */
const ThemeMenu: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const current: Theme = getSetting("theme") ?? "system";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  usePressAway(open, ref, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const pick = (theme: Theme) => {
    setOpen(false);
    applyTheme(theme);
    updateSetting("theme", theme);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("topBar.theme")}
        title={t("topBar.theme")}
        onClick={() => setOpen(!open)}
        className={`grid size-8 cursor-pointer place-items-center rounded-lg text-ink-2 transition-colors hover:bg-wash hover:text-text focus-visible:outline-2 focus-visible:outline-accent-ink ${open ? "bg-wash text-text" : ""}`}
      >
        <Sun className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("topBar.theme")}
          className="absolute end-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-line bg-card p-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.5)]"
        >
          {THEMES.map(({ value, icon: Icon }) => {
            const chosen = current === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={chosen}
                onClick={() => pick(value)}
                className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-start text-[14px] text-text transition-colors ${chosen ? "bg-raised" : "hover:bg-wash"}`}
              >
                <span className="grid w-4 place-items-center">
                  {chosen && (
                    <Check
                      className="size-4"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <Icon
                  className="size-4 text-ink-2"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {t(`theme.options.${value}`)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/** The window's top strip: room for the macOS window buttons, the sidebar
 * toggle, and the theme menu. The rest of it drags the window. */
export const TopBar: React.FC<TopBarProps> = ({
  sidebarOpen,
  onToggleSidebar,
}) => {
  const { t } = useTranslation();
  const osType = useOsType();
  const label = sidebarOpen ? t("topBar.hideSidebar") : t("topBar.showSidebar");
  return (
    <header
      data-tauri-drag-region
      className={`flex h-11 shrink-0 items-center justify-between pe-3 ${osType === "macos" ? "ps-[84px]" : "ps-3"}`}
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={sidebarOpen}
        title={label}
        onClick={onToggleSidebar}
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-2 transition-colors hover:bg-wash hover:text-text focus-visible:outline-2 focus-visible:outline-accent-ink"
      >
        <PanelLeft
          className="size-[18px]"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>
      <ThemeMenu />
    </header>
  );
};
