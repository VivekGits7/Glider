import React from "react";
import { useTranslation } from "react-i18next";
import { speedLevel } from "@/common/shared/SpeedBars";
import { formatModelSize } from "@/common/lib/format";
import { languageList, languageName } from "@/common/lib/languages";
import type { CatalogModel } from "@/features/stt/lib/catalog";
import { NextButton, ObHeader, OnboardingShell } from "../OnboardingShell";
import type { useOnboardingModels } from "../useOnboardingModels";

const SPEED_KEYS = [
  "verySlow",
  "slow",
  "moderate",
  "fast",
  "veryFast",
] as const;
/** Models offered on this screen; the full list lives in Models. */
const SHOWN = 3;

interface DictationModelProps {
  progress: { index: number; count: number };
  models: ReturnType<typeof useOnboardingModels>;
  languages: string[];
  selected: CatalogModel | undefined;
  onPick: (id: string) => void;
  downloads: React.ReactNode;
  onBack: () => void;
  onContinue: () => void;
}

/** Step 3: the speech-to-text model, graded for their languages. Picking
 * starts its download, which carries on in the background. */
export const DictationModel: React.FC<DictationModelProps> = ({
  progress,
  models,
  languages,
  selected,
  onPick,
  downloads,
  onBack,
  onContinue,
}) => {
  const { t, i18n } = useTranslation();
  const ui = i18n.language;
  const rows = [
    ...models.groups.picks,
    ...models.groups.others,
    ...models.groups.partial,
  ]
    .map((r) => r.model)
    .filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i)
    .slice(0, SHOWN);
  const best = models.groups.picks[0]?.model.id;

  return (
    <OnboardingShell
      progress={progress}
      tight
      onBack={onBack}
      hint={t("onboarding.downloads.background")}
      primary={<NextButton disabled={!selected} onClick={onContinue} />}
    >
      <ObHeader
        title={t("onboarding.model.title")}
        sub={t("onboarding.model.subtitle")}
      />
      <div
        className="g-list"
        role="radiogroup"
        aria-label={t("onboarding.model.label")}
      >
        {rows.map((model) => {
          const info = models.infoFor(model);
          const on = model.id === selected?.id;
          const wait = models.grading.wait(model);
          return (
            <button
              key={model.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(model.id)}
              className="g-mo cursor-pointer hover:bg-wash"
            >
              <span
                className={`g-radio ${on ? "on" : ""}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="g-mname flex-wrap">
                  {info?.name ?? model.name}
                  {model.id === best && (
                    <span className="g-badge">
                      {languages.length > 1
                        ? t("onboarding.model.bestFor", {
                            languages: languageList(languages, ui),
                          })
                        : t("onboarding.model.recommended")}
                    </span>
                  )}
                </div>
                <div className="g-mdesc">
                  {info?.description || model.description}
                </div>
                <div className="g-mmeta">
                  {languages.map((lang) => {
                    const grade = models.grading.grade(model, lang);
                    const missing = models.grading
                      .missing(model)
                      .includes(lang);
                    return (
                      <span key={lang}>
                        {languageName(lang, ui)}
                        <span
                          className={`g-grade ${missing || grade.letter === "none" ? "na" : ""}`}
                        >
                          {missing || grade.letter === "none"
                            ? "–"
                            : grade.letter}
                        </span>
                      </span>
                    );
                  })}
                  {wait != null && (
                    <span>
                      {t(
                        `settings.models.speed.${SPEED_KEYS[speedLevel(wait)]}`,
                      )}
                    </span>
                  )}
                  <span>
                    {t("onboarding.model.languageCount", {
                      count: model.languages.length,
                    })}
                  </span>
                </div>
              </div>
              <div className="g-mr">
                <span className="g-size">{formatModelSize(info?.size_mb)}</span>
              </div>
            </button>
          );
        })}
      </div>
      {downloads}
    </OnboardingShell>
  );
};
