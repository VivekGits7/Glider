import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { SettingsGroup } from "@/common/ui/SettingsGroup";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { Button } from "@/common/ui/Button";
import { commands } from "@/bindings";
import { PageHeader } from "@/common/shared/PageHeader";
import { PathRow } from "@/common/shared/PathRow";
import { AppLanguageSelector } from "./AppLanguageSelector";
import { ShowWhatsNewOnUpdate } from "./ShowWhatsNewOnUpdate";
import { ThemeSelector } from "./ThemeSelector";
import { AppIconSelector } from "./AppIconSelector";

const GLIDER_REPO_URL = "https://github.com/VivekGits7/Glider";

const open = (url: string) => () =>
  openUrl(url).catch((error) => console.error(`Failed to open ${url}:`, error));

export const AboutSettings: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("0.1.2");
      }
    };

    fetchVersion();
  }, []);

  const ext = <i className="g-ic g-i-ext size-3.5" aria-hidden="true" />;
  return (
    <>
      <PageHeader title={t("sidebar.about")} />
      <SettingsGroup title={t("settings.about.appTitle")}>
        <AppLanguageSelector grouped={true} />
        <ThemeSelector grouped={true} />
        <AppIconSelector grouped={true} />
        <SettingContainer
          title={t("settings.about.version.title")}
          description={t("settings.about.version.description")}
          grouped={true}
        >
          <span className="text-[14px] tabular-nums text-ink-2">{version}</span>
        </SettingContainer>

        <ShowWhatsNewOnUpdate grouped={true} />

        <SettingContainer
          title={t("settings.about.star.title")}
          description={t("settings.about.star.description")}
          grouped={true}
        >
          <Button variant="primary" size="md" onClick={open(GLIDER_REPO_URL)}>
            <i className="g-ic g-i-star" aria-hidden="true" />
            {t("settings.about.star.button")}
          </Button>
        </SettingContainer>

        <SettingContainer
          title={t("settings.about.sourceCode.title")}
          description={t("settings.about.sourceCode.description")}
          grouped={true}
        >
          <Button variant="secondary" size="md" onClick={open(GLIDER_REPO_URL)}>
            {t("settings.about.sourceCode.button")}
            {ext}
          </Button>
        </SettingContainer>

        <PathRow
          title={t("settings.about.appDataDirectory.title")}
          loadPath={loadAppDir}
          onOpen={() => commands.openAppDataDir()}
        />
      </SettingsGroup>
    </>
  );
};

const loadAppDir = async () => {
  const result = await commands.getAppDirPath();
  return result.status === "ok" ? result.data : null;
};
