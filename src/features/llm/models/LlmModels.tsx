import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type LlmModelInfo, type WorkerMemory } from "@/bindings";
import { LiveMemory } from "@/common/shared/LiveMemory";
import { useSettings } from "@/common/settings/useSettings";
import { notify } from "@/common/notices/noticeStore";
import { SettingsGroup } from "@/common/ui/SettingsGroup";
import { SettingContainer } from "@/common/ui/SettingContainer";
import { Switch } from "@/common/ui/Switch";
import { Tooltip } from "@/common/ui/Tooltip";
import { PostProcessingSettingsApi } from "../provider/PostProcessingSettingsApi";

const gridStyle: React.CSSProperties = {
  gridTemplateColumns: "72px 56px 80px 64px 72px",
};

/** The LLMs Rewrite can run on this computer, and the provider instead. */
/** Live memory of the LLM loaded model: `undefined` until known, `null`
 * when nothing is loaded. */
export const LlmModels: React.FC<{
  query: string;
  live: WorkerMemory | null | undefined;
}> = ({ query, live }) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, refreshSettings } = useSettings();
  const [models, setModels] = useState<LlmModelInfo[]>([]);

  const refresh = useCallback(async () => {
    setModels(await commands.getLlmModels());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const downloading = models.some((m) => m.is_downloading);

  useEffect(() => {
    if (!downloading) return;
    const id = setInterval(refresh, 500);
    return () => clearInterval(id);
  }, [downloading, refresh]);

  const usesProvider = getSetting("llm_use_provider") ?? false;
  const chosen = getSetting("llm_model") ?? "";

  const download = async (model: LlmModelInfo) => {
    const run = commands.downloadLlmModel(model.id);
    setTimeout(refresh, 200);
    const result = await run;
    await refresh();
    await refreshSettings();
    if (result.status === "ok") await use(model);
    if (result.status === "error") {
      notify({
        level: "error",
        title: t("settings.models.llm.downloadFailed"),
        detail: result.error,
      });
    }
  };

  const use = async (model: LlmModelInfo) => {
    await updateSetting("llm_model", model.id);
    if (usesProvider) await updateSetting("llm_use_provider", false);
  };

  const remove = async (model: LlmModelInfo) => {
    await commands.deleteLlmModel(model.id);
    await refresh();
    await refreshSettings();
  };

  const speed = (s: LlmModelInfo["speed"]) =>
    t(`settings.models.speed.${s === "very_fast" ? "veryFast" : s}`);

  const row = (model: LlmModelInfo) => {
    const inUse = model.is_downloaded && model.id === chosen && !usesProvider;
    // Decimal GB, as Hugging Face lists these files.
    const size =
      model.size_bytes >= 1e9
        ? `${(model.size_bytes / 1e9).toFixed(1)} GB`
        : `${Math.round(model.size_bytes / 1e6)} MB`;
    const percent =
      model.total_bytes > 0
        ? Math.round((model.downloaded_bytes / model.total_bytes) * 100)
        : 0;
    return (
      <div className="g-mrow" key={model.id}>
        <div className="min-w-0">
          <div className="g-mname flex-wrap">
            {model.name}
            {inUse && (
              <span className="g-badge">{t("settings.models.inUse")}</span>
            )}
            {!model.is_downloaded && model.older_computers && (
              <span className="g-badge plain">
                {t("settings.models.llm.olderComputers")}
              </span>
            )}
            {!model.is_downloaded && !model.fits_memory && (
              <span className="g-badge plain">
                {t("settings.models.llm.needsMemory")}
              </span>
            )}
          </div>
          {model.is_downloading ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="g-prog w-[150px]">
                <i style={{ width: `${Math.max(percent, 2)}%` }} />
              </div>
              <span className="text-[13px] text-ink-2 tabular-nums">
                {t("settings.models.progressThenSwitch", { percent, size })}
              </span>
            </div>
          ) : (
            <div className="g-mdesc">{model.description}</div>
          )}
        </div>
        <div className="g-mside">
          <div className="g-mgrid" style={gridStyle}>
            {/* Every model in the catalog is multilingual. */}
            <span className="text-[13px] text-ink-2">
              {t("settings.models.llm.multilingual")}
            </span>
            <span className="g-grade">{model.quality}</span>
            <span className="text-[13px] text-ink-2">{speed(model.speed)}</span>
            <span className="g-size">{size}</span>
            {inUse && live !== undefined ? (
              <LiveMemory live={live} modelId={model.id} />
            ) : (
              <span className="g-size">
                {t("settings.models.llm.gb", { n: model.memory_gb })}
              </span>
            )}
          </div>
          <div className="flex w-[176px] items-center justify-end gap-2">
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
                    await commands.cancelLlmDownload(model.id);
                    setTimeout(refresh, 300);
                  }}
                >
                  <i className="g-ic g-i-x" aria-hidden="true" />
                </button>
              </Tooltip>
            ) : model.is_downloaded ? (
              <>
                {!inUse && (
                  <button
                    type="button"
                    className="g-btn sec sm cursor-pointer"
                    onClick={() => use(model)}
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
        <span className="w-[176px]" />
      </div>
    </div>
  );

  const q = query.trim().toLowerCase();
  const shown = models.filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q),
  );
  const onDisk = shown.filter((m) => m.is_downloaded);
  // What fits this computer first, the catalog's order within.
  const more = shown
    .filter((m) => !m.is_downloaded)
    .sort((a, b) => Number(b.fits_memory) - Number(a.fits_memory));

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
            {q ? t("settings.models.noMatch") : t("settings.models.llm.none")}
          </p>
        )}
      </section>
      {more.length > 0 && (
        <section className="g-group">
          <div className="g-ghead">
            <h2 className="g-gt">{t("settings.models.llm.moreTitle")}</h2>
            <p className="g-gd">{t("settings.models.llm.moreHint")}</p>
          </div>
          {head}
          <div className="g-card">{more.map(row)}</div>
        </section>
      )}
      <SettingsGroup title={t("settings.models.llm.providerTitle")}>
        <SettingContainer
          title={t("settings.models.llm.useProvider")}
          description={t("settings.models.llm.useProviderHint")}
          grouped
        >
          <Switch
            checked={usesProvider}
            onChange={(on) => updateSetting("llm_use_provider", on)}
            ariaLabel={t("settings.models.llm.useProvider")}
          />
        </SettingContainer>
        <div
          className={usesProvider ? "" : "pointer-events-none opacity-50"}
          aria-disabled={!usesProvider}
        >
          <div className="g-rows">
            <PostProcessingSettingsApi />
          </div>
        </div>
      </SettingsGroup>
    </>
  );
};
