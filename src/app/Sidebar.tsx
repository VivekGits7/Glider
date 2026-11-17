import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import GliderTextLogo from "@/common/icons/GliderTextLogo";
import GliderMark from "@/common/icons/GliderMark";
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
  /** main: the daily sections; more: pinned to the bottom of the sidebar. */
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
    icon: "audio",
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
  /** Icons only: the narrow rail the top bar's toggle switches to. */
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
  collapsed = false,
}) => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

  const sections = Object.entries(SECTIONS_CONFIG).map(([id, config]) => ({
    id: id as SidebarSection,
    ...config,
  }));

  const renderItem = (section: (typeof sections)[number]) => {
    const isActive = activeSection === section.id;
    const label = t(section.labelKey);
    return (
      <button
        key={section.id}
        type="button"
        aria-current={isActive ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
        onClick={() => onSectionChange(section.id)}
        className={`g-nav relative ${isActive ? "on" : ""} ${collapsed ? "justify-center px-0" : ""} w-full cursor-pointer text-start focus-visible:outline-2 focus-visible:outline-accent-ink`}
      >
        <i className={`g-ic g-i-${section.icon}`} aria-hidden="true" />
        {collapsed ? (
          <span className="g-navtip" aria-hidden="true">
            {label}
          </span>
        ) : (
          <span className="truncate">{label}</span>
        )}
      </button>
    );
  };

  return (
    <nav
      aria-label={t("sidebar.label")}
      className={`g-side relative z-10 shrink-0 pt-1 ${collapsed ? "w-[68px] px-2.5" : "w-[212px]"}`}
      data-tauri-drag-region
    >
      <div
        className={`g-mark mb-[22px] h-auto not-italic ${collapsed ? "justify-center px-0" : ""}`}
        style={{ font: "inherit" }}
        data-tauri-drag-region
      >
        {collapsed ? (
          <GliderMark className="h-[26px] w-auto" />
        ) : (
          <GliderTextLogo height={26} />
        )}
      </div>
      {sections.filter((s) => s.group === "main").map(renderItem)}
      <div className="g-spacer" data-tauri-drag-region />
      <div className="g-rule" />
      {sections.filter((s) => s.group === "more").map(renderItem)}
      {!collapsed && (
        <p className="g-ver m-0">
          {version && t("sidebar.version", { version })}
        </p>
      )}
    </nav>
  );
};
