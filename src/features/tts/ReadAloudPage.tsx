import React, { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { commands } from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";
import { SettingsGroup } from "@/common/ui/SettingsGroup";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { Slider } from "@/common/ui/Slider";
import { Dropdown } from "@/common/ui/Dropdown";
import { PageHeader } from "@/common/shared/PageHeader";
import { Button } from "@/common/ui/Button";
import { Switch } from "@/common/ui/Switch";
import { ShortcutInput } from "@/common/settings/ShortcutInput";
import { IntroCard } from "@/common/shared/IntroCard";
import { Keycaps } from "@/common/shared/Keycaps";
import { useOsType } from "@/common/hooks/useOsType";
import { keycapLabel } from "@/common/lib/keyboard";
import { modelLanguage, useVoiceModels } from "./hooks/useVoiceModels";
import { ReadAloudDemo } from "./ReadAloudDemo";

export const ReadAloudPage: React.FC<{ onManageVoices: () => void }> = ({
  onManageVoices,
}) => {
  const { t, i18n } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const {
    selected,
    languageOf,
    voicesOf,
    voiceOf,
    languageOptions,
    setLanguage,
  } = useVoiceModels();
  const [speaking, setSpeaking] = useState(false);
  const osType = useOsType();
  const binding = getSetting("bindings")?.speak_selection?.current_binding;
  const introSample = t("settings.readAloud.intro.sample");
  // The example's voice starts muted on every visit.
  const [sound, setSound] = useState(false);

  const refreshSpeaking = useCallback(async () => {
    setSpeaking(await commands.isSpeaking());
  }, []);

  useEffect(() => {
    refreshSpeaking();
    const finished = listen("read-aloud-finished", () => setSpeaking(false));
    return () => {
      finished.then((off) => off());
    };
  }, [refreshSpeaking]);

  // Playback lives in Rust; poll while a read is going so Read/Stop stays true.
  useEffect(() => {
    if (!speaking) return;
    const id = setInterval(refreshSpeaking, 400);
    return () => clearInterval(id);
  }, [speaking, refreshSpeaking]);

  const speed = getSetting("tts_speed") ?? 1;
  const voice = selected ? voiceOf(selected) : 0;
  const language = selected ? modelLanguage(selected, i18n.language) : "";
  const voiceName =
    selected && selected.voices.length > 1
      ? `${selected.name} · ${selected.voices[voice] ?? selected.voices[0]}`
      : (selected?.name ?? "");
  const toggleRead = (text: string) => {
    if (speaking) commands.stopSpeaking();
    else commands.speakText(text);
    setSpeaking(!speaking);
  };

  return (
    <>
      <PageHeader
        title={t("settings.readAloud.title")}
        lede={t("settings.readAloud.description")}
      />

      <IntroCard
        line={
          <Trans
            i18nKey="home.listenLine"
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
        hint={
          osType === "macos"
            ? t("settings.readAloud.intro.hintMac")
            : t("settings.readAloud.intro.hint")
        }
        actions={
          <>
            <button
              type="button"
              className="g-try"
              disabled={!speaking && !selected}
              onClick={() => toggleRead(introSample)}
            >
              {speaking
                ? t("settings.readAloud.intro.stop")
                : t("settings.readAloud.intro.try")}
            </button>
            {selected && (
              <button
                type="button"
                className="g-btn ghost cursor-pointer"
                onClick={onManageVoices}
              >
                <i className="g-ic g-i-audio" aria-hidden="true" />
                {voiceName}
              </button>
            )}
          </>
        }
        demoLabel={t("settings.readAloud.intro.label")}
        sound={
          selected ? { on: sound, toggle: () => setSound(!sound) } : undefined
        }
        demo={
          <ReadAloudDemo
            text={introSample}
            keys={binding ? keycapLabel(binding, osType) : ""}
            label={t("settings.readAloud.title")}
            speed={speed}
            sound={sound && !!selected}
          />
        }
      />

      <SettingsGroup title={t("settings.readAloud.setupTitle")}>
        <ShortcutInput
          shortcutId="speak_selection"
          grouped
          description={t("settings.readAloud.shortcutHint")}
        />
        <SettingContainer
          title={t("settings.readAloud.model.title")}
          description={
            selected
              ? t("settings.readAloud.model.summary", {
                  name: selected.name,
                  language,
                  size: selected.size_mb,
                })
              : t("settings.readAloud.model.none")
          }
          grouped
        >
          <Button variant="secondary" onClick={onManageVoices}>
            {selected
              ? t("settings.readAloud.model.change")
              : t("settings.readAloud.model.download")}
          </Button>
        </SettingContainer>
        {selected && selected.voices.length > 1 && (
          <SettingContainer
            title={t("settings.readAloud.voice.title")}
            description={t("settings.readAloud.voice.description")}
            grouped
          >
            <Dropdown
              options={voicesOf(selected).map(({ name, index }) => ({
                value: String(index),
                label: name,
              }))}
              selectedValue={String(voice)}
              onSelect={(value) => updateSetting("tts_voice", Number(value))}
            />
          </SettingContainer>
        )}
        {selected && selected.languages.length > 1 && (
          <SettingContainer
            title={t("settings.readAloud.language.title")}
            description={t("settings.readAloud.language.description")}
            grouped
          >
            <Dropdown
              options={languageOptions(selected)}
              selectedValue={languageOf(selected)}
              onSelect={(value) => setLanguage(selected, value)}
            />
          </SettingContainer>
        )}
        <Slider
          value={speed}
          onChange={(value) => updateSetting("tts_speed", value)}
          min={0.5}
          max={3}
          step={0.1}
          label={t("settings.readAloud.speed.title")}
          description={t("settings.readAloud.speed.description")}
          grouped
          formatValue={(value) => `${value.toFixed(1)}x`}
        />
        <SettingContainer
          title={t("settings.readAloud.livePreview.title")}
          description={t("settings.readAloud.livePreview.description")}
          grouped
        >
          <Switch
            checked={getSetting("tts_live_preview") ?? true}
            onChange={(on) => updateSetting("tts_live_preview", on)}
            ariaLabel={t("settings.readAloud.livePreview.title")}
          />
        </SettingContainer>
      </SettingsGroup>
    </>
  );
};
