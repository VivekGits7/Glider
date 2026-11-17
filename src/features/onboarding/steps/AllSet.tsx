import React from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/common/settings/useSettings";
import { useOsType } from "@/common/hooks/useOsType";
import { Keycaps } from "@/common/shared/Keycaps";
import { Switch } from "@/common/ui/Switch";
import { languageName } from "@/common/lib/languages";
import { NextButton, ObHeader, OnboardingShell } from "../OnboardingShell";

interface AllSetProps {
  progress: { index: number; count: number };
  languages: string[];
  modelName: string;
  atLogin: boolean;
  onAtLogin: (on: boolean) => void;
  onChangeLanguages: () => void;
  onChangeModel: () => void;
  onDone: () => void;
}

/** Step 7: what they set up, at a glance, and Done. */
export const AllSet: React.FC<AllSetProps> = ({
  progress,
  languages,
  modelName,
  atLogin,
  onAtLogin,
  onChangeLanguages,
  onChangeModel,
  onDone,
}) => {
  const { t, i18n } = useTranslation();
  const osType = useOsType();
  const { getSetting } = useSettings();
  const bindings = getSetting("bindings") ?? {};
  const keys = (id: string) => {
    const binding = bindings[id]?.current_binding;
    return binding ? (
      <Keycaps binding={binding} osType={osType} size="line" />
    ) : null;
  };
  const row = (label: string, value: React.ReactNode, end: React.ReactNode) => (
    <div className="g-row min-h-[52px] px-[18px] py-2.5">
      <span className="g-small w-[120px] shrink-0">{label}</span>
      <span className="flex-1 text-[14px]">{value}</span>
      {end}
    </div>
  );
  const change = (onClick: () => void) => (
    <button
      type="button"
      className="g-btn ghost sm cursor-pointer"
      onClick={onClick}
    >
      {t("onboarding.done.change")}
    </button>
  );

  return (
    <OnboardingShell
      progress={progress}
      hint={t("onboarding.done.later")}
      primary={
        <NextButton
          onClick={onDone}
          label={t("onboarding.done.finish")}
          arrow={false}
        />
      }
    >
      <ObHeader
        title={t("onboarding.done.title")}
        sub={t(
          osType === "macos"
            ? "onboarding.done.subtitleMac"
            : "onboarding.done.subtitle",
        )}
      />
      <div className="g-card">
        {row(
          t("onboarding.done.dictate"),
          keys("transcribe"),
          <span className="g-small">{t("onboarding.done.holdAndTalk")}</span>,
        )}
        {row(
          t("onboarding.done.readAloud"),
          keys("speak_selection"),
          <span className="g-small">
            {t("onboarding.done.selectThenPress")}
          </span>,
        )}
        {row(
          t("onboarding.done.languages"),
          languages.map((l) => languageName(l, i18n.language)).join(", "),
          change(onChangeLanguages),
        )}
        {row(
          t("onboarding.done.speechModel"),
          modelName,
          change(onChangeModel),
        )}
      </div>
      <div className="flex items-center justify-between px-1">
        <label htmlFor="at-login" className="text-[15px]">
          {t("onboarding.done.atLogin")}
        </label>
        <Switch
          checked={atLogin}
          onChange={onAtLogin}
          ariaLabel={t("onboarding.done.atLogin")}
        />
      </div>
    </OnboardingShell>
  );
};
