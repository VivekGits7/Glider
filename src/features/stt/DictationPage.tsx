import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { type } from "@tauri-apps/plugin-os";
import { useSettings } from "@/common/settings/useSettings";
import { SettingsGroup } from "@/common/ui/SettingsGroup";
import { PageHeader } from "@/common/shared/PageHeader";
import { ShortcutInput } from "@/common/settings/ShortcutInput";
import { IntroCard } from "@/common/shared/IntroCard";
import { Keycaps } from "@/common/shared/Keycaps";
import { useOsType } from "@/common/hooks/useOsType";
import { keycapLabel } from "@/common/lib/keyboard";
import { useVoiceModels } from "@/features/tts/hooks/useVoiceModels";
import { useModelStore } from "./store/modelStore";
import { DictationDemo } from "./DictationDemo";
import { ModelSettingsCard } from "./settings/ModelSettingsCard";
import { MicrophoneSelector } from "./settings/MicrophoneSelector";
import { ChannelSelector } from "./settings/ChannelSelector";
import { MuteWhileRecording } from "./settings/MuteWhileRecording";
import { AudioFeedback } from "./settings/AudioFeedback";
import { OutputDeviceSelector } from "./settings/OutputDeviceSelector";
import { VolumeSlider } from "./settings/VolumeSlider";
import { VoiceActivityDetection } from "./settings/VoiceActivityDetection";
import { LongFormChunking } from "./settings/LongFormChunking";
import { FillerWordRemoval } from "./settings/FillerWordRemoval";
import { CustomWords } from "./settings/CustomWords";
import { AppendTrailingSpace } from "./settings/AppendTrailingSpace";
import { ModelUnloadTimeoutSetting } from "./settings/ModelUnloadTimeout";
import { PasteMethodSetting } from "./settings/PasteMethod";
import { TypingToolSetting } from "./settings/TypingTool";
import { ClipboardHandlingSetting } from "./settings/ClipboardHandling";
import { AutoSubmit } from "./settings/AutoSubmit";
import { RewriteDictation } from "./settings/RewriteDictation";
import { LivePreview } from "./settings/LivePreview";

/** Everything about dictation: its shortcut, the microphone, how speech
 * becomes text, and how that text gets typed. */
export const DictationPage: React.FC<{
  /** Opens the onboarding's try-it step. */
  onTry: () => void;
  /** Opens Models on its Speech to text tab. */
  onManageModels: () => void;
}> = ({ onTry, onManageModels }) => {
  const { t } = useTranslation();
  const osType = useOsType();
  const { audioFeedbackEnabled, getSetting } = useSettings();
  const binding = getSetting("bindings")?.transcribe?.current_binding;
  const modelName = useModelStore(
    (s) => s.models.find((m) => m.id === s.currentModel)?.name ?? "",
  );
  // The example speaks in the Read Aloud voice, and starts muted every visit.
  const voice = useVoiceModels().selected;
  const [sound, setSound] = useState(false);
  const isLinux = type() === "linux";
  return (
    <>
      <PageHeader
        title={t("sidebar.dictation")}
        lede={t("settings.dictation.description")}
      />
      <IntroCard
        line={
          <Trans
            i18nKey="home.dictateLine"
            components={{
              keys: binding ? (
                <span className="g-keys mx-1">
                  <Keycaps binding={binding} osType={osType} />
                </span>
              ) : (
                <span />
              ),
            }}
          />
        }
        hint={t("settings.dictation.intro.hint")}
        actions={
          <>
            <button type="button" className="g-try" onClick={onTry}>
              {t("settings.dictation.intro.try")}
            </button>
            {modelName && (
              <button
                type="button"
                className="g-btn ghost cursor-pointer"
                onClick={onManageModels}
              >
                <i className="g-ic g-i-cpu" aria-hidden="true" />
                {modelName}
              </button>
            )}
          </>
        }
        demoLabel={t("settings.dictation.intro.label")}
        sound={
          voice ? { on: sound, toggle: () => setSound(!sound) } : undefined
        }
        demo={
          <DictationDemo
            said={t("settings.dictation.intro.said")}
            typed={t("settings.dictation.intro.typed")}
            keys={binding ? keycapLabel(binding, osType) : ""}
            label={t("sidebar.dictation")}
            sound={sound && !!voice}
          />
        }
      />
      <SettingsGroup title={t("settings.general.shortcut.title")}>
        <ShortcutInput shortcutId="transcribe" grouped />
        {/* Cancel shortcut remains hidden on Linux because of dynamic shortcut instability. */}
        {!isLinux && <ShortcutInput shortcutId="cancel" grouped />}
      </SettingsGroup>
      <ModelSettingsCard />
      <SettingsGroup title={t("settings.sound.title")}>
        <MicrophoneSelector grouped={true} />
        <ChannelSelector grouped={true} />
        <MuteWhileRecording grouped={true} />
        <AudioFeedback grouped={true} />
        <OutputDeviceSelector grouped={true} disabled={!audioFeedbackEnabled} />
        <VolumeSlider disabled={!audioFeedbackEnabled} />
      </SettingsGroup>
      <SettingsGroup title={t("settings.advanced.groups.transcription")}>
        <LivePreview />
        <VoiceActivityDetection grouped={true} />
        <LongFormChunking grouped={true} />
        <FillerWordRemoval grouped={true} />
        <CustomWords grouped />
        <AppendTrailingSpace grouped={true} />
        <ModelUnloadTimeoutSetting grouped={true} />
      </SettingsGroup>
      <RewriteDictation />
      <SettingsGroup
        title={t("settings.advanced.groups.output")}
        description={t("settings.advanced.groups.outputDescription")}
      >
        <PasteMethodSetting grouped={true} />
        <TypingToolSetting grouped={true} />
        <ClipboardHandlingSetting grouped={true} />
        <AutoSubmit grouped={true} />
      </SettingsGroup>
    </>
  );
};
