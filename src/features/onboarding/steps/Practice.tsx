import React, { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { commands } from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";
import { useOsType } from "@/common/hooks/useOsType";
import { Keycaps } from "@/common/shared/Keycaps";
import { NextButton, ObHeader, OnboardingShell } from "../OnboardingShell";

interface PracticeProps {
  progress: { index: number; count: number };
  preview: boolean;
  /** The dictation model is on disk, so dictating works now. */
  ready: boolean;
  modelName: string;
  onBack: () => void;
  onContinue: () => void;
}

/** Step 6: try both shortcuts here before using them elsewhere. */
export const Practice: React.FC<PracticeProps> = ({
  progress,
  preview,
  ready,
  modelName,
  onBack,
  onContinue,
}) => {
  const { t } = useTranslation();
  const osType = useOsType();
  const { getSetting } = useSettings();
  const bindings = getSetting("bindings") ?? {};
  const [text, setText] = useState("");
  const [heard, setHeard] = useState(false);

  // The shortcuts work from here on, so the box below can be dictated into.
  useEffect(() => {
    if (preview) return;
    commands.initializeEnigo().catch(console.error);
    commands.initializeShortcuts().catch(console.error);
  }, [preview]);

  useEffect(() => {
    const off = listen("reading-progress", () => setHeard(true));
    return () => {
      off.then((stop) => stop());
    };
  }, []);

  const keys = (id: string) => {
    const binding = bindings[id]?.current_binding;
    return binding ? (
      <Keycaps binding={binding} osType={osType} size="line" className="mx-1" />
    ) : (
      <span />
    );
  };

  return (
    <OnboardingShell
      progress={progress}
      onBack={onBack}
      hint={t("onboarding.practice.skip")}
      primary={<NextButton onClick={onContinue} />}
    >
      <ObHeader
        title={t("onboarding.practice.title")}
        sub={t("onboarding.practice.subtitle")}
      />
      <div className="g-list">
        <div className="g-row stack gap-2.5">
          <div className="g-rt">
            <Trans
              i18nKey="onboarding.practice.dictate"
              components={{ keys: keys("transcribe") }}
            />
          </div>
          <label className="sr-only" htmlFor="practice-box">
            {t("onboarding.practice.boxLabel")}
          </label>
          <textarea
            id="practice-box"
            className="g-area min-h-[72px] focus:border-logo-primary"
            value={text}
            placeholder={t("onboarding.practice.placeholder")}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="g-row min-h-0">
          <div className="g-rt">
            <Trans
              i18nKey="onboarding.practice.listen"
              components={{ keys: keys("speak_selection") }}
            />
          </div>
          {heard && (
            <span className="g-badge moss">
              <i className="g-ic g-i-check" aria-hidden="true" />
              {t("onboarding.practice.done")}
            </span>
          )}
        </div>
      </div>
      <p className="g-small m-0">
        {ready
          ? t("onboarding.practice.voicesNote")
          : t("onboarding.practice.waiting", { model: modelName })}
      </p>
    </OnboardingShell>
  );
};
