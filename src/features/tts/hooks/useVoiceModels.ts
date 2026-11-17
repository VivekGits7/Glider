import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type TtsModelInfo } from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";
import { languageName } from "@/common/lib/languages";

/** A voice model's language for a table cell: its one language, or
 * "Multiple languages". */
export const modelLanguage = (model: TtsModelInfo, uiLanguage: string) =>
  languageName(
    model.languages.length > 1 ? "mul" : model.languages[0],
    uiLanguage,
  );

/** Read Aloud's voice models. Download progress lives in Rust, so this polls
 * while one is downloading and picks up where it was after a page change. */
export const useVoiceModels = () => {
  const { i18n } = useTranslation();
  const { getSetting, updateSetting, refreshSettings } = useSettings();
  const [models, setModels] = useState<TtsModelInfo[]>([]);

  const refresh = useCallback(async () => {
    setModels(await commands.getTtsModels());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const downloading = models.some((m) => m.is_downloading);
  useEffect(() => {
    if (!downloading) return;
    const id = setInterval(refresh, 400);
    return () => clearInterval(id);
  }, [downloading, refresh]);

  const selectedId = getSetting("tts_model") ?? "";
  const selected = models.find((m) => m.id === selectedId && m.is_downloaded);
  const voice = getSetting("tts_voice") ?? 0;
  const chosen = getSetting("tts_languages") ?? {};

  /** The language `model` reads in: the one picked for it, or its default. */
  const languageOf = (model: TtsModelInfo) => {
    const picked = chosen[model.id];
    return picked && model.languages.includes(picked)
      ? picked
      : model.languages[0];
  };

  /** The voices that speak the model's language, with their speaker index. */
  const voicesOf = (model: TtsModelInfo) =>
    model.voices
      .map((name, index) => ({ name, index }))
      .filter(
        ({ index }) =>
          model.voice_languages.length === 0 ||
          model.voice_languages[index] === languageOf(model),
      );

  /** The voice that reads: the chosen one when it speaks the language, as
   * Read Aloud does in Rust. */
  const voiceOf = (model: TtsModelInfo) => {
    const voices = voicesOf(model);
    const current = model.id === selected?.id ? voice : 0;
    return voices.some((v) => v.index === current)
      ? current
      : (voices[0]?.index ?? 0);
  };

  /** Its languages for a dropdown: the default first, the rest by name. */
  const languageOptions = (model: TtsModelInfo) => {
    const [first, ...rest] = model.languages;
    const label = (code: string) => languageName(code, i18n.language);
    return [
      { value: first, label: label(first) },
      ...rest
        .map((code) => ({ value: code, label: label(code) }))
        .sort((a, b) => a.label.localeCompare(b.label, i18n.language)),
    ];
  };

  const setLanguage = async (model: TtsModelInfo, language: string) => {
    await commands.changeTtsLanguageSetting(model.id, language);
    await refreshSettings();
  };

  const selectModel = async (id: string) => {
    await updateSetting("tts_model", id);
    await updateSetting("tts_voice", 0);
  };

  return {
    models,
    setModels,
    refresh,
    selected,
    selectModel,
    languageOf,
    voicesOf,
    voiceOf,
    languageOptions,
    setLanguage,
  };
};
