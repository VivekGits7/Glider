import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type RewriteEntry } from "@/bindings";
import { notify } from "@/common/notices/noticeStore";
import { formatDateTime } from "@/common/lib/dateFormat";
import { copyToClipboard } from "./clipboard";
import { dayLabel, formatTime, groupByDay } from "./dayGroups";
import { IconButton, StarButton } from "./HistorySettings";

/** Matches REFINE_HISTORY_LIMIT in Rust. */
const REWRITES_KEPT = 200;

/** One rewrite: its result, which rewrite ran and where; copy or delete.
 * Home's Today list uses it too. */
export const RewriteRow: React.FC<{
  entry: RewriteEntry;
  onChanged: () => void;
}> = ({ entry, onChanged }) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!(await copyToClipboard(entry.after))) {
      notify({ title: t("settings.history.copyError") });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSaved = async () => {
    await commands.toggleRewriteSaved(entry.id);
    onChanged();
  };

  const remove = async () => {
    const result = await commands.deleteRewriteEntry(entry.id);
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
        <p className="g-txt g-clamp select-text">{entry.after}</p>
        <p className="g-meta m-0 mt-1.5">
          {[entry.prompt_name, entry.app_name].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="g-acts">
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

/** Past rewrites from the Refine shortcuts, one card per day. */
export const RewriteHistory: React.FC<{
  tabs: React.ReactNode;
  savedOnly: boolean;
}> = ({ tabs, savedOnly }) => {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<RewriteEntry[] | null>(null);

  const load = useCallback(async () => {
    const result = await commands.getRewriteHistory();
    setEntries(result.status === "ok" ? result.data : []);
  }, []);

  // Rewrites happen in other apps; catch up when the window comes back.
  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  const shown = savedOnly ? entries?.filter((e) => e.saved) : entries;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        {tabs}
        <span className="g-small">
          {t("settings.history.rewrite.kept", { count: REWRITES_KEPT })}
        </span>
      </div>
      {!shown ? (
        <div className="g-list h-24" aria-busy="true" />
      ) : shown.length === 0 ? (
        <p className="g-list m-0 px-6 py-8 text-center text-ink-2">
          {savedOnly
            ? t("settings.history.savedEmpty")
            : t("settings.history.rewrite.empty")}
        </p>
      ) : (
        groupByDay(shown).map((day) => (
          <section key={day[0].id} className="flex flex-col gap-3">
            <h2 className="g-day m-0">
              {dayLabel(day[0].timestamp, i18n.language, t)}
            </h2>
            <div className="g-list">
              {day.map((entry) => (
                <RewriteRow key={entry.id} entry={entry} onChanged={load} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
};
