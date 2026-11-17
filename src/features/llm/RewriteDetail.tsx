import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { commands, type LLMPrompt, type RewriteOptions } from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";
import { useOsType } from "@/common/hooks/useOsType";
import { PageHeader } from "@/common/shared/PageHeader";
import { Keycaps } from "@/common/shared/Keycaps";
import { Switch } from "@/common/ui/Switch";
import { Tabs } from "@/common/ui/Tabs";
import { SettingsGroup } from "@/common/ui/SettingsGroup";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { ShortcutInput } from "@/common/settings/ShortcutInput";
import { DiffText } from "@/common/shared/DiffText";
import { notify } from "@/common/notices/noticeStore";
import {
  builtinKey,
  isBuiltin,
  useRewrites,
  type SlottedRewrite,
} from "./hooks/useRewrites";

const SAMPLE_MAX_WORDS = 2000;
const OPTION_KEYS: (keyof RewriteOptions)[] = [
  "shorter",
  "clarity",
  "reorder",
  "lists",
  "keep_tone",
  "keep_code",
];

type ExampleView = "before" | "after" | "changes";

const countWords = (text: string) =>
  text.split(/\s+/).filter((w) => w.length > 0).length;

interface RewriteDetailProps {
  slotted: SlottedRewrite;
  onBack: () => void;
  onManageModels: () => void;
}

/** One rewrite's page: what it does, its example, shortcut and model. */
export const RewriteDetail: React.FC<RewriteDetailProps> = ({
  slotted,
  onBack,
  onManageModels,
}) => {
  const { t } = useTranslation();
  const osType = useOsType();
  const { getSetting, refreshSettings } = useSettings();
  const { modelName, usesProvider } = useRewrites();
  const [rewrite, setRewrite] = useState<LLMPrompt>(slotted.rewrite);
  const samples = rewrite.samples ?? [];
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState<ExampleView>("changes");
  const [running, setRunning] = useState(false);
  const builtin = isBuiltin(rewrite.id);
  const key = builtin ? builtinKey(rewrite.id) : "custom";
  const exampleBefore = t(`rewrite.builtin.${builtin ? key : "polish"}.before`);
  const [exampleAfter, setExampleAfter] = useState(
    t(`rewrite.builtin.${builtin ? key : "polish"}.after`),
  );
  const saveTimer = useRef<number | undefined>(undefined);
  const binding = getSetting("bindings")?.[`refine_${slotted.slot}`];

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  /** Saves now, or after a pause for typing. */
  const save = (next: LLMPrompt, delay = 0) => {
    setRewrite(next);
    setSaved(false);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const result = await commands.saveRewrite(next);
      if (result.status === "ok") {
        setSaved(true);
        await refreshSettings();
      }
    }, delay);
  };

  const reset = async () => {
    const result = await commands.resetRewrite(rewrite.id);
    if (result.status === "ok") {
      setRewrite(result.data);
      setSaved(true);
      await refreshSettings();
    }
  };

  const remove = async () => {
    await commands.deleteRewrite(rewrite.id);
    await refreshSettings();
    onBack();
  };

  const run = async () => {
    setRunning(true);
    const result = await commands.runRewrite(rewrite.id, exampleBefore);
    setRunning(false);
    if (result.status === "ok") {
      setExampleAfter(result.data);
      setView("changes");
    } else if (result.error === "no_model") {
      onManageModels();
    } else {
      notify({ level: "error", title: t("rewrite.runFailed") });
    }
  };

  const addSample = async () => {
    const picked = await open({
      multiple: false,
      filters: [
        {
          name: t("rewrite.samples.filter"),
          extensions: ["txt", "md", "markdown"],
        },
      ],
    });
    if (typeof picked !== "string") return;
    try {
      const text = await readTextFile(picked);
      const words = text.split(/\s+/).filter(Boolean);
      const name = picked.split(/[\\/]/).pop() ?? picked;
      save({
        ...rewrite,
        samples: [
          ...samples,
          { name, text: words.slice(0, SAMPLE_MAX_WORDS).join(" ") },
        ],
      });
      if (words.length > SAMPLE_MAX_WORDS) {
        notify({
          level: "warning",
          title: t("rewrite.samples.trimmed", { max: SAMPLE_MAX_WORDS }),
        });
      }
    } catch (e) {
      notify({
        level: "error",
        title: t("rewrite.samples.readFailed"),
        detail: String(e),
      });
    }
  };

  const name = rewrite.name;
  const options = rewrite.options;

  return (
    <>
      <PageHeader
        back={{ label: t("sidebar.rewrite"), onClick: onBack }}
        title={name}
        right={
          <div className="flex items-center gap-3">
            {saved && (
              <span className="g-saved">
                <i className="g-ic g-i-check" aria-hidden="true" />
                {t("rewrite.detail.saved")}
              </span>
            )}
            {builtin ? (
              <button
                type="button"
                className="g-btn ghost sm cursor-pointer"
                onClick={reset}
              >
                <i className="g-ic g-i-again" aria-hidden="true" />
                {t("rewrite.detail.reset")}
              </button>
            ) : (
              <button
                type="button"
                className="g-btn danger sm cursor-pointer"
                onClick={remove}
              >
                <i className="g-ic g-i-trash" aria-hidden="true" />
                {t("rewrite.detail.delete")}
              </button>
            )}
          </div>
        }
      />

      <div className="g-rwdetail">
        <div className="g-rwleft">
          <span className="g-usechip">
            {binding && (
              <Keycaps
                binding={binding.current_binding}
                osType={osType}
                size="line"
              />
            )}
            {t(`rewrite.builtin.${key}.chip`, { name })}
          </span>
          <p className="m-0 text-[14px] leading-[1.6] text-ink-2">
            {builtin
              ? t(`rewrite.builtin.${key}.about`)
              : t("rewrite.builtin.custom.about", { name })}
          </p>
          <div className="g-rule m-0" />
          <h2 className="g-h2i text-[17px]">{t("rewrite.detail.example")}</h2>
          <Tabs
            size="sm"
            label={t("rewrite.detail.exampleView")}
            value={view}
            onChange={setView}
            options={[
              { value: "before", label: t("rewrite.detail.before") },
              { value: "after", label: t("rewrite.detail.after") },
              { value: "changes", label: t("rewrite.detail.changes") },
            ]}
          />
          <p className="g-extext select-text" aria-live="polite">
            {view === "before" ? (
              exampleBefore
            ) : view === "after" ? (
              exampleAfter
            ) : (
              <DiffText before={exampleBefore} after={exampleAfter} />
            )}
          </p>
          <button
            type="button"
            className="g-btn sec cursor-pointer self-start disabled:opacity-60"
            onClick={run}
            disabled={running}
          >
            <i className="g-ic g-i-play" aria-hidden="true" />
            {running ? t("rewrite.detail.running") : t("rewrite.detail.run")}
          </button>
        </div>

        <div className="g-rwright">
          {!builtin && (
            <SettingsGroup title={t("rewrite.detail.nameTitle")}>
              <div className="g-row stack">
                <label className="sr-only" htmlFor="rewrite-name">
                  {t("rewrite.detail.nameTitle")}
                </label>
                <input
                  id="rewrite-name"
                  className="g-field wide"
                  value={rewrite.name}
                  onChange={(e) =>
                    save({ ...rewrite, name: e.target.value }, 500)
                  }
                />
              </div>
            </SettingsGroup>
          )}

          <SettingsGroup title={t("rewrite.detail.shortcutTitle")}>
            <ShortcutInput
              shortcutId={`refine_${slotted.slot}`}
              grouped
              title={t("rewrite.detail.shortcutName", { name })}
              description={t("rewrite.detail.shortcutHint")}
            />
          </SettingsGroup>

          {options ? (
            <SettingsGroup title={t("rewrite.detail.doesTitle", { name })}>
              {OPTION_KEYS.map((option) => (
                <SettingContainer
                  key={option}
                  title={t(`rewrite.options.${option}`)}
                  description=""
                  grouped
                >
                  <Switch
                    checked={options[option]}
                    onChange={(on) =>
                      save({
                        ...rewrite,
                        options: { ...options, [option]: on },
                      })
                    }
                    ariaLabel={t(`rewrite.options.${option}`)}
                  />
                </SettingContainer>
              ))}
            </SettingsGroup>
          ) : (
            <SettingsGroup
              title={t("rewrite.detail.instructionsTitle")}
              description={t("rewrite.detail.instructionsHint")}
            >
              <div className="g-row stack">
                <label className="sr-only" htmlFor="rewrite-instructions">
                  {t("rewrite.detail.instructionsTitle")}
                </label>
                <textarea
                  id="rewrite-instructions"
                  className="g-area min-h-[120px]"
                  value={rewrite.prompt}
                  placeholder={t("rewrite.detail.instructionsPlaceholder")}
                  onChange={(e) =>
                    save({ ...rewrite, prompt: e.target.value }, 600)
                  }
                />
              </div>
            </SettingsGroup>
          )}

          <SettingsGroup title={t("rewrite.detail.extraTitle")}>
            <div className="g-row stack">
              <label className="sr-only" htmlFor="rewrite-extra">
                {t("rewrite.detail.extraTitle")}
              </label>
              <textarea
                id="rewrite-extra"
                className="g-area min-h-[96px]"
                value={rewrite.extra_instructions ?? ""}
                placeholder={t("rewrite.detail.extraPlaceholder", { name })}
                onChange={(e) =>
                  save({ ...rewrite, extra_instructions: e.target.value }, 600)
                }
              />
            </div>
          </SettingsGroup>

          <SettingsGroup
            title={t("rewrite.samples.title")}
            description={t("rewrite.samples.hint", { name })}
          >
            {samples.map((sample, index) => (
              <div className="g-row min-h-14" key={`${sample.name}-${index}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <i className="g-ic g-i-doc text-ink-3" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">
                      {sample.name}
                    </div>
                    <div className="g-rd m-0">
                      {t("rewrite.samples.words", {
                        count: countWords(sample.text),
                      })}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="g-ib cursor-pointer"
                  aria-label={t("rewrite.samples.remove", {
                    name: sample.name,
                  })}
                  onClick={() =>
                    save({
                      ...rewrite,
                      samples: samples.filter((_, i) => i !== index),
                    })
                  }
                >
                  <i className="g-ic g-i-trash" aria-hidden="true" />
                </button>
              </div>
            ))}
            <div className="g-row min-h-14">
              <span className="g-rd m-0">
                {t("rewrite.samples.limit", {
                  max: SAMPLE_MAX_WORDS.toLocaleString(),
                })}
              </span>
              <button
                type="button"
                className="g-btn sec sm cursor-pointer"
                onClick={addSample}
              >
                <i className="g-ic g-i-upload" aria-hidden="true" />
                {t("rewrite.samples.add")}
              </button>
            </div>
          </SettingsGroup>

          <SettingsGroup title={t("rewrite.detail.modelTitle")}>
            <SettingContainer
              title={t("rewrite.detail.runsOn")}
              description={
                modelName
                  ? usesProvider
                    ? t("rewrite.detail.runsOnProvider", { model: modelName })
                    : t("rewrite.detail.runsOnLocal", { model: modelName })
                  : t("rewrite.detail.noModel")
              }
              grouped
            >
              <button
                type="button"
                className="g-btn sec cursor-pointer"
                onClick={onManageModels}
              >
                {t("rewrite.detail.change")}
              </button>
            </SettingContainer>
          </SettingsGroup>
        </div>
      </div>
    </>
  );
};
