import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type TtsModelInfo } from "@/bindings";
import { modelLanguage, useVoiceModels } from "../hooks/useVoiceModels";
import { languageName } from "@/common/lib/languages";
import { notify } from "@/common/notices/noticeStore";
import { useSettings } from "@/common/settings/useSettings";
import { Dropdown } from "@/common/ui/Dropdown";
import { Tooltip } from "@/common/ui/Tooltip";
import { estimateMemory, formatModelSize } from "@/common/lib/format";
import type { WorkerMemory } from "@/bindings";
import { LiveMemory } from "@/common/shared/LiveMemory";

const gridStyle: React.CSSProperties = {
  gridTemplateColumns: "72px 56px 80px 64px 72px",
};

const ACTIONS = "flex w-[380px] items-center justify-end gap-2";

/** Read Aloud voices: the ones on this computer, then more to download.
 * `live` is the loaded voice's memory: `undefined` until known, `null` when
 * nothing is loaded. */
export const VoiceModelsTab: React.FC<{
  query: string;
  live: WorkerMemory | null | undefined;
}> = ({ query, live }) => {
  const { t, i18n } = useTranslation();
  const {
    models,
    refresh,
    selected,
    selectModel,
    languageOf: readingLanguage,
    voicesOf,
    voiceOf,
    languageOptions,
    setLanguage,
  } = useVoiceModels();
  const { updateSetting } = useSettings();
  // The model whose sample is playing, until the speech ends.
  const [sampling, setSampling] = useState<string | null>(null);

  useEffect(() => {
    if (!sampling) return;
    let heard = false;
    const started = Date.now();
    const id = setInterval(async () => {
      const now = await commands.isSpeaking();
      if (now) heard = true;
      // The voice loads before it speaks; give up if it never starts.
      else if (heard || Date.now() - started > 10000) setSampling(null);
    }, 300);
    return () => clearInterval(id);
  }, [sampling]);

  const sample = (model: TtsModelInfo) => {
    if (sampling === model.id) {
      commands.stopSpeaking();
      setSampling(null);
      return;
    }
    setSampling(model.id);
    commands.speakVoiceSample(model.id);
  };

  const pickVoice = async (model: TtsModelInfo, index: number) => {
    if (model.id !== selected?.id) await updateSetting("tts_model", model.id);
    await updateSetting("tts_voice", index);
  };

  const download = async (model: TtsModelInfo) => {
    const run = commands.downloadTtsModel(model.id);
    // Progress lives in Rust; show it right away.
    setTimeout(refresh, 150);
    const result = await run;
    await refresh();
    if (result.status === "error") {
      notify({
        level: "error",
        title: t("settings.readAloud.models.downloadFailed"),
        detail: result.error,
      });
    } else {
      await selectModel(model.id);
    }
  };

  const remove = async (model: TtsModelInfo) => {
    await commands.deleteTtsModel(model.id);
    await refresh();
  };

  const row = (model: TtsModelInfo) => {
    const inUse = selected?.id === model.id;
    const percent =
      model.total_bytes > 0
        ? Math.round((model.downloaded_bytes / model.total_bytes) * 100)
        : 0;
    return (
      <div className="g-mrow" key={model.id}>
        <div className="min-w-0">
          <div className="g-mname">
            {model.name}
            {inUse && (
              <span className="g-badge">{t("settings.models.inUse")}</span>
            )}
          </div>
          {model.is_downloading ? (
            // Like Speech to text: the download takes the description's
            // place, and the voice is used once it finishes.
            <div className="mt-2 flex items-center gap-3">
              <div className="g-prog w-[150px]">
                <i style={{ width: `${Math.max(percent, 2)}%` }} />
              </div>
              <span className="text-[13px] text-ink-2 tabular-nums">
                {t("settings.models.progressThenSwitch", {
                  percent,
                  size: `${model.size_mb} MB`,
                })}
              </span>
            </div>
          ) : (
            <div className="g-mdesc">{model.description}</div>
          )}
        </div>
        <div className="g-mside">
          <div className="g-mgrid" style={gridStyle}>
            <span className="text-[13px] text-ink-2">
              {modelLanguage(model, i18n.language)}
            </span>
            <span className="g-grade">{model.quality}</span>
            <span className="text-[13px] text-ink-2">
              {t(
                `settings.models.speed.${model.speed === "very_fast" ? "veryFast" : model.speed}`,
              )}
            </span>
            <span className="g-size">{formatModelSize(model.size_mb)}</span>
            {inUse && live !== undefined ? (
              <LiveMemory live={live} modelId={model.id} />
            ) : (
              <span className="g-size">{estimateMemory(model.size_mb)}</span>
            )}
          </div>
          <div className={ACTIONS}>
            {model.is_downloading ? (
              <Tooltip
                title={t("settings.models.cancelDownload", {
                  name: model.name,
                })}
                text={t("settings.models.cancelDeletes")}
              >
                <button
                  type="button"
                  className="g-ib cursor-pointer"
                  aria-label={t("settings.models.cancelDownload", {
                    name: model.name,
                  })}
                  onClick={async () => {
                    await commands.cancelTtsDownload(model.id);
                    setTimeout(refresh, 200);
                  }}
                >
                  <i className="g-ic g-i-x" aria-hidden="true" />
                </button>
              </Tooltip>
            ) : model.is_downloaded ? (
              <>
                {/* One pill: the voice, its sample button, then the arrow. */}
                {model.voices.length > 1 ? (
                  <div className="relative">
                    <Dropdown
                      className="w-[150px] [&_.g-sel]:h-8 [&_.g-sel]:min-w-0 [&_.g-sel_.g-i-chev]:ms-7 [&_button]:text-[13px]"
                      tone="neutral"
                      options={voicesOf(model).map(({ name, index }) => ({
                        value: String(index),
                        label: name,
                      }))}
                      selectedValue={String(voiceOf(model))}
                      onSelect={(value) => pickVoice(model, Number(value))}
                    />
                    <button
                      type="button"
                      className="absolute end-8 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-ink-2 hover:bg-wash hover:text-text"
                      aria-pressed={sampling === model.id}
                      aria-label={t("settings.models.sample")}
                      title={t("settings.models.sample")}
                      onClick={() => sample(model)}
                    >
                      <i
                        className={`g-ic size-3.5 ${sampling === model.id ? "g-i-stop text-accent-ink" : "g-i-play"}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="g-ib cursor-pointer"
                    aria-pressed={sampling === model.id}
                    aria-label={t("settings.models.sample")}
                    title={t("settings.models.sample")}
                    onClick={() => sample(model)}
                  >
                    <i
                      className={`g-ic size-3.5 ${sampling === model.id ? "g-i-stop text-accent-ink" : "g-i-play"}`}
                      aria-hidden="true"
                    />
                  </button>
                )}
                {model.languages.length > 1 && (
                  <Dropdown
                    className="w-[118px] [&_.g-sel]:h-8 [&_.g-sel]:min-w-0 [&_button]:text-[13px]"
                    tone="neutral"
                    options={languageOptions(model)}
                    selectedValue={readingLanguage(model)}
                    onSelect={(value) => setLanguage(model, value)}
                  />
                )}
                {!inUse && (
                  <button
                    type="button"
                    className="g-btn sec sm cursor-pointer"
                    onClick={() => selectModel(model.id)}
                  >
                    {t("settings.models.use")}
                  </button>
                )}
                <button
                  type="button"
                  className="g-ib cursor-pointer"
                  aria-label={t("settings.models.delete", { name: model.name })}
                  title={t("settings.models.delete", { name: model.name })}
                  onClick={() => remove(model)}
                >
                  <i className="g-ic g-i-trash" aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="g-btn sec sm cursor-pointer"
                onClick={() => download(model)}
              >
                <i className="g-ic g-i-download" aria-hidden="true" />
                {t("settings.models.downloadAndUse")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const head = (
    <div className="g-mhead items-center">
      <span>{t("settings.models.columns.model")}</span>
      <div className="g-mside">
        <div className="g-mgrid" style={gridStyle}>
          <span>{t("settings.models.columns.language")}</span>
          <span>{t("settings.models.columns.quality")}</span>
          <span>{t("modelTable.speed")}</span>
          <span>{t("modelTable.size")}</span>
          <span>{t("settings.models.columns.memory")}</span>
        </div>
        <span className="w-[380px]" />
      </div>
    </div>
  );

  const q = query.trim().toLowerCase();
  const shown = models.filter(
    (m) =>
      !q ||
      [
        m.name,
        m.description,
        modelLanguage(m, i18n.language),
        ...m.languages.map((code) => languageName(code, i18n.language)),
      ].some((s) => s.toLowerCase().includes(q)),
  );
  const onDisk = shown.filter((m) => m.is_downloaded);
  const more = shown.filter((m) => !m.is_downloaded);
  // The voice in use comes first.
  onDisk.sort(
    (a, b) => Number(b.id === selected?.id) - Number(a.id === selected?.id),
  );

  return (
    <>
      <section className="g-group">
        <div className="g-ghead">
          <h2 className="g-gt">{t("settings.models.sections.yours")}</h2>
        </div>
        {onDisk.length ? (
          <>
            {head}
            <div className="g-card">{onDisk.map(row)}</div>
          </>
        ) : (
          <p className="g-card m-0 px-5 py-4 text-[14px] text-ink-2">
            {q ? t("settings.models.noMatch") : t("settings.models.noVoices")}
          </p>
        )}
      </section>
      {more.length > 0 && (
        <section className="g-group">
          <div className="g-ghead">
            <h2 className="g-gt">{t("settings.models.moreVoices")}</h2>
            <p className="g-gd">{t("settings.models.moreVoicesHint")}</p>
          </div>
          {head}
          <div className="g-card">{more.map(row)}</div>
        </section>
      )}
    </>
  );
};
