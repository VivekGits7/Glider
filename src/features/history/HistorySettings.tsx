import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { useTranslation } from "react-i18next";
import { notify } from "@/common/notices/noticeStore";
import {
  commands,
  events,
  type HistoryEntry,
  type HistoryUpdatePayload,
} from "@/bindings";
import { useOsType } from "@/common/hooks/useOsType";
import {
  useTranscriptionJobsStore,
  type ActiveJobStatus,
} from "@/features/stt/store/transcriptionJobsStore";
import { formatDateTime } from "@/common/lib/dateFormat";
import { AudioPlayer, AudioPlayerGroup } from "@/common/ui/AudioPlayer";
import { copyToClipboard } from "./clipboard";
import { dayLabel, formatTime, groupByDay } from "./dayGroups";
import { useFileReadsStore, type FileRead } from "./transcribeFiles";

/** A row action: the canvas's .ib, lit when `active`. */
export const IconButton: React.FC<{
  onClick: () => void;
  title: string;
  /** A canvas icon (g-i-<icon>). */
  icon: string;
  disabled?: boolean;
  active?: boolean;
}> = ({ onClick, title, icon, disabled, active }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`g-ib ${active ? "on" : ""} cursor-pointer disabled:cursor-not-allowed disabled:opacity-30`}
    title={title}
    aria-label={title}
    aria-pressed={active}
  >
    <i className={`g-ic g-i-${icon}`} aria-hidden="true" />
  </button>
);

/** Turns a recording's file name into a URL the audio player can load. */
export const useRecordingUrl = () => {
  const osType = useOsType();
  return useCallback(
    async (fileName: string) => {
      try {
        const result = await commands.getAudioFilePath(fileName);
        if (result.status === "ok") {
          if (osType === "linux") {
            const fileData = await readFile(result.data);
            const blob = new Blob([fileData], { type: "audio/wav" });
            return URL.createObjectURL(blob);
          }
          return convertFileSrc(result.data, "asset");
        }
        return null;
      } catch (error) {
        console.error("Failed to get audio file path:", error);
        return null;
      }
    },
    [osType],
  );
};

const PAGE_SIZE = 30;

// Long text folds to this many lines until "Show more".
const FOLDED_LINES = 4;

// The pulse of an entry's text while it's being transcribed.
const TRANSCRIBE_PULSE = {
  animation: "transcribe-pulse 3s ease-in-out infinite",
};

const TranscribePulseKeyframes: React.FC = () => (
  <style>{`
    @keyframes transcribe-pulse {
      0%, 100% { color: var(--color-ink-3); }
      50% { color: var(--color-text); }
    }
  `}</style>
);

/** A file's name with the file icon, above its text. */
const SourceName: React.FC<{ name: string }> = ({ name }) => (
  <span
    className="flex max-w-full items-center gap-1.5 text-[13px] text-ink-3"
    title={name}
  >
    <i className="g-ic g-i-file size-3.5" aria-hidden="true" />
    <span className="truncate">{name}</span>
  </span>
);

// A dropped or picked file while its audio is read, before it's an entry.
const FileReadRow: React.FC<{ read: FileRead }> = ({ read }) => {
  const { t } = useTranslation();
  return (
    <div className="g-li">
      <span />
      <div className="flex min-w-0 flex-col gap-1.5">
        <SourceName name={read.name} />
        <p className="g-txt" style={TRANSCRIBE_PULSE}>
          <TranscribePulseKeyframes />
          {t("settings.history.readingFile")}
        </p>
      </div>
      <span />
    </div>
  );
};

/** The star on a history row: filled once saved. */
export const StarButton: React.FC<{ saved: boolean; onClick: () => void }> = ({
  saved,
  onClick,
}) => {
  const { t } = useTranslation();
  return (
    <IconButton
      onClick={onClick}
      active={saved}
      icon={saved ? "star-fill" : "star"}
      title={saved ? t("settings.history.unsave") : t("settings.history.save")}
    />
  );
};

export const HistorySettings: React.FC<{
  tabs: React.ReactNode;
  savedOnly: boolean;
}> = ({ tabs, savedOnly }) => {
  const { t, i18n } = useTranslation();
  const getAudioUrl = useRecordingUrl();
  const jobs = useTranscriptionJobsStore((state) => state.jobs);
  const reads = useFileReadsStore((state) => state.reads);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const entriesRef = useRef<HistoryEntry[]>([]);
  const loadingRef = useRef(false);

  // Keep ref in sync for use in IntersectionObserver callback
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const loadPage = useCallback(
    async (cursor?: number) => {
      const isFirstPage = cursor === undefined;
      if (!isFirstPage && loadingRef.current) return;
      loadingRef.current = true;

      if (isFirstPage) setLoading(true);

      try {
        const result = await commands.getHistoryEntries(
          cursor ?? null,
          PAGE_SIZE,
          savedOnly,
        );
        if (result.status === "ok") {
          const { entries: newEntries, has_more } = result.data;
          setEntries((prev) => {
            if (isFirstPage) return newEntries;
            const existingIds = new Set(prev.map((entry) => entry.id));
            return [
              ...prev,
              ...newEntries.filter((entry) => !existingIds.has(entry.id)),
            ];
          });
          setHasMore(has_more);
        }
      } catch (error) {
        console.error("Failed to load history entries:", error);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [savedOnly],
  );

  // Initial load
  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (loading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        const first = observerEntries[0];
        if (first.isIntersecting) {
          const lastEntry = entriesRef.current[entriesRef.current.length - 1];
          if (lastEntry) {
            loadPage(lastEntry.id);
          }
        }
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore, loadPage]);

  // Listen for new entries added from the transcription pipeline
  useEffect(() => {
    const unlisten = events.historyUpdatePayload.listen((event) => {
      const payload: HistoryUpdatePayload = event.payload;
      if (payload.action === "added") {
        setEntries((prev) => [
          payload.entry,
          ...prev.filter((entry) => entry.id !== payload.entry.id),
        ]);
      } else if (payload.action === "updated") {
        setEntries((prev) =>
          prev.map((e) => (e.id === payload.entry.id ? payload.entry : e)),
        );
      }
      // "deleted" and "toggled" are handled by optimistic updates only,
      // so we intentionally ignore them here to avoid double-mutation.
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const toggleSaved = async (id: number) => {
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e)),
    );
    try {
      const result = await commands.toggleHistoryEntrySaved(id);
      if (result.status !== "ok") {
        // Revert on failure
        setEntries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e)),
        );
      }
    } catch (error) {
      console.error("Failed to toggle saved status:", error);
      // Revert on failure
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e)),
      );
    }
  };

  const deleteAudioEntry = async (id: number) => {
    // Optimistically remove
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      const result = await commands.deleteHistoryEntry(id);
      if (result.status !== "ok") {
        throw new Error(String(result.error));
      }
    } catch (error) {
      console.error("Failed to delete entry:", error);
      loadPage();
      throw error;
    }
  };

  // One card per day, under the day's name. Saved only: an entry unstarred
  // here, or a new dictation, drops out without a reload.
  const shown = savedOnly ? entries.filter((entry) => entry.saved) : entries;
  const fileReads = savedOnly ? [] : reads;
  const days = groupByDay(shown);

  let content: React.ReactNode;
  if (loading) {
    content = (
      <div className="g-list px-6 py-8 text-center text-ink-2">
        {t("settings.history.loading")}
      </div>
    );
  } else if (shown.length === 0 && fileReads.length === 0) {
    content = (
      <div className="g-list px-6 py-8 text-center text-ink-2">
        {savedOnly
          ? t("settings.history.savedEmpty")
          : t("settings.history.empty")}
      </div>
    );
  } else {
    content = (
      <AudioPlayerGroup>
        {fileReads.length > 0 && (
          <div className="g-list">
            {fileReads.map((read) => (
              <FileReadRow key={`read-${read.id}`} read={read} />
            ))}
          </div>
        )}
        {days.map((day) => (
          <section key={day[0].id} className="flex flex-col gap-3">
            <h2 className="g-day m-0">
              {dayLabel(day[0].timestamp, i18n.language, t)}
            </h2>
            <div className="g-list">
              {day.map((entry) => (
                <HistoryEntryComponent
                  key={entry.id}
                  entry={entry}
                  job={jobs[entry.id]}
                  onToggleSaved={() => toggleSaved(entry.id)}
                  onCopyText={() => copyToClipboard(entry.transcription_text)}
                  getAudioUrl={getAudioUrl}
                  deleteAudio={deleteAudioEntry}
                  retryTranscription={commands.retryHistoryEntryTranscription}
                  cancelTranscription={commands.cancelHistoryEntryTranscription}
                />
              ))}
            </div>
          </section>
        ))}
        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-1" />
      </AudioPlayerGroup>
    );
  }

  return (
    <>
      {tabs}
      {content}
    </>
  );
};

interface HistoryEntryProps {
  entry: HistoryEntry;
  job?: ActiveJobStatus;
  onToggleSaved: () => void;
  onCopyText: () => Promise<boolean>;
  getAudioUrl: (fileName: string) => Promise<string | null>;
  deleteAudio: (id: number) => Promise<void>;
  retryTranscription: (id: number) => Promise<void>;
  cancelTranscription: (id: number) => Promise<void>;
}

/** One dictation: play, copy, save, retry, delete. Home's Today list uses it too. */
export const HistoryEntryComponent: React.FC<HistoryEntryProps> = ({
  entry,
  job,
  onToggleSaved,
  onCopyText,
  getAudioUrl,
  deleteAudio,
  retryTranscription,
  cancelTranscription,
}) => {
  const { t, i18n } = useTranslation();
  const [showCopied, setShowCopied] = useState(false);
  // Pressed cancel: a running job stops after its current chunk.
  const [cancelling, setCancelling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Queued or being transcribed in the background.
  const retrying = job !== undefined;
  useEffect(() => {
    if (!retrying) setCancelling(false);
  }, [retrying]);
  const hasTranscription = entry.transcription_text.trim().length > 0;
  // Only the latest recordings keep their audio; older entries keep just text.
  const hasRecording = entry.file_name !== "";
  const folded = hasTranscription && !retrying && !expanded;

  // Offer "Show more" only when the folded text is actually cut off.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || !folded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [folded, entry.transcription_text]);

  // The recording's player opens from the row's play button.
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const toggleAudio = async () => {
    if (audioSrc) {
      setAudioSrc(null);
      return;
    }
    const url = await getAudioUrl(entry.file_name);
    if (url) setAudioSrc(url);
    else notify({ title: t("settings.history.audioError") });
  };

  const handleCopyText = async () => {
    if (!hasTranscription) {
      return;
    }

    const copied = await onCopyText();
    if (!copied) {
      notify({ title: t("settings.history.copyError") });
      return;
    }

    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleDeleteEntry = async () => {
    try {
      await deleteAudio(entry.id);
    } catch (error) {
      console.error("Failed to delete entry:", error);
      notify({ title: t("settings.history.deleteError") });
    }
  };

  const formattedDate = formatDateTime(String(entry.timestamp), i18n.language);

  let progressText = t("settings.history.transcribing");
  if (job?.state === "queued") {
    progressText = t("settings.history.waiting");
  } else if (job?.state === "running" && job.percent > 0) {
    progressText = t("settings.history.transcribingPercent", {
      percent: job.percent,
    });
  }

  const percent = job?.state === "running" ? job.percent : 0;

  return (
    <div className="g-li">
      <time className="g-time" title={formattedDate}>
        {formatTime(entry.timestamp, i18n.language)}
      </time>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        {entry.source_name && <SourceName name={entry.source_name} />}
        {retrying ? (
          <div className="flex w-full items-center gap-4">
            <div
              className="g-prog flex-1"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${Math.max(percent, 2)}%` }} />
            </div>
            <span className="shrink-0 text-[14px] text-ink-2 tabular-nums">
              {progressText}
            </span>
          </div>
        ) : (
          <p
            ref={textRef}
            className={`g-txt w-full ${
              hasTranscription
                ? "select-text cursor-text whitespace-pre-wrap break-words"
                : "text-ink-3"
            }`}
            style={
              folded
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: FOLDED_LINES,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }
                : undefined
            }
          >
            {hasTranscription
              ? entry.transcription_text
              : entry.source_name
                ? // Cancelled, interrupted by a quit, or failed.
                  t("settings.history.notTranscribed")
                : t("settings.history.transcriptionFailed")}
          </p>
        )}
        {hasTranscription && !retrying && (expanded || overflows) && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="cursor-pointer text-xs font-medium text-ink-3 hover:text-accent-ink"
          >
            {expanded
              ? t("settings.history.showLess")
              : t("settings.history.showMore")}
          </button>
        )}
      </div>
      <div className="g-acts">
        {retrying ? (
          <IconButton
            onClick={() => {
              setCancelling(true);
              void cancelTranscription(entry.id);
            }}
            disabled={cancelling}
            icon="x"
            title={t("settings.history.cancelTranscription")}
          />
        ) : (
          <>
            <IconButton
              onClick={toggleAudio}
              active={audioSrc !== null}
              disabled={!hasRecording}
              icon="play"
              title={
                hasRecording
                  ? t("settings.history.playRecording")
                  : t("settings.history.noRecording")
              }
            />
            <IconButton
              onClick={handleCopyText}
              disabled={!hasTranscription}
              icon={showCopied ? "check" : "copy"}
              title={t("settings.history.copyToClipboard")}
            />
            <StarButton saved={entry.saved} onClick={onToggleSaved} />
            {/* Only a failed or cancelled entry needs another try, and only
                while its recording is kept. */}
            {!hasTranscription && hasRecording && (
              <IconButton
                onClick={() => retryTranscription(entry.id)}
                icon="again"
                title={t("settings.history.retranscribe")}
              />
            )}
            <IconButton
              onClick={handleDeleteEntry}
              icon="trash"
              title={t("settings.history.delete")}
            />
          </>
        )}
      </div>
      {/* Its own line under the text and actions, so it runs the row's width. */}
      {audioSrc && (
        <AudioPlayer src={audioSrc} autoPlay className="col-[2/-1]" />
      )}
    </div>
  );
};
