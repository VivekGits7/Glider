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
import { Button } from "@/common/ui/Button";
import { Dialog } from "@/common/ui/Dialog";
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
  ["rewrite", "sparkles", "home.kind.rewrite"],
];

const startOfToday = () => {
  const now = new Date();
  return (
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  );
};

/** Five bars that move while a shortcut is working. */
const LiveBars: React.FC = () => (
  <span
    className="ms-3 inline-flex h-5 items-center gap-[3px] align-middle"
    aria-hidden="true"
  >
    {[0, 1, 2, 3, 4].map((i) => (
      <i
        key={i}
        className="block h-full w-[3px] origin-center animate-bar rounded-full bg-logo-primary"
        style={{ animationDelay: `${i * 120}ms` }}
      />
    ))}
  </span>
);

interface ShortcutLineProps {
  binding: string | undefined;
  live: boolean;
  idleKey: string;
  liveKey: string;
  hintKey: string;
}

/** One serif sentence with the shortcut's keycaps set inside it. */
const ShortcutLine: React.FC<ShortcutLineProps> = ({
  binding,
  live,
  idleKey,
  liveKey,
  hintKey,
}) => {
  const { t } = useTranslation();
  const osType = useOsType();
  const keys = binding ? (
    <Keycaps
      binding={binding}
      osType={osType}
      size="hero"
      live={live}
      className="mx-1"
    />
  ) : (
    <span />
  );
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      {/* Both states share one grid cell, so the hidden keycap line keeps the
          card's height and nothing jumps while listening or reading. */}
      <div
        aria-live="polite"
        className="grid items-center font-serif text-[24px] leading-[1.25] text-balance text-text @[640px]:text-[28px]"
      >
        <p className={`[grid-area:1/1] ${live ? "invisible" : ""}`}>
          <Trans i18nKey={idleKey} components={{ keys }} />
        </p>
        {live && (
          <p className="[grid-area:1/1]">
            {t(liveKey)}
            <LiveBars />
          </p>
        )}
      </div>
      <p className="mt-1.5 text-[14px] text-ink-2">{t(hintKey)}</p>
    </div>
  );
};

export const HomePage: React.FC<{
  onNavigate: (section: SidebarSection) => void;
  onHowToUse: () => void;
}> = ({ onNavigate, onHowToUse }) => {
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
    <div className="flex flex-col gap-8">
      <h1 className="font-ui text-[36px] font-normal leading-[1.1] tracking-[-0.01em] text-text">
        {name ? t("home.welcomeName", { name }) : t("home.welcome")}
      </h1>

      <div className="grid grid-cols-1 gap-3 @[720px]:grid-cols-[minmax(0,1fr)_200px]">
        <section
          aria-label={t("home.shortcutsLabel")}
          className="flex flex-col rounded-[22px] border border-line bg-card px-7 py-6"
        >
          <div className="divide-y divide-line">
            <ShortcutLine
              binding={bindings?.transcribe?.current_binding}
              live={listening}
              idleKey="home.dictateLine"
              liveKey="home.listening"
              hintKey="home.dictateHint"
            />
            <ShortcutLine
              binding={bindings?.speak_selection?.current_binding}
              live={speaking}
              idleKey="home.listenLine"
              liveKey="home.reading"
              hintKey="home.listenHint"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setTutorialOpen(true)}>
              {t("home.tutorial.button")}
            </Button>
            <Button variant="secondary" onClick={onHowToUse}>
              {t("home.howToUse")}
            </Button>
            <Button variant="ghost" onClick={() => onNavigate("dictation")}>
              {t("home.changeShortcuts")}
            </Button>
          </div>
        </section>

        <section
          aria-label={t("home.statsLabel")}
          className="grid grid-cols-3 gap-4 rounded-[22px] border border-line bg-card px-6 py-6 @[720px]:flex @[720px]:flex-col @[720px]:justify-center @[720px]:gap-4"
        >
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
            <p key={label} className="flex flex-col gap-1">
              <span className="font-serif text-[28px] leading-none tabular-nums text-text @[720px]:text-[34px]">
                {value === undefined ? "–" : compact.format(value)}
              </span>
              <span className="text-[13px] text-ink-2">{label}</span>
            </p>
          ))}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-ui text-[18px] font-normal text-text">
            {t("home.today")}
          </h2>
          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-label={t("home.filterLabel")}
              className="flex items-center gap-0.5"
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
              className="cursor-pointer text-[13px] text-ink-2 underline decoration-line-strong underline-offset-[3px] hover:text-text"
            >
              {t("home.seeAll")}
            </button>
          </div>
        </div>
        <AudioPlayerGroup>
          <div className="g-list">
            {shown == null ? (
              <div className="h-24" aria-busy="true" />
            ) : shown.length === 0 ? (
              <p className="m-0 px-6 py-8 text-[14px] leading-relaxed text-ink-2">
                {t("home.empty")}
              </p>
            ) : (
              shown.map((item) =>
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
              )
            )}
          </div>
        </AudioPlayerGroup>
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
    </div>
  );
};
