import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type TtsModelInfo } from "@/bindings";
import { NextButton, ObHeader, OnboardingShell } from "../OnboardingShell";
import { queueVoices, unqueueVoice } from "../ObDownloads";
import { modelLanguage } from "@/features/tts/hooks/useVoiceModels";

export const KOKORO = "kokoro-int8-en-v0_19";
const KITTEN = "kitten-nano-en-v0_2-fp16";

/** The voices offered here: Kokoro, one for each other language they speak,
 * and the small Kitten. The rest are in Models. */
export const offeredVoices = (voices: TtsModelInfo[], languages: string[]) => {
  const byId = (id: string) => voices.find((v) => v.id === id);
  // One-language voices for their other languages; multi-language models
  // are in Models.
  const others = voices.filter(
    (v) =>
      v.languages.length === 1 &&
      v.languages[0] !== "en" &&
      languages.includes(v.languages[0]),
  );
  return [byId(KOKORO), ...others, byId(KITTEN)].filter(
    (v): v is TtsModelInfo => !!v,
  );
};

/** What's picked before they choose: Kokoro and their other languages' voices. */
export const defaultVoices = (voices: TtsModelInfo[], languages: string[]) =>
  offeredVoices(voices, languages)
    .filter((v) => v.id !== KITTEN)
    .map((v) => v.id);

interface VoicesProps {
  progress: { index: number; count: number };
  voices: TtsModelInfo[];
  languages: string[];
  picked: string[];
  onChange: (ids: string[]) => void;
  downloads: React.ReactNode;
  onBack: () => void;
  onContinue: () => void;
}

/** Step 4: Read Aloud voices, one or more. Each downloads once picked. */
export const Voices: React.FC<VoicesProps> = ({
  progress,
  voices,
  languages,
  picked,
  onChange,
  downloads,
  onBack,
  onContinue,
}) => {
  const { t, i18n } = useTranslation();
  const [sampleFor, setSampleFor] = useState<string | null>(null);

  // A sample asked for before its voice was here plays once it arrives.
  useEffect(() => {
    const voice = voices.find((v) => v.id === sampleFor);
    if (voice?.is_downloaded) {
      setSampleFor(null);
      commands.speakVoiceSample(voice.id);
    }
  }, [voices, sampleFor]);

  const toggle = (id: string) => {
    if (picked.includes(id)) {
      unqueueVoice(id);
      onChange(picked.filter((p) => p !== id));
    } else {
      queueVoices([id]);
      onChange([...picked, id]);
    }
  };

  const sample = (voice: TtsModelInfo) => {
    if (voice.is_downloaded) {
      commands.speakVoiceSample(voice.id);
    } else {
      queueVoices([voice.id]);
      setSampleFor(voice.id);
    }
  };

  return (
    <OnboardingShell
      progress={progress}
      tight
      onBack={onBack}
      hint={t("onboarding.downloads.background")}
      primary={<NextButton onClick={onContinue} />}
    >
      <ObHeader
        title={t("onboarding.voices.title")}
        sub={t("onboarding.voices.subtitle")}
      />
      <div
        className="g-list"
        role="group"
        aria-label={t("onboarding.voices.label")}
      >
        {offeredVoices(voices, languages).map((voice) => {
          const on = picked.includes(voice.id);
          return (
            <div key={voice.id} className="g-mo">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={voice.name}
                onClick={() => toggle(voice.id)}
                className={`g-radio ${on ? "on" : ""} cursor-pointer p-0`}
                style={{ background: "none" }}
              />
              <button
                type="button"
                className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-start text-inherit"
                onClick={() => toggle(voice.id)}
              >
                <div className="g-mname flex-wrap">
                  {voice.name}
                  {voice.id === KOKORO && (
                    <span className="g-badge">
                      {t("onboarding.model.recommended")}
                    </span>
                  )}
                </div>
                <div className="g-mdesc">
                  {t(
                    `onboarding.voices.descriptions.${voice.id}`,
                    voice.description,
                  )}
                </div>
                <div className="g-mmeta">
                  <span>{modelLanguage(voice, i18n.language)}</span>
                  <span>
                    {t("onboarding.voices.speakers", {
                      count: voice.voices.length,
                    })}
                  </span>
                  <span>{t("onboarding.voices.speed")}</span>
                </div>
              </button>
              <div className="g-mr">
                <span className="g-size">{voice.size_mb} MB</span>
                <button
                  type="button"
                  className="g-btn ghost sm h-[26px] cursor-pointer px-2 text-[12px]"
                  onClick={() => sample(voice)}
                  aria-label={t("onboarding.voices.sampleLabel", {
                    name: voice.name,
                  })}
                >
                  {sampleFor === voice.id ? (
                    <span className="g-spin size-2.5" aria-hidden="true" />
                  ) : (
                    <i className="g-ic g-i-play size-2.5" aria-hidden="true" />
                  )}
                  {t("onboarding.voices.sample")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {downloads}
    </OnboardingShell>
  );
};
