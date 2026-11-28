import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import GliderMark from "@/common/icons/GliderMark";
import { useOsType } from "@/common/hooks/useOsType";
import { GeneralSettings } from "@/features/settings/general/GeneralSettings";
import { AdvancedSettings } from "@/features/settings/advanced/AdvancedSettings";
import { AboutSettings } from "@/features/settings/about/AboutSettings";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface SectionConfig {
  labelKey: string;
  /** A canvas icon (g-i-<icon>). */
  icon: string;
  /** `null` when App renders the section itself (it needs App's handlers). */
  component: React.ComponentType | null;
  /** main: the daily sections; more: below the divider. */
  group: "main" | "more";
}

export const SECTIONS_CONFIG = {
  home: {
    labelKey: "sidebar.home",
    icon: "home",
    component: null,
    group: "main",
  },
  insights: {
    labelKey: "sidebar.insights",
    icon: "chart",
    component: null,
    group: "main",
  },
  general: {
    labelKey: "sidebar.general",
    icon: "sliders",
    component: GeneralSettings,
    group: "main",
  },
  dictation: {
    labelKey: "sidebar.dictation",
    icon: "mic",
    component: null,
    group: "main",
  },
  readAloud: {
    labelKey: "sidebar.readAloud",
    icon: "speaker",
    component: null,
    group: "main",
  },
  rewrite: {
    labelKey: "sidebar.rewrite",
    icon: "sparkles",
    component: null,
    group: "main",
  },
  history: {
    labelKey: "sidebar.history",
    icon: "history",
    component: null,
    group: "main",
  },
  models: {
    labelKey: "sidebar.models",
    icon: "cpu",
    component: null,
    group: "main",
  },
  advanced: {
    labelKey: "sidebar.advanced",
    icon: "cog",
    component: AdvancedSettings,
    group: "more",
  },
  debug: {
    labelKey: "sidebar.debug",
    icon: "flask",
    component: null,
    group: "more",
  },
  about: {
    labelKey: "sidebar.about",
    icon: "info",
    component: AboutSettings,
    group: "more",
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
  /** macOS only: icons only, the rail the hide button folds it to. */
  collapsed?: boolean;
  onToggle: () => void;
}

/** The section list. On macOS it sits under the window buttons, with a
 * button that folds it to an icon rail; elsewhere the native title bar sits
 * above it. Search narrows the list as you type; Enter opens the first match. */
export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
  collapsed = false,
  onToggle,
}) => {
  const { t } = useTranslation();
  const isMac = useOsType() === "macos";
  const [version, setVersion] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

  const needle = collapsed ? "" : query.trim().toLocaleLowerCase();
  const sections = Object.entries(SECTIONS_CONFIG)
    .map(([id, config]) => ({
      id: id as SidebarSection,
      label: t(config.labelKey),
      ...config,
    }))
    .filter((s) => s.label.toLocaleLowerCase().includes(needle));
  const main = sections.filter((s) => s.group === "main");
  const more = sections.filter((s) => s.group === "more");

  const renderItem = (section: (typeof sections)[number]) => {
    const isActive = activeSection === section.id;
    return (
      <button
        key={section.id}
        type="button"
        aria-current={isActive ? "page" : undefined}
        aria-label={collapsed ? section.label : undefined}
        onClick={() => onSectionChange(section.id)}
        className={`g-nav ${isActive ? "on" : ""} ${collapsed ? "justify-center px-0" : ""} w-full shrink-0 cursor-pointer text-start focus-visible:outline-2 focus-visible:outline-accent-ink`}
      >
        <i className={`g-ic g-i-${section.icon}`} aria-hidden="true" />
        {collapsed ? (
          <span className="g-navtip" aria-hidden="true">
            {section.label}
          </span>
        ) : (
          <span className="truncate">{section.label}</span>
        )}
      </button>
    );
  };

  const toggleLabel = collapsed ? t("sidebar.show") : t("sidebar.hide");

  return (
    <nav
      aria-label={t("sidebar.label")}
      className={`g-side relative z-10 shrink-0 ${collapsed ? "w-[92px]" : "w-[264px]"}`}
      data-tauri-drag-region
    >
      {isMac && (
        <div
          className={`g-sidetop ${collapsed ? "mt-10 justify-center px-0" : ""}`}
          data-tauri-drag-region
        >
          <button
            type="button"
            className="g-sidebtn"
            aria-label={toggleLabel}
            aria-pressed={!collapsed}
            title={toggleLabel}
            onClick={onToggle}
          >
            <i className="g-ic g-i-sidebar" aria-hidden="true" />
          </button>
        </div>
      )}
      {!collapsed && (
        <label className="g-search">
          <i className="g-ic g-i-search" aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={t("sidebar.search")}
            aria-label={t("sidebar.search")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && sections[0]) {
                onSectionChange(sections[0].id);
                setQuery("");
              } else if (e.key === "Escape") {
                setQuery("");
              }
            }}
          />
        </label>
      )}
      {/* The collapsed rail never scrolls: its labels pop out past its edge,
          which a scroll box would clip and turn into scrollbars. */}
      <div
        className={`flex min-h-0 flex-col gap-0.5 ${collapsed ? "" : "overflow-y-auto"}`}
      >
        {main.map(renderItem)}
        {main.length > 0 && more.length > 0 && <div className="g-rule" />}
        {more.map(renderItem)}
      </div>
      <div className="g-spacer" data-tauri-drag-region />
      {!collapsed && (
        <p className="g-sidefoot m-0">
          <GliderMark className="h-4 w-auto" />
          <b>{t("sidebar.appName")}</b>
          {version && <span>{t("sidebar.version", { version })}</span>}
        </p>
      )}
    </nav>
  );
};
