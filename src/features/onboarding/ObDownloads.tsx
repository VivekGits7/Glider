import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type LlmModelInfo, type TtsModelInfo } from "@/bindings";
import type { CatalogModel } from "@/features/stt/lib/catalog";
import { cancelDownload } from "@/features/stt/models/modelEntries";
import type { useOnboardingModels } from "./useOnboardingModels";

/* ---------------- voices download one after another ---------------- */

let voiceQueue: string[] = [];
let voiceRunning = false;

const runVoiceQueue = async () => {
  if (voiceRunning) return;
  voiceRunning = true;
  while (voiceQueue.length) {
    const id = voiceQueue[0];
    await commands.downloadTtsModel(id).catch(() => undefined);
    voiceQueue = voiceQueue.filter((v) => v !== id);
  }
  voiceRunning = false;
};

/** Downloads these voices, in order, behind any already queued. */
export const queueVoices = (ids: string[]) => {
  for (const id of ids) if (!voiceQueue.includes(id)) voiceQueue.push(id);
  void runVoiceQueue();
};

/** Drops a voice: stops it if it's downloading, or takes it off the queue. */
export const unqueueVoice = (id: string) => {
  if (voiceQueue[0] === id) void commands.cancelTtsDownload(id);
  voiceQueue = voiceQueue.filter((v) => v !== id);
};

const queuedVoices = () => voiceQueue;

/* ---------------- the card ---------------- */

/** Bytes per second, from the last two looks at a download. */
const useRate = () => {
  const last = useRef(
    new Map<string, { bytes: number; at: number; rate: number }>(),
  );
  return (id: string, bytes: number) => {
    const now = Date.now();
    const prev = last.current.get(id);
    let rate = prev?.rate ?? 0;
    if (prev && now - prev.at > 400 && bytes >= prev.bytes) {
      const sample = ((bytes - prev.bytes) * 1000) / (now - prev.at);
      rate = rate ? rate * 0.7 + sample * 0.3 : sample;
      last.current.set(id, { bytes, at: now, rate });
    } else if (!prev) {
      last.current.set(id, { bytes, at: now, rate: 0 });
    }
    return rate;
  };
};

/** Voice and LLM lists, polled while this screen is up. */
export const useLocalModels = () => {
  const [voices, setVoices] = useState<TtsModelInfo[]>([]);
  const [llms, setLlms] = useState<LlmModelInfo[]>([]);
  const refresh = useCallback(async () => {
    const [v, l] = await Promise.all([
      commands.getTtsModels(),
      commands.getLlmModels(),
    ]);
    setVoices(v);
    setLlms(l);
  }, []);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 600);
    return () => clearInterval(id);
  }, [refresh]);
  return { voices, llms, refresh };
};

interface ObDownloadsProps {
  models: ReturnType<typeof useOnboardingModels>;
  /** The dictation model being fetched (catalog). */
  dictation?: CatalogModel;
  voices: TtsModelInfo[];
  /** Voices picked on Voices, in order. */
  voiceIds: string[];
  llms: LlmModelInfo[];
  llmId: string | null;
}

/** What's downloading from onboarding's picks, and what's ready. Hidden
 * until something was picked. */
export const ObDownloads: React.FC<ObDownloadsProps> = ({
  models,
  dictation,
  voices,
  voiceIds,
  llms,
  llmId,
}) => {
  const { t } = useTranslation();
  const rate = useRate();
  const mb = (bytes: number) => Math.round(bytes / 1_048_576);
  const left = (bytes: number, total: number, perSec: number) => {
    if (!perSec || total <= bytes) return null;
    const minutes = (total - bytes) / perSec / 60;
    return minutes < 1
      ? t("onboarding.downloads.underMinute")
      : minutes < 2
        ? t("onboarding.downloads.oneMinute")
        : t("onboarding.downloads.minutes", { count: Math.round(minutes) });
  };

  const ready: string[] = [];
  const rows: React.ReactNode[] = [];

  if (dictation) {
    const state = models.downloadState(dictation);
    const info = models.infoFor(dictation);
    const name = info?.name ?? dictation.name;
    if (state.state === "ready") ready.push(name);
    else if (state.state === "downloading" || state.state === "checking") {
      const percent =
        state.state === "downloading" ? Math.round(state.progress * 100) : 100;
      const eta =
        state.state === "downloading" && state.etaSeconds
          ? state.etaSeconds < 60
            ? t("onboarding.downloads.underMinute")
            : t("onboarding.downloads.minutes", {
                count: Math.max(1, Math.round(state.etaSeconds / 60)),
              })
          : null;
      const status =
        state.state === "checking"
          ? t("onboarding.downloads.checking")
          : eta
            ? `${percent}% · ${eta}`
            : state.total > 0
              ? t("onboarding.downloads.ofSize", {
                  percent,
                  done: mb(state.downloaded),
                  total: mb(state.total),
                })
              : `${percent}%`;
      rows.push(
        <Row
          key="dictation"
          icon="mic"
          name={name}
          percent={percent}
          status={status}
          onCancel={() => info && cancelDownload(info.id)}
        />,
      );
    }
  }

  const picked = voiceIds
    .map((id) => voices.find((v) => v.id === id))
    .filter((v): v is TtsModelInfo => !!v);
  for (const v of picked) if (v.is_downloaded) ready.push(v.name);
  const pending = picked.filter((v) => !v.is_downloaded);
  const active = pending.find((v) => v.is_downloading) ?? null;
  if (active || pending.length) {
    const current = active ?? pending[0];
    const percent =
      current.total_bytes > 0
        ? Math.round((current.downloaded_bytes / current.total_bytes) * 100)
        : 0;
    const next = pending.find(
      (v) => v.id !== current.id && queuedVoices().includes(v.id),
    );
    const eta = left(
      current.downloaded_bytes,
      current.total_bytes,
      rate(current.id, current.downloaded_bytes),
    );
    rows.push(
      <Row
        key="voice"
        icon="audio"
        name={current.name}
        percent={percent}
        status={
          next
            ? t("onboarding.downloads.next", { percent, name: next.name })
            : eta
              ? `${percent}% · ${eta}`
              : `${percent}%`
        }
        onCancel={() => unqueueVoice(current.id)}
      />,
    );
  }

  const llm = llmId ? llms.find((m) => m.id === llmId) : undefined;
  if (llm?.is_downloaded) ready.push(llm.short_name);
  else if (llm?.is_downloading) {
    const percent =
      llm.total_bytes > 0
        ? Math.round((llm.downloaded_bytes / llm.total_bytes) * 100)
        : 0;
    const eta = left(
      llm.downloaded_bytes,
      llm.total_bytes,
      rate(llm.id, llm.downloaded_bytes),
    );
    rows.push(
      <Row
        key="llm"
        icon="sparkles"
        name={llm.short_name}
        percent={percent}
        status={
          eta
            ? `${percent}% · ${t("onboarding.downloads.about", { left: eta })}`
            : `${percent}%`
        }
        onCancel={() => commands.cancelLlmDownload(llm.id)}
      />,
    );
  }

  if (!rows.length && !ready.length) return null;
  // While only the first pick is downloading, the card shows just its row.
  const showReady = ready.length > 0 && (rows.length > 0 || ready.length > 0);

  return (
    <div className="g-dl" aria-label={t("onboarding.downloads.label")}>
      {showReady && (
        <div className="g-dlok">
          <i className="g-ic g-i-check" aria-hidden="true" />
          {t("onboarding.downloads.ready", { names: ready.join(", ") })}
        </div>
      )}
      {rows}
    </div>
  );
};

const Row: React.FC<{
  icon: string;
  name: string;
  percent: number;
  status: string;
  onCancel: () => void;
}> = ({ icon, name, percent, status, onCancel }) => {
  const { t } = useTranslation();
  return (
    <div className="g-dlr">
      <i className={`g-ic g-i-${icon}`} aria-hidden="true" />
      <span className="truncate">{name}</span>
      <div
        className="g-prog"
        role="progressbar"
        aria-label={name}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      <span className="st truncate">{status}</span>
      <button
        type="button"
        className="g-ib cursor-pointer"
        aria-label={t("onboarding.downloads.cancel", { name })}
        onClick={onCancel}
      >
        <i className="g-ic g-i-x" aria-hidden="true" />
      </button>
    </div>
  );
};
