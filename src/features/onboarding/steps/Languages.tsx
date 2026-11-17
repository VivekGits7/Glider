import React from "react";
import { useTranslation } from "react-i18next";
import { useLanguagePicker } from "@/common/shared/LanguagePicker";
import GliderTextLogo from "@/common/icons/GliderTextLogo";
import { NextButton, ObHeader, OnboardingShell } from "../OnboardingShell";
import { AppLanguageMenu } from "../AppLanguageMenu";
import { useOnboardingStore } from "../onboardingStore";
import { CHINESE_SCRIPTS, isChinese } from "@/common/lib/languageSuggestions";
import { getSupportedLanguage } from "@/i18n";
import { languageList } from "@/common/lib/languages";
import { useSettings } from "@/common/settings/useSettings";

/** The languages most people pick, as chips before any search. */
const POPULAR = [
  "en",
  "hi",
  "es",
  "fr",
  "de",
  "pt",
  "ja",
  "zh",
  "ko",
  "ar",
  "ru",
  "it",
  "bn",
  "mr",
  "ta",
  "te",
  "ur",
  "gu",
];

interface LanguagesProps {
  progress: { index: number; count: number };
  onContinue: () => void;
}

/** Step 1: the languages they dictate in (and Chinese script if needed). */
export const Languages: React.FC<LanguagesProps> = ({
  progress,
  onContinue,
}) => {
  const { t, i18n } = useTranslation();
  const { updateSetting } = useSettings();
  const { languages, script, preview, set } = useOnboardingStore();
  const picker = useLanguagePicker({
    languages,
    onChange: (next) => set({ languages: next, modelId: null }),
  });
  const ui = i18n.language;
  const searching = picker.query.trim().length > 0;
  const shown = searching
    ? picker.matches.slice(0, 24).map((l) => l.code)
    : [...languages, ...POPULAR.filter((c) => !languages.includes(c))];
  const chinese = languages.filter(isChinese);

  const uiLanguage = getSupportedLanguage(ui) || "en";
  const changeUiLanguage = (code: string) => {
    i18n.changeLanguage(code);
    if (!preview) updateSetting("app_language", code);
  };

  return (
    <OnboardingShell
      progress={progress}
      pill={<AppLanguageMenu value={uiLanguage} onChange={changeUiLanguage} />}
      hint={
        languages.length
          ? languageList(languages, ui)
          : t("onboarding.welcome.hint.pickOne")
      }
      primary={<NextButton disabled={!languages.length} onClick={onContinue} />}
    >
      <ObHeader
        above={<GliderTextLogo height={24} className="mb-3.5" />}
        title={t("onboarding.welcome.title")}
        sub={t("onboarding.welcome.subtitle")}
      />
      <label className="relative flex">
        <span className="sr-only">{t("onboarding.welcome.search")}</span>
        <i
          className="g-ic g-i-search pointer-events-none absolute start-[11px] top-[10px] size-4 text-ink-3"
          aria-hidden="true"
        />
        <input
          ref={picker.inputRef}
          type="search"
          className="g-field wide ps-[34px]"
          placeholder={t("onboarding.welcome.searchPlaceholder", { count: 99 })}
          value={picker.query}
          onChange={(e) => picker.setQuery(e.target.value)}
          onKeyDown={picker.onKeyDown}
        />
      </label>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("onboarding.welcome.languagesLabel")}
      >
        {shown.length ? (
          shown.map((code) => {
            const on = languages.includes(code);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={on}
                onClick={() => picker.toggle(code)}
                className={`g-chip ${on ? "on" : ""} cursor-pointer hover:border-line-strong`}
              >
                {on && <i className="g-ic g-i-check" aria-hidden="true" />}
                {picker.nameOf(code)}
              </button>
            );
          })
        ) : (
          <p className="g-small m-0">
            {t("onboarding.welcome.noMatch", { query: picker.query })}
          </p>
        )}
      </div>
      {chinese.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="g-small me-1">
            {t("onboarding.welcome.chinese.question", {
              languages: languageList(chinese, ui),
            })}
          </span>
          {CHINESE_SCRIPTS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={script === c.id}
              onClick={() => set({ script: c.id })}
              className={`g-chip ${script === c.id ? "on" : ""} cursor-pointer`}
            >
              {t(`onboarding.welcome.chinese.${c.id}`)}
            </button>
          ))}
        </div>
      )}
    </OnboardingShell>
  );
};
