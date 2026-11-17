import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isComposingKeyEvent } from "@/common/lib/keyboard";
import { languageName, searchLanguages } from "@/common/lib/languages";

/** Search keys: Enter adds, Backspace on empty removes the last, Escape clears. Returns true if handled. */
export const languageSearchKeys = (
  e: React.KeyboardEvent<HTMLInputElement>,
  {
    query,
    first,
    last,
    toggle,
    clear,
  }: {
    query: string;
    /** The language Enter adds. */
    first: string | undefined;
    /** The language Backspace removes (none when it can't). */
    last: string | undefined;
    toggle: (code: string) => void;
    clear: () => void;
  },
): boolean => {
  if (isComposingKeyEvent(e.nativeEvent)) return false;
  if (e.key === "Enter" && query) {
    e.preventDefault();
    if (first) toggle(first);
    return true;
  }
  if (e.key === "Backspace" && !query && last) {
    e.preventDefault();
    toggle(last);
    return true;
  }
  if (e.key === "Escape" && query) {
    clear();
    return true;
  }
  return false;
};

/**
 * The picker's search: what matches, what's left to add, and toggling. With
 * `keepOne` the last language can't be removed; a `suggestion` leads the list
 * until something is typed.
 */
export const useLanguagePicker = ({
  languages,
  onChange,
  keepOne = false,
  suggestion = null,
}: {
  languages: string[];
  onChange: (next: string[]) => void;
  keepOne?: boolean;
  suggestion?: string | null;
}) => {
  const { i18n } = useTranslation();
  const ui = i18n.language;
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const found = searchLanguages(query, ui);
    if (!suggestion || query) return found;
    return [
      ...found.filter((l) => l.code === suggestion),
      ...found.filter((l) => l.code !== suggestion),
    ];
  }, [query, ui, suggestion]);
  const available = matches.filter((l) => !languages.includes(l.code));
  const removable = !keepOne || languages.length > 1;

  const toggle = (code: string) => {
    const next = languages.includes(code)
      ? languages.filter((c) => c !== code)
      : [...languages, code];
    if (!next.length && keepOne) return;
    onChange(next);
    setQuery("");
    inputRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) =>
    languageSearchKeys(e, {
      query,
      first: available[0]?.code,
      last: removable ? languages[languages.length - 1] : undefined,
      toggle,
      clear: () => setQuery(""),
    });

  return {
    languages,
    query,
    setQuery,
    inputRef,
    matches,
    available,
    removable,
    toggle,
    onKeyDown,
    nameOf: (code: string) => languageName(code, ui),
  };
};
