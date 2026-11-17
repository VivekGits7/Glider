import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/common/ui/Tooltip";
import { useShallow } from "zustand/react/shallow";
import { useModelStore } from "@/features/stt/store/modelStore";
import { downloadStateOf } from "@/features/stt/lib/downloadState";
import { speedLevel } from "@/common/shared/SpeedBars";
import { languageName } from "@/common/lib/languages";
import { formatModelSize, estimateMemory } from "@/common/lib/format";
import type { WorkerMemory } from "@/bindings";
import { LiveMemory } from "@/common/shared/LiveMemory";
import RetiredModelsNotice from "./RetiredModelsNotice";
import { Legend } from "./Legend";
import {
  cancelDownload,
  pickModel,
  useIsTarget,
  useModelEntries,
  usePlace,
  type Entry,
  type Facts,
} from "./modelEntries";

/** Rows shown under "For your languages" before "Show N more". */
const FITS_SHOWN = 4;

const SPEED_KEYS = [
  "verySlow",
  "slow",
  "moderate",
  "fast",
  "veryFast",
] as const;

/** Language, quality, speed, size and memory: the same five on every tab. */
const gridStyle: React.CSSProperties = {
  gridTemplateColumns: "72px 56px 80px 64px 72px",
};

const Columns: React.FC = () => {
  const { t } = useTranslation();
  return (
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
};

const ModelLine: React.FC<{
  entry: Entry;
  facts: Facts;
  live: WorkerMemory | null | undefined;
}> = ({ entry, facts, live }) => {
  const { t, i18n } = useTranslation();
  const place = usePlace(entry.id);
  const target = useIsTarget(entry.id);
  const download = useModelStore(
    useShallow((s) => downloadStateOf(s, entry.id)),
  );
  const remove = () => useModelStore.getState().deleteModel(entry.id);
  const wait = facts.wait(entry.model);
  const speed =
    wait == null
      ? "–"
      : t(`settings.models.speed.${SPEED_KEYS[speedLevel(wait)]}`);
  const size = formatModelSize(entry.sizeMb);
  // One grade across your languages; "–" if it misses one of them.
  const grade = facts.overall(entry.model);
  const language =
    entry.languages.length === 1
      ? languageName(entry.languages[0], i18n.language)
      : entry.languages.length > 1
        ? t("settings.models.llm.multilingual")
        : "–";

  const downloading = download.state === "downloading";
  const progress = downloading ? download.progress : 0;

  return (
    <div className="g-mrow">
      <div className="min-w-0">
        <div className="g-mname flex-wrap">
          <span className="truncate">{entry.name}</span>
          {place === "active" && (
            <span className="g-badge">{t("settings.models.inUse")}</span>
          )}
          {place === "loading" && (
            <span className="g-badge plain">
              {t("settings.models.loading")}
            </span>
          )}
          {entry.streaming && place !== "active" && (
            <span className="g-badge plain">
              {t("settings.models.livePreview")}
            </span>
          )}
        </div>
        {downloading || download.state === "checking" ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="g-prog w-[150px]">
              <i style={{ width: `${Math.max(progress * 100, 2)}%` }} />
            </div>
            <span className="text-[13px] text-ink-2 tabular-nums">
              {download.state === "checking"
                ? t("settings.models.checking")
                : t(
                    target
                      ? "settings.models.progressThenSwitch"
                      : "settings.models.progress",
                    { percent: Math.round(progress * 100), size },
                  )}
            </span>
          </div>
        ) : (
          entry.description && (
            <div className="g-mdesc">{entry.description}</div>
          )
        )}
      </div>
      <div className="g-mside">
        <div className="g-mgrid" style={gridStyle}>
          <span className="text-[13px] text-ink-2">{language}</span>
          {grade.letter === "none" ? (
            <span className="g-grade na" title={t("settings.models.noGrade")}>
              –
            </span>
          ) : (
            <span className="g-grade">{grade.letter}</span>
          )}
          <span className="text-[13px] text-ink-2">{speed}</span>
          <span className="g-size">{size}</span>
          {place === "active" && live !== undefined ? (
            <LiveMemory live={live} modelId={entry.id} />
          ) : (
            <span className="g-size">{estimateMemory(entry.sizeMb)}</span>
          )}
        </div>
        <div className="flex w-[176px] items-center justify-end gap-2">
          {downloading || download.state === "checking" ? (
            <Tooltip
              title={t("settings.models.cancelDownload", {
                name: entry.name,
              })}
              text={t("settings.models.cancelDeletes")}
            >
              <button
                type="button"
                className="g-ib cursor-pointer"
                aria-label={t("settings.models.cancelDownload", {
                  name: entry.name,
                })}
                onClick={() => cancelDownload(entry.id)}
              >
                <i className="g-ic g-i-x" aria-hidden="true" />
              </button>
            </Tooltip>
          ) : place === "remote" ? (
            <button
              type="button"
              className="g-btn sec sm cursor-pointer"
              onClick={() => pickModel(entry.id)}
            >
              <i className="g-ic g-i-download" aria-hidden="true" />
              {t("settings.models.downloadAndUse")}
            </button>
          ) : (
            <>
              {place === "ready" && (
                <button
                  type="button"
                  className="g-btn sec sm cursor-pointer"
                  onClick={() => pickModel(entry.id)}
                >
                  {t("settings.models.use")}
                </button>
              )}
              <button
                type="button"
                className="g-ib cursor-pointer disabled:opacity-30"
                disabled={place === "loading"}
                aria-label={t("settings.models.delete", { name: entry.name })}
                title={t("settings.models.delete", { name: entry.name })}
                onClick={remove}
              >
                <i className="g-ic g-i-trash" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/** Speech-to-text models: the ones on this computer, then picks for the
 * user's languages, graded per language. */
/** Live memory of the speech loaded model: `undefined` until known, `null`
 * when nothing is loaded. */
export const SpeechModels: React.FC<{
  query: string;
  live: WorkerMemory | null | undefined;
}> = ({ query, live }) => {
  const { t, i18n } = useTranslation();
  const loading = useModelStore((s) => s.loading);
  const { facts, lists } = useModelEntries();
  const [more, setMore] = useState(false);
  // Fresh list on every visit, like the other tabs; also recovers a first
  // load that never came back.
  useEffect(() => {
    void useModelStore.getState().loadModels();
  }, []);

  if (loading) {
    return <div className="h-40" aria-busy="true" />;
  }

  const q = query.trim().toLowerCase();
  const matches = (e: Entry) =>
    !q ||
    e.name.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q);
  const yours = lists.yours.filter(matches);
  const rest = [
    ...lists.fits,
    ...lists.partial,
    ...(q ? lists.untested : []),
  ].filter(matches);
  const shown = q || more ? rest : rest.slice(0, FITS_SHOWN);
  const hidden = rest.length - shown.length;
  const languages = new Intl.ListFormat(i18n.language, {
    type: "conjunction",
  }).format(facts.langs.map((l) => languageName(l, i18n.language)));

  return (
    <>
      <RetiredModelsNotice />
      <section className="g-group">
        <div className="g-ghead">
          <h2 className="g-gt">{t("settings.models.sections.yours")}</h2>
        </div>
        {yours.length > 0 ? (
          <>
            <Columns />
            <div className="g-card">
              {yours.map((e) => (
                <ModelLine key={e.id} entry={e} facts={facts} live={live} />
              ))}
            </div>
          </>
        ) : (
          <p className="g-card m-0 px-5 py-4 text-[14px] text-ink-2">
            {q ? t("settings.models.noMatch") : t("settings.models.emptyYours")}
          </p>
        )}
      </section>

      {rest.length > 0 && (
        <section className="g-group">
          <div className="g-ghead">
            <h2 className="g-gt">{t("settings.models.sections.fits")}</h2>
            <p className="g-gd">
              {t("settings.models.fitsHint", { languages })}
            </p>
          </div>
          <Columns />
          <div className="g-card">
            {shown.map((e) => (
              <ModelLine key={e.id} entry={e} facts={facts} live={live} />
            ))}
          </div>
          <div className="mx-1 flex items-center justify-between">
            {hidden > 0 || more ? (
              <button
                type="button"
                className="g-link cursor-pointer"
                onClick={() => setMore(!more)}
              >
                {more
                  ? t("settings.models.showFewer")
                  : t("settings.models.showMore", { count: hidden })}
              </button>
            ) : (
              <span />
            )}
            <Legend tier={facts.tier} trigger="link" />
          </div>
        </section>
      )}
    </>
  );
};
