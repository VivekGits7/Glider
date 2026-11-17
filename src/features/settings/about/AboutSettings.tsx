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

const GLIDER_REPO_URL = "https://github.com/VivekGits7/Glider";
// Glider's dictation is Handy's (MIT); its voices run on sherpa-onnx.
const HANDY_REPO_URL = "https://github.com/cjpais/Handy";
const SHERPA_REPO_URL = "https://github.com/k2-fsa/sherpa-onnx";
// Speech models run on ggml; Rewrite's LLMs on candle.
const GGML_REPO_URL = "https://github.com/ggml-org/ggml";
const CANDLE_REPO_URL = "https://github.com/huggingface/candle";

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
  const credit = (key: string, url: string) => (
    <SettingContainer
      title={t(`settings.about.acknowledgments.${key}.title`)}
      description={t(`settings.about.acknowledgments.${key}.description`)}
      grouped={true}
    >
      <Button variant="secondary" size="md" onClick={open(url)}>
        {t("settings.about.acknowledgments.view")}
        {ext}
      </Button>
    </SettingContainer>
  );

  return (
    <>
      <PageHeader title={t("sidebar.about")} />
      <SettingsGroup title={t("settings.about.appTitle")}>
        <AppLanguageSelector grouped={true} />
        <ThemeSelector grouped={true} />
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

      <SettingsGroup
        title={t("settings.about.acknowledgments.title")}
        description={t("settings.about.acknowledgments.description")}
      >
        {credit("handy", HANDY_REPO_URL)}
        {credit("sherpa", SHERPA_REPO_URL)}
        {credit("ggml", GGML_REPO_URL)}
        {credit("candle", CANDLE_REPO_URL)}
      </SettingsGroup>
    </>
  );
};

const loadAppDir = async () => {
  const result = await commands.getAppDirPath();
  return result.status === "ok" ? result.data : null;
};
