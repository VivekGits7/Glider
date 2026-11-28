import React, { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  commands,
  events,
  type HistoryEntry,
  type ReadAloudEntry,
  type RewriteEntry,
  type UsageStats,
} from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";
import { useOsType } from "@/common/hooks/useOsType";
import { Keycaps } from "@/common/shared/Keycaps";
import { AudioPlayerGroup } from "@/common/ui/AudioPlayer";
import { Dialog } from "@/common/ui/Dialog";
import { PageHeader } from "@/common/shared/PageHeader";
import { TutorialVideo } from "./TutorialVideo";
import type { SidebarSection } from "@/app/Sidebar";
import { copyToClipboard } from "@/features/history/clipboard";
import {
  HistoryEntryComponent,
  IconButton,
  useRecordingUrl,
} from "@/features/history/HistorySettings";
import {
  ReadAloudRow,
  playingReadId,
  useReadingProgress,
} from "@/features/history/ReadAloudHistory";
import { RewriteRow } from "@/features/history/RewriteHistory";
import { useTranscriptionJobsStore } from "@/features/stt/store/transcriptionJobsStore";

type Activity =
  | { kind: "dictation"; entry: HistoryEntry }
  | { kind: "read"; entry: ReadAloudEntry }
  | { kind: "rewrite"; entry: RewriteEntry };
type ActivityKind = Activity["kind"];

/** The Today filters: kind, canvas icon, label. */
const FILTERS: [ActivityKind, string, string][] = [
  ["dictation", "mic", "home.kind.dictation"],
  ["read", "audio", "home.kind.read"],
  ["rewrite", "star4", "home.kind.rewrite"],
];

const startOfToday = () => {
  const now = new Date();
  return (
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  );
};

interface ShortcutRowProps {
  /** A canvas icon (g-i-<icon>). */
  icon: string;
  binding: string | undefined;
  live: boolean;
  idleKey: string;
  liveKey: string;
  hintKey: string;
}

/** One shortcut: its icon, "Hold fn to dictate" with the keys set in the
 * sentence, and a line on what it does. While it works the sentence says so. */
const ShortcutRow: React.FC<ShortcutRowProps> = ({
  icon,
  binding,
  live,
  idleKey,
  liveKey,
  hintKey,
}) => {
  const { t } = useTranslation();
  const osType = useOsType();
  const keys = binding ? (
    <Keycaps binding={binding} osType={osType} live={live} />
  ) : (
    <span />
  );
  return (
    <div className="g-srow">
      <span className="g-picon">
        <i className={`g-ic g-i-${icon}`} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col gap-[3px]">
        {/* Both states share one grid cell, so nothing jumps while it works. */}
        <div aria-live="polite" className="grid">
          <p className={`g-srow-t [grid-area:1/1] ${live ? "invisible" : ""}`}>
            <Trans i18nKey={idleKey} components={{ keys }} />
          </p>
          {live && (
            <p className="g-srow-t [grid-area:1/1]">
              {t(liveKey)}
              <span className="g-bars sm" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </p>
          )}
        </div>
        <p className="m-0 text-[12px] text-ink-2">{t(hintKey)}</p>
      </div>
    </div>
  );
};

export const HomePage: React.FC<{
  onNavigate: (section: SidebarSection) => void;
}> = ({ onNavigate }) => {
  const { t, i18n } = useTranslation();
  const { getSetting } = useSettings();
  const bindings = getSetting("bindings");
  const [name, setName] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [filter, setFilter] = useState<ActivityKind | null>(null);
  const jobs = useTranscriptionJobsStore((state) => state.jobs);
  const getAudioUrl = useRecordingUrl();

  const load = useCallback(async () => {
    const since = startOfToday();
    const [statsResult, dictations, reads, rewrites] = await Promise.all([
      commands.getUsageStats(),
      commands.getHistoryEntries(null, 100, false),
      commands.getReadAloudHistory(),
      commands.getRewriteHistory(),
    ]);
    if (statsResult.status === "ok") setStats(statsResult.data);
    const today: Activity[] = [
      ...(dictations.status === "ok" ? dictations.data.entries : [])
        .filter((e) => e.timestamp >= since && e.transcription_text.trim())
        .map((entry) => ({ kind: "dictation" as const, entry })),
      ...(reads.status === "ok" ? reads.data : [])
        .filter((e) => e.timestamp >= since && e.text.trim())
        .map((entry) => ({ kind: "read" as const, entry })),
      ...(rewrites.status === "ok" ? rewrites.data : [])
        .filter((e) => e.timestamp >= since && e.after.trim())
        .map((entry) => ({ kind: "rewrite" as const, entry })),
    ].sort((a, b) => b.entry.timestamp - a.entry.timestamp);
    setActivity(today);
  }, []);

  const playing = useReadingProgress(load);
  const playingId = playingReadId(
    (activity ?? []).flatMap((a) => (a.kind === "read" ? [a.entry] : [])),
    playing,
  );
  const shown = filter ? activity?.filter((a) => a.kind === filter) : activity;

  const toggleSaved = async (id: number) => {
    await commands.toggleHistoryEntrySaved(id);
    load();
  };

  const deleteDictation = async (id: number) => {
    const result = await commands.deleteHistoryEntry(id);
    load();
    if (result.status !== "ok") throw new Error(String(result.error));
  };

  useEffect(() => {
    commands.getUserName().then(setName);
    load();
    // Shortcuts are used in other apps; catch up when the window comes back.
    window.addEventListener("focus", load);
    const offHistory = events.historyUpdatePayload.listen(() => load());
    const offRecording = events.recordingStateEvent.listen(({ payload }) => {
      const active = payload.phase === "started" || payload.phase === "locked";
      setListening(active);
      if (!active) load();
    });
    return () => {
      window.removeEventListener("focus", load);
      offHistory.then((off) => off());
      offRecording.then((off) => off());
    };
  }, [load]);

  // Read Aloud has no event; poll while this page is open.
  useEffect(() => {
    const id = setInterval(async () => {
      const now = await commands.isSpeaking();
      setSpeaking((was) => {
        if (was && !now) load();
        return now;
      });
    }, 700);
    return () => clearInterval(id);
  }, [load]);

  const compact = new Intl.NumberFormat(i18n.language, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return (
    <>
      <PageHeader title={t("sidebar.home")} />
      <p className="g-welcome">
        {name ? t("home.welcomeName", { name }) : t("home.welcome")}
      </p>

      <section className="g-group" aria-label={t("home.shortcutsLabel")}>
        <div className="g-sechead">
          <h2 className="g-gt">{t("home.shortcutsLabel")}</h2>
          <button
            type="button"
            className="g-link cursor-pointer"
            onClick={() => onNavigate("dictation")}
          >
            {t("home.changeShortcuts")}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2.5 @[720px]:grid-cols-[minmax(0,1fr)_240px]">
          <div className="g-card">
            <ShortcutRow
              icon="mic"
              binding={bindings?.transcribe?.current_binding}
              live={listening}
              idleKey="home.dictateLine"
              liveKey="home.listening"
              hintKey="home.dictateHint"
            />
            <ShortcutRow
              icon="speaker"
              binding={bindings?.speak_selection?.current_binding}
              live={speaking}
              idleKey="home.listenLine"
              liveKey="home.reading"
              hintKey="home.listenHint"
            />
          </div>
          <div className="g-card g-numbers" aria-label={t("home.statsLabel")}>
            {(
              [
                [stats?.dictated_words, t("home.stats.dictated")],
                [stats?.read_words, t("home.stats.read")],
                [
                  stats?.streak_days,
                  t("home.stats.streak", { count: stats?.streak_days ?? 0 }),
                ],
              ] as const
            ).map(([value, label]) => (
              <p key={label}>
                <b>{value === undefined ? "–" : compact.format(value)}</b>
                <span>{label}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="g-group">
        <div className="g-sechead">
          <h2 className="g-gt">{t("home.today")}</h2>
          <div
            role="group"
            aria-label={t("home.filterLabel")}
            className="ms-auto me-3.5 flex h-[18px] items-center gap-0.5 self-center"
          >
            {FILTERS.map(([kind, icon, label]) => (
              <IconButton
                key={kind}
                icon={icon}
                title={t(label)}
                active={filter === kind}
                onClick={() =>
                  setFilter((current) => (current === kind ? null : kind))
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate("history")}
            className="g-link cursor-pointer"
          >
            {t("home.seeAll")}
          </button>
        </div>
        <AudioPlayerGroup>
          {shown == null ? (
            <div className="h-20" aria-busy="true" />
          ) : shown.length === 0 ? (
            <p className="g-empty">{t("home.empty")}</p>
          ) : (
            <div className="g-list">
              {shown.map((item) =>
                item.kind === "dictation" ? (
                  <HistoryEntryComponent
                    key={`d${item.entry.id}`}
                    entry={item.entry}
                    job={jobs[item.entry.id]}
                    onToggleSaved={() => toggleSaved(item.entry.id)}
                    onCopyText={() =>
                      copyToClipboard(item.entry.transcription_text)
                    }
                    getAudioUrl={getAudioUrl}
                    deleteAudio={deleteDictation}
                    retryTranscription={commands.retryHistoryEntryTranscription}
                    cancelTranscription={
                      commands.cancelHistoryEntryTranscription
                    }
                  />
                ) : item.kind === "read" ? (
                  <ReadAloudRow
                    key={`r${item.entry.id}`}
                    entry={item.entry}
                    playing={item.entry.id === playingId ? playing : null}
                    onChanged={load}
                  />
                ) : (
                  <RewriteRow
                    key={`w${item.entry.id}`}
                    entry={item.entry}
                    onChanged={load}
                  />
                ),
              )}
            </div>
          )}
        </AudioPlayerGroup>
      </section>

      <section className="g-group">
        <h2 className="g-gt ms-1">{t("home.howToUse")}</h2>
        <button
          type="button"
          className="g-card g-howto"
          onClick={() => setTutorialOpen(true)}
        >
          <span className="g-thumb" aria-hidden="true">
            <i className="g-ic g-i-play" />
          </span>
          <span className="flex flex-col gap-[3px]">
            <span className="text-[13px] font-medium text-text">
              {t("home.tutorial.title")}
            </span>
            <span className="text-[12px] text-ink-2">
              {t("home.tutorial.soon")}
            </span>
          </span>
        </button>
      </section>
      <Dialog
        open={tutorialOpen}
        onOpenChange={setTutorialOpen}
        title={t("home.tutorial.title")}
        closeLabel={t("common.close")}
        className="max-w-3xl"
        contentFades={false}
      >
        <TutorialVideo />
      </Dialog>
    </>
  );
};
