import React from "react";
import { useTranslation } from "react-i18next";
import { WordCorrectionThreshold } from "./WordCorrectionThreshold";
import { LogLevelSelector } from "./LogLevelSelector";
import { LiveLogViewer } from "./LiveLogViewer";
import { PasteDelay } from "./PasteDelay";
import { HoldThreshold } from "./HoldThreshold";
import { ReliablePasteToggle } from "./ReliablePaste";
import { RecordingBuffer } from "./RecordingBuffer";
import { LanguageDetectionWindow } from "./LanguageDetectionWindow";
import { SettingsGroup } from "@/common/ui/SettingsGroup";
import { AlwaysOnMicrophone } from "@/features/stt/settings/AlwaysOnMicrophone";
import { SoundPicker } from "@/features/stt/settings/SoundPicker";
import { ClamshellMicrophoneSelector } from "@/features/stt/settings/ClamshellMicrophoneSelector";
import { UpdateChecksToggle } from "../about/UpdateChecksToggle";
import { WhatsNewPreview } from "./WhatsNewPreview";
import { KeyboardDiagnostic } from "./KeyboardDiagnostic";
import { DebugRun, OnboardingPreview } from "./OnboardingPreview";
import type { OnboardingStep } from "@/features/onboarding/onboardingStore";
import { commands } from "@/bindings";
import { PageHeader } from "@/common/shared/PageHeader";
import { PathRow } from "@/common/shared/PathRow";

interface DebugSettingsProps {
  onPreviewOnboarding: (step: OnboardingStep) => void;
  onRunOnboarding: () => void;
  onRunModelMigration: () => void;
}

export const DebugSettings: React.FC<DebugSettingsProps> = ({
  onPreviewOnboarding,
  onRunOnboarding,
  onRunModelMigration,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t("sidebar.debug")} lede={t("settings.debug.lede")} />
      <SettingsGroup title={t("settings.debug.groups.logs")}>
        <LogLevelSelector grouped={true} />
        <PathRow
          title={t("settings.debug.logDirectory.title")}
          loadPath={loadLogDir}
          onOpen={() => commands.openLogDir()}
        />
        <LiveLogViewer grouped={true} />
      </SettingsGroup>

      <SettingsGroup
        title={t("settings.debug.groups.previews")}
        description={t("settings.debug.groups.previewsDescription")}
      >
        <WhatsNewPreview grouped={true} />
        <OnboardingPreview onPreview={onPreviewOnboarding} grouped={true} />
        <DebugRun run="onboardingRun" onRun={onRunOnboarding} grouped={true} />
        <DebugRun
          run="modelMigration"
          onRun={onRunModelMigration}
          grouped={true}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.debug.groups.timing")}>
        <SoundPicker
          label={t("settings.debug.soundTheme.label")}
          description={t("settings.debug.soundTheme.description")}
        />
        <WordCorrectionThreshold grouped={true} />
        <PasteDelay grouped={true} />
        <PasteDelay
          grouped={true}
          settingKey="paste_delay_after_ms"
          labelKey="settings.debug.pasteDelayAfter.title"
          descriptionKey="settings.debug.pasteDelayAfter.description"
        />
        <HoldThreshold grouped={true} />
        <RecordingBuffer grouped={true} />
        <LanguageDetectionWindow grouped={true} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.debug.groups.input")}>
        <ReliablePasteToggle grouped={true} />
        <AlwaysOnMicrophone grouped={true} />
        <ClamshellMicrophoneSelector grouped={true} />
        <UpdateChecksToggle grouped={true} />
        <KeyboardDiagnostic />
      </SettingsGroup>
    </>
  );
};

const loadLogDir = async () => {
  const result = await commands.getLogDirPath();
  return result.status === "ok" ? result.data : null;
};
