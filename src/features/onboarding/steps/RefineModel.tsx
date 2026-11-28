import React from "react";
import { useTranslation } from "react-i18next";
import type { LlmModelInfo } from "@/bindings";
import { NextButton, ObHeader, OnboardingShell } from "../OnboardingShell";

/** The LLMs offered here, best first. None is recommended or picked for
 * them: Rewrite starts on Not now, and they choose a model if they want one. */
const OFFERED = ["qwen3-4b-instruct-2507", "qwen3-1.7b"];

const QUALITY: Record<string, string> = { A: "best", B: "good", C: "fair" };
const SPEED: Record<LlmModelInfo["speed"], string> = {
  very_fast: "fast",
  fast: "good",
  moderate: "moderate",
};

const gb = (bytes: number) =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(1)} GB`
    : `${Math.round(bytes / 1e6)} MB`;

interface RefineModelProps {
  progress: { index: number; count: number };
  llms: LlmModelInfo[];
  /** The pick; "" is Not now. */
  picked: string;
  onPick: (id: string) => void;
  downloads: React.ReactNode;
  onBack: () => void;
  onContinue: () => void;
}

/** Step 5: the LLM behind Rewrite, or Not now (the default). Picking starts
 * its download. */
export const RefineModel: React.FC<RefineModelProps> = ({
  progress,
  llms,
  picked,
  onPick,
  downloads,
  onBack,
  onContinue,
}) => {
  const { t } = useTranslation();
  const offered = OFFERED.map((id) => llms.find((m) => m.id === id)).filter(
    (m): m is LlmModelInfo => !!m,
  );

  return (
    <OnboardingShell
      progress={progress}
      tight
      onBack={onBack}
      hint={t("onboarding.downloads.background")}
      primary={<NextButton onClick={onContinue} />}
    >
      <ObHeader
        title={t("onboarding.refine.title")}
        sub={t("onboarding.refine.subtitle")}
      />
      <div
        className="g-list"
        role="radiogroup"
        aria-label={t("onboarding.refine.label")}
      >
        {offered.map((model) => {
          const on = picked === model.id;
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
                <div className="g-mname flex-wrap">{model.short_name}</div>
                <div className="g-mdesc">
                  {t(
                    `onboarding.refine.descriptions.${model.id.replace(/\./g, "_")}`,
                    model.description,
                  )}
                </div>
                <div className="g-mmeta">
                  <span>
                    {t("onboarding.refine.quality", {
                      value: t(
                        `onboarding.refine.levels.${QUALITY[model.quality] ?? "good"}`,
                      ),
                    })}
                  </span>
                  <span>
                    {t("onboarding.refine.speed", {
                      value: t(
                        `onboarding.refine.levels.${SPEED[model.speed]}`,
                      ),
                    })}
                  </span>
                  <span>
                    {t("onboarding.refine.memory", { n: model.memory_gb })}
                  </span>
                </div>
              </div>
              <div className="g-mr">
                <span className="g-size">{gb(model.size_bytes)}</span>
              </div>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={picked === ""}
          onClick={() => onPick("")}
          className="g-mo cursor-pointer hover:bg-wash"
        >
          <span
            className={`g-radio ${picked === "" ? "on" : ""}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="g-mname">{t("onboarding.refine.notNow")}</div>
            <div className="g-mdesc">{t("onboarding.refine.notNowHint")}</div>
          </div>
          <div className="g-mr" />
        </button>
      </div>
      {downloads}
    </OnboardingShell>
  );
};
