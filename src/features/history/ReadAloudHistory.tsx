import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { commands, type ReadAloudEntry } from "@/bindings";
import { notify } from "@/common/notices/noticeStore";
import { formatDateTime } from "@/common/lib/dateFormat";
import { copyToClipboard } from "./clipboard";
import { dayLabel, formatTime, groupByDay } from "./dayGroups";
import { IconButton, StarButton } from "./HistorySettings";

/** Which sentence of a read is playing, as Rust reports it. */
export interface ReadingProgress {
  current: string;
  index: number;
  total: number;
}

const READS_KEPT = 200;

/** The read playing now, or `null`. `onProgress` runs on every new sentence. */
export const useReadingProgress = (onProgress: () => void) => {
  const [playing, setPlaying] = useState<ReadingProgress | null>(null);
  useEffect(() => {
    const offProgress = listen<ReadingProgress>("reading-progress", (e) => {
      setPlaying(e.payload);
      onProgress();
    });
    const offFinished = listen("read-aloud-finished", () => setPlaying(null));
    return () => {
      offProgress.then((off) => off());
      offFinished.then((off) => off());
    };
  }, [onProgress]);
  return playing;
};

/** The newest read is the one playing, when one is. */
export const playingReadId = (
  reads: ReadAloudEntry[],
  playing: ReadingProgress | null,
): number | null =>
  playing && reads.length && reads[0].text.includes(playing.current)
    ? reads[0].id
    : null;

/** One past read: read again (or stop), copy, delete. `playing` is set while
 * this read is the one being spoken. Home's Today list uses it too. */
export const ReadAloudRow: React.FC<{
  entry: ReadAloudEntry;
  playing: ReadingProgress | null;
  onChanged: () => void;
}> = ({ entry, playing, onChanged }) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!(await copyToClipboard(entry.text))) {
      notify({ title: t("settings.history.copyError") });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSaved = async () => {
    await commands.toggleReadAloudSaved(entry.id);
    onChanged();
  };

  const remove = async () => {
    const result = await commands.deleteReadAloudEntry(entry.id);
    if (result.status === "error") {
      notify({ title: t("settings.history.deleteError") });
    }
    onChanged();
  };

  return (
    <div className="g-li">
      <time
        className="g-time"
        title={formatDateTime(String(entry.timestamp), i18n.language)}
      >
        {formatTime(entry.timestamp, i18n.language)}
      </time>
      <div className="min-w-0">
        <p className="g-txt g-clamp select-text">{entry.text}</p>
        {playing ? (
          <p className="g-meta m-0 mt-1.5 text-accent-ink">
            <span className="g-bars sm" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            {t("settings.history.readAloud.playing", {
              index: playing.index + 1,
              total: playing.total,
            })}
          </p>
        ) : (
          <p className="g-meta m-0 mt-1.5">
            {t("settings.history.readAloud.meta", {
              voice: entry.voice,
              speed: entry.speed.toFixed(1),
            })}
          </p>
        )}
      </div>
      <div className="g-acts">
        {playing ? (
          <IconButton
            onClick={() => commands.stopSpeaking()}
            active
            icon="stop"
            title={t("settings.history.readAloud.stop")}
          />
        ) : (
          <IconButton
            onClick={() => commands.speakText(entry.text)}
            icon="again"
            title={t("settings.history.readAloud.readAgain")}
          />
        )}
        <IconButton
          onClick={copy}
          icon={copied ? "check" : "copy"}
          title={t("settings.history.copyToClipboard")}
        />
        <StarButton saved={entry.saved} onClick={toggleSaved} />
        <IconButton
          onClick={remove}
          icon="trash"
          title={t("settings.history.delete")}
        />
      </div>
    </div>
  );
};

/** Read Aloud's past reads, one card per day. The read playing now shows
 * which sentence it's on. */
export const ReadAloudHistory: React.FC<{
  tabs: React.ReactNode;
  savedOnly: boolean;
}> = ({ tabs, savedOnly }) => {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<ReadAloudEntry[] | null>(null);

  const load = useCallback(async () => {
    const result = await commands.getReadAloudHistory();
    setEntries(result.status === "ok" ? result.data : []);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const playing = useReadingProgress(load);
  const playingId = playingReadId(entries ?? [], playing);
  const shown = savedOnly ? entries?.filter((e) => e.saved) : entries;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        {tabs}
        <span className="g-small">
          {t("settings.history.readAloud.kept", { count: READS_KEPT })}
        </span>
      </div>
      {!shown ? (
        <div className="g-list h-24" aria-busy="true" />
      ) : shown.length === 0 ? (
        <p className="g-list m-0 px-6 py-8 text-center text-ink-2">
          {savedOnly
            ? t("settings.history.savedEmpty")
            : t("settings.history.readAloud.empty")}
        </p>
      ) : (
        groupByDay(shown).map((day) => (
          <section key={day[0].id} className="flex flex-col gap-3">
            <h2 className="g-day m-0">
              {dayLabel(day[0].timestamp, i18n.language, t)}
            </h2>
            <div className="g-list">
              {day.map((entry) => (
                <ReadAloudRow
                  key={entry.id}
                  entry={entry}
                  playing={entry.id === playingId ? playing : null}
                  onChanged={load}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
};
