import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguagePicker } from "@/common/shared/LanguagePicker";
import { suggestedLanguages } from "@/common/lib/languageSuggestions";
import { isWeakLanguage } from "@/features/stt/lib/catalog";
import { useSettings } from "@/common/settings/useSettings";
import { isComposingKeyEvent } from "@/common/lib/keyboard";
import { cjkSubsetFont } from "@/common/lib/cjkFont";
import { languageList } from "@/common/lib/languages";

interface PreferredLanguagesProps {
  grouped?: boolean;
}

type Picker = ReturnType<typeof useLanguagePicker>;

const SearchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

// Matches the row's gap-1.

/** The menu under +: a search over every language, the picked ones first and ticked. */
const LanguageMenu: React.FC<{
  picker: Picker;
  /** The picked languages when the menu opened: they lead, and stay put as they're toggled. */
  pinned: string[];
  /** Highlight the first addable even with nothing typed (it's the suggestion). */
  highlightFirst: boolean;
}> = ({ picker, pinned, highlightFirst }) => {
  const { t } = useTranslation();
  const { inputRef, query, languages, matches } = picker;
  // Picked ones in the chips' order, then the rest in search order.
  const rows = [
    ...pinned.flatMap((code) => matches.filter((l) => l.code === code)),
    ...matches.filter((l) => !pinned.includes(l.code)),
  ];
  const firstAddable = rows.find((l) => !languages.includes(l.code))?.code;

  return (
    <div
      // Keep focus in the search: WebKit doesn't focus a pressed button, so
      // the blur would close the menu before the click lands.
      onMouseDown={(e) => {
        if (e.target !== inputRef.current) e.preventDefault();
      }}
      className="absolute end-0 top-full z-50 mt-1 w-[248px] overflow-hidden rounded-lg border border-line bg-background text-start shadow-lg"
    >
      <label className="flex items-center gap-2 border-b border-line px-3 text-ink-3">
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-label={t("languagePicker.search")}
          placeholder={t("languagePicker.search")}
          value={query}
          onChange={(e) => picker.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (isComposingKeyEvent(e.nativeEvent)) return;
            // Escape with a query clears it; without one, the menu closes.
            if (picker.onKeyDown(e)) e.stopPropagation();
          }}
          className="h-9 w-full min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-ink-3"
        />
      </label>
      <div className="max-h-56 overflow-y-auto p-1">
        {rows.map((l) => {
          const name = picker.nameOf(l.code);
          const picked = languages.includes(l.code);
          const locked = picked && !picker.removable;
          const highlighted =
            (!!query || highlightFirst) && l.code === firstAddable;
          return (
            <button
              key={l.code}
              type="button"
              aria-pressed={picked}
              disabled={locked}
              onClick={() => picker.toggle(l.code)}
              // Picked rows are only ticked: unlike Dropdown's one choice,
              // several fills would stack into stripes.
              className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors disabled:cursor-default ${
                highlighted
                  ? "bg-wash"
                  : "hover:bg-wash disabled:hover:bg-transparent"
              }`}
            >
              <span
                lang={l.code}
                className={`shrink-0 ${picked ? "font-semibold" : ""} ${cjkSubsetFont(l.native) ?? ""}`}
              >
                {l.native}
              </span>
              {l.native !== name && (
                <span className="truncate text-xs text-ink-3">{name}</span>
              )}
              <span
                className={`ms-auto flex w-4 shrink-0 ${locked ? "text-ink-3" : "text-ink-2"}`}
              >
                {picked && <CheckIcon />}
              </span>
            </button>
          );
        })}
        {!rows.length && (
          <div className="px-2 py-3 text-center text-xs text-ink-3">
            {t("settings.general.preferredLanguages.noMatch", {
              query: query.trim(),
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Edits `spoken_languages`; leaves the model's own Language as is. One line
 * like its neighbours: as many chips as fit, "+N" for the rest, and + to
 * open the menu that adds and removes.
 */
export const PreferredLanguages: React.FC<PreferredLanguagesProps> = ({
  grouped = false,
}) => {
  const { t, i18n } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const languages = getSetting("spoken_languages") ?? [];
  const ui = i18n.language;

  // Nothing picked yet (onboarded before this setting): suggest their language.
  const suggestion = languages.length ? null : suggestedLanguages()[0];
  const picker = useLanguagePicker({
    languages,
    onChange: (next) => updateSetting("spoken_languages", next),
    // At least one language, once there is one.
    keepOne: true,
    suggestion,
  });

  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    setPinned(languages);
    setOpen(true);
  };
  const closeMenu = () => {
    setOpen(false);
    picker.setQuery("");
  };

  useEffect(() => {
    if (open) picker.inputRef.current?.focus({ preventScroll: true });
  }, [open, picker.inputRef]);

  const weak = languages.filter(isWeakLanguage);
  const row = (
    <div className="g-row">
      <div className="g-rl">
        <h3 className="g-rt m-0">
          {t("settings.general.preferredLanguages.title")}
        </h3>
        <p className="g-rd m-0 mt-0.5">
          {t("settings.general.preferredLanguages.description")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {languages.length ? (
            languages.map((code) => (
              <span key={code} className="g-chip">
                {picker.nameOf(code)}
              </span>
            ))
          ) : (
            <span className="text-[13px] text-ink-3">
              {t("settings.general.preferredLanguages.none")}
            </span>
          )}
        </div>
        {weak.length > 0 && (
          <p className="g-rd m-0 mt-2">
            {t("settings.general.preferredLanguages.weak", {
              languages: languageList(weak, ui),
            })}
          </p>
        )}
      </div>
      <div
        ref={rootRef}
        className="g-rr relative"
        onBlur={(e) => {
          if (rootRef.current?.contains(e.relatedTarget as Node)) return;
          closeMenu();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !open) return;
          e.preventDefault();
          e.stopPropagation();
          closeMenu();
          changeRef.current?.focus();
        }}
      >
        <button
          ref={changeRef}
          type="button"
          className="g-btn sec cursor-pointer"
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? closeMenu() : openMenu())}
        >
          {t("settings.general.preferredLanguages.change")}
        </button>
        {open && (
          <LanguageMenu
            picker={picker}
            pinned={pinned}
            highlightFirst={!!suggestion}
          />
        )}
      </div>
    </div>
  );
  return grouped ? row : <div className="g-card">{row}</div>;
};
