import React from "react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "@/common/ui/SettingsGroup";
import { HistoryLimit } from "@/features/history/settings/HistoryLimit";
import { RecordingRetentionPeriodSelector } from "@/features/history/settings/RecordingRetentionPeriod";
import { ExperimentalToggle } from "./ExperimentalToggle";
import { PageHeader } from "@/common/shared/PageHeader";
import { useSettings } from "@/common/settings/useSettings";
import { KeyboardImplementationSelector } from "../debug/KeyboardImplementationSelector";
import { LanguageDetection } from "@/features/stt/settings/LanguageDetection";
import { AccelerationSelector } from "@/features/stt/settings/AccelerationSelector";
import { LazyStreamClose } from "@/features/stt/settings/LazyStreamClose";
import { AirPodsMode } from "@/features/stt/settings/AirPodsMode";
import { VadBackendSelector } from "@/features/stt/settings/VadBackendSelector";

export const AdvancedSettings: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const experimentalEnabled = getSetting("experimental_enabled") || false;

  return (
    <>
      <PageHeader title={t("sidebar.advanced")} />
      <SettingsGroup title={t("settings.advanced.groups.history")}>
        <HistoryLimit grouped={true} />
        <RecordingRetentionPeriodSelector grouped={true} />
      </SettingsGroup>

      <SettingsGroup
        title={t("settings.advanced.groups.experimental")}
        description={t("settings.advanced.groups.experimentalDescription")}
      >
        <ExperimentalToggle grouped={true} />
        {experimentalEnabled && (
          <>
            <KeyboardImplementationSelector grouped={true} />
            <AccelerationSelector grouped={true} />
            <LazyStreamClose grouped={true} />
            <AirPodsMode grouped={true} />
            <VadBackendSelector grouped={true} />
            <LanguageDetection grouped={true} />
          </>
        )}
      </SettingsGroup>
    </>
  );
};
