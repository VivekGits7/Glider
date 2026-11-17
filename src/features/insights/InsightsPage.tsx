import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { commands, type Insights } from "@/bindings";
import { PageHeader } from "@/common/shared/PageHeader";
import { Tooltip } from "@/common/ui/Tooltip";
import { useSettings } from "@/common/settings/useSettings";

type Range = "30" | "all";

/** Days the Activity chart covers, whatever the range. */
const ACTIVITY_DAYS = 30;
const DAY_LABELS = ["mon", "", "wed", "", "fri", "", "sun"] as const;

/** Local `YYYY-MM-DD` as a Date at local midnight. */
const parseDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** The element's content size in CSS pixels, kept current as it resizes. */
const useSize = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
};

/** Speaking rises above the line and listening falls below it, one column a
 * day, on one scale. Today gets a lilac ring on the line. */
const TwoDirections: React.FC<{
  days: Insights["days"];
  width: number;
  height: number;
}> = ({ days, width, height }) => {
  const { t, i18n } = useTranslation();
  // Drawn at the exact size it is given, so it fills the card at any height.
  const W = width;
  const H = height;
  const SPAN = Math.max(40, H - 30);
  const step = W / days.length;
  const bw = Math.min(11, Math.round(step * 0.42));
  const maxSpeak = Math.max(...days.map((d) => d.speaking_ms));
  const maxListen = Math.max(...days.map((d) => d.listening_ms));
  const scale = (SPAN - 6) / Math.max(maxSpeak + maxListen, 1);
  // The line sits where the tallest day above meets the tallest day below.
  const line = 4 + maxSpeak * scale + 3;
  const dayFormat = new Intl.DateTimeFormat(i18n.language, {
    month: "short",
    day: "numeric",
  });
  const minutes = (ms: number) =>
    t("insights.minutes", { n: Math.round(ms / 60_000) });
  const middle = Math.floor(days.length / 2);

  return (
    <svg
      className="g-act"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t("insights.activityLabel", { days: days.length })}
    >
      <line x1={0} x2={W} y1={line} y2={line} stroke="var(--g-line-strong)" />
      {days.map((d, i) => {
        const x = i * step + (step - bw) / 2;
        const up = d.speaking_ms ? Math.max(bw, d.speaking_ms * scale) : 0;
        const down = d.listening_ms ? Math.max(bw, d.listening_ms * scale) : 0;
        return (
          <g key={d.day}>
            <title>
              {t("insights.dayActivity", {
                day: dayFormat.format(parseDay(d.day)),
                speaking: minutes(d.speaking_ms),
                listening: minutes(d.listening_ms),
              })}
            </title>
            {/* The whole column answers hover with its tooltip. */}
            <rect
              x={i * step}
              y={0}
              width={step}
              height={H - 24}
              fill="transparent"
            />
            {up > 0 && (
              <rect
                x={x}
                y={line - 3 - up}
                width={bw}
                height={up}
                rx={bw / 2}
                fill="var(--g-speak)"
              />
            )}
            {down > 0 && (
              <rect
                x={x}
                y={line + 3}
                width={bw}
                height={down}
                rx={bw / 2}
                fill="var(--g-listen)"
              />
            )}
            {!up && !down && (
              <circle
                cx={x + bw / 2}
                cy={line}
                r={2}
                fill="var(--g-line-strong)"
              />
            )}
            {i === days.length - 1 && (
              <circle
                cx={x + bw / 2}
                cy={line}
                r={3.5}
                fill="var(--g-card)"
                stroke="var(--g-pink)"
                strokeWidth={2}
              />
            )}
          </g>
        );
      })}
      <text x={0} y={H - 2}>
        {dayFormat.format(parseDay(days[0].day))}
      </text>
      <text x={middle * step + step / 2} y={H - 2} textAnchor="middle">
        {dayFormat.format(parseDay(days[middle].day))}
      </text>
      <text className="now" x={W} y={H - 2} textAnchor="end">
        {t("insights.today")}
      </text>
    </svg>
  );
};

/** One column: a heading, a figure with its unit and note, then rows. */
const Column: React.FC<{
  title: string;
  figure: string;
  unit: string;
  note: string;
  children: React.ReactNode;
}> = ({ title, figure, unit, note, children }) => (
  <div className="g-col">
    <h2 className="g-chead">{title}</h2>
    <div className="g-fig">
      <b>{figure}</b>
      <span>{unit}</span>
    </div>
    <div className="g-note">{note}</div>
    <div className="g-irows">{children}</div>
  </div>
);

/** A row's label with an info icon that says what the number counts. */
const Row: React.FC<{ label: string; value: string; explain: string }> = ({
  label,
  value,
  explain,
}) => {
  const { t } = useTranslation();
  return (
    <div>
      <span className="g-lbl">
        <span>{label}</span>
        <Tooltip text={explain} showOnPress>
          <button
            type="button"
            aria-label={t("insights.explainLabel", { name: label })}
            className="g-info"
          >
            <i className="g-ic g-i-info size-[14px]" aria-hidden="true" />
          </button>
        </Tooltip>
      </span>
      <b title={value}>{value}</b>
    </div>
  );
};

/** The streak calendar: weekday labels and square cells share one grid, the
 * cells as large as the card's width and height both allow. */
const Heatmap: React.FC<{
  days: Insights["days"];
  width: number;
  height: number;
}> = ({ days, width, height }) => {
  const { t, i18n } = useTranslation();
  const max = Math.max(1, ...days.map((d) => d.words));
  const level = (words: number) =>
    words <= 0 ? "" : `h${Math.min(4, Math.ceil((words / max) * 4))}`;
  const month = new Intl.DateTimeFormat(i18n.language, { month: "short" });
  const weeks = Math.ceil(days.length / 7);
  const GAP = 4;
  const LABELS = 28;
  // Months above (18px) and the legend below (22px) share the height.
  const cell = Math.max(
    8,
    Math.floor(
      Math.min(
        (width - LABELS - GAP * weeks) / weeks,
        (height - 40 - GAP * 6) / 7,
      ),
    ),
  );
  const columns = `${LABELS}px repeat(${weeks}, ${cell}px)`;

  // A label in the column where each month's first week starts.
  const months: { week: number; label: string }[] = [];
  days.forEach((d, i) => {
    if (i % 7 !== 0) return;
    const date = parseDay(d.day);
    const weekEnd = new Date(date);
    weekEnd.setDate(date.getDate() + 6);
    const starts =
      i === 0 ? date : weekEnd.getMonth() !== date.getMonth() ? weekEnd : null;
    if (!starts) return;
    const label = month.format(starts);
    if (months[months.length - 1]?.label !== label) {
      months.push({ week: i / 7, label });
    }
  });
  const today = days[days.length - 1]?.day;

  return (
    <>
      <div
        className="g-hmonths"
        aria-hidden="true"
        style={{ gridTemplateColumns: columns }}
      >
        {months.map((m) => (
          <span key={m.week} style={{ gridColumn: m.week + 2 }}>
            {m.label}
          </span>
        ))}
      </div>
      <div
        className="g-heat"
        role="img"
        aria-label={t("insights.calendarLabel", { weeks })}
        style={{
          gridTemplateColumns: columns,
          gridTemplateRows: `repeat(7, ${cell}px)`,
        }}
      >
        {DAY_LABELS.map((d, i) => (
          <span key={`label-${i}`}>{d && t(`insights.days.${d}`)}</span>
        ))}
        {days.map((d) => (
          <i
            key={d.day}
            className={`${level(d.words)} ${d.day === today ? "today" : ""}`}
            title={t("insights.dayWords", {
              day: parseDay(d.day).toLocaleDateString(i18n.language),
              count: d.words,
            })}
          />
        ))}
      </div>
      <div className="g-hlegend">
        <span className="me-1">{t("insights.less")}</span>
        <i />
        <i className="h1" />
        <i className="h2" />
        <i className="h3" />
        <i className="h4" />
        <span className="ms-1">{t("insights.more")}</span>
      </div>
    </>
  );
};

/** A sentence of the range's numbers, Activity, the three features, where the
 * user talks and the streak. */
export const InsightsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { getSetting } = useSettings();
  const prompts = getSetting("post_process_prompts") ?? [];
  const [range, setRange] = useState<Range>("all");
  const [chartBox, chartSize] = useSize<HTMLDivElement>();
  const [heatBox, heatSize] = useSize<HTMLDivElement>();
  const [data, setData] = useState<Insights | null>(null);

  useEffect(() => {
    let live = true;
    commands.getInsights(range === "30" ? 30 : null).then((result) => {
      if (live && result.status === "ok") setData(result.data);
    });
    return () => {
      live = false;
    };
  }, [range]);

  const number = new Intl.NumberFormat(i18n.language);
  const dash = "–";
  const hours = (minutes: number) =>
    minutes >= 60
      ? t("insights.hours", { n: number.format(Math.round(minutes / 60)) })
      : t("insights.minutes", { n: number.format(minutes) });
  const words = (count: number) =>
    t("insights.words", { count, n: number.format(count) });
  const compact = new Intl.NumberFormat(i18n.language, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  // Rows are narrow: from 10,000 a count reads as "24.4K words".
  const rowWords = (count: number) =>
    t("insights.words", {
      count,
      n: count >= 10_000 ? compact.format(count) : number.format(count),
    });

  const trend = data?.wpm_trend ?? [];
  const trendLine = (() => {
    if (!data || data.wpm === null) return t("insights.wpmEmpty");
    if (data.wpm_from === null || !data.wpm_from_day)
      return t("insights.wpmNoTrend");
    const month = new Intl.DateTimeFormat(i18n.language, {
      month: "long",
    }).format(parseDay(data.wpm_from_day));
    const now = trend[trend.length - 1] ?? data.wpm;
    if (now === data.wpm_from) return t("insights.wpmSteady", { month });
    return t(now > data.wpm_from ? "insights.wpmUp" : "insights.wpmDown", {
      from: data.wpm_from,
      month,
    });
  })();

  const summary = (() => {
    if (!data) return null;
    if (!data.words_dictated && !data.words_read && !data.rewrites) {
      return t("insights.summaryEmpty");
    }
    const saved =
      data.minutes_saved >= 60
        ? t("insights.savedHours", {
            count: Math.round(data.minutes_saved / 60),
          })
        : t("insights.savedMinutes", { count: data.minutes_saved });
    const values = {
      words: words(data.words_dictated),
      pace: t("insights.pace", { n: data.wpm }),
      heard: number.format(data.words_read),
      rewrites: t("insights.rewriteCount", {
        count: data.rewrites,
        n: number.format(data.rewrites),
      }),
      saved,
    };
    const key =
      range === "30"
        ? data.wpm === null
          ? "insights.summary30NoPace"
          : "insights.summary30"
        : data.wpm === null
          ? "insights.summaryAllNoPace"
          : "insights.summaryAll";
    return <Trans i18nKey={key} values={values} components={{ em: <em /> }} />;
  })();

  const activity = data?.days.slice(-ACTIVITY_DAYS) ?? [];
  const activeDays = activity.filter((d) => d.speaking_ms || d.listening_ms);
  const busiest = activeDays.reduce<Insights["days"][number] | null>(
    (best, d) =>
      !best ||
      d.speaking_ms + d.listening_ms > best.speaking_ms + best.listening_ms
        ? d
        : best,
    null,
  );

  const languageNames = (() => {
    try {
      const names = new Intl.DisplayNames([i18n.language], {
        type: "language",
      });
      return (data?.languages ?? []).map((code) => names.of(code) ?? code);
    } catch {
      return data?.languages ?? [];
    }
  })();
  const promptName = (id: string) =>
    prompts.find((p) => p.id === id)?.name ?? t("insights.removedRewrite");
  const mixMax = Math.max(1, ...(data?.rewrite_mix ?? []).map((r) => r.count));
  const totalAppWords = data?.apps.reduce((sum, a) => sum + a.words, 0) ?? 0;
  // Four rows at most, like the other columns, so the page fits one screen:
  // the top three, then everything else as Other.
  const apps = (() => {
    const all = data?.apps ?? [];
    if (all.length <= 4) return all;
    const rest = all.slice(3).reduce((sum, a) => sum + a.words, 0);
    return [...all.slice(0, 3), { name: null, words: rest }];
  })();
  const topApp = data?.apps[0]
    ? {
        name: data.apps[0].name ?? t("insights.otherApps"),
        share: Math.round((data.apps[0].words / totalAppWords) * 100),
      }
    : null;

  return (
    <>
      <PageHeader
        title={t("sidebar.insights")}
        right={
          <div
            className="g-tabs sm"
            role="radiogroup"
            aria-label={t("insights.rangeLabel")}
          >
            {(["30", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={range === value}
                onClick={() => setRange(value)}
                className={`g-tab ${range === value ? "on" : ""} cursor-pointer`}
              >
                {t(value === "30" ? "insights.last30" : "insights.allTime")}
              </button>
            ))}
          </div>
        }
      />

      <div className="g-ins">
        <p className="g-summary">{summary}</p>

        <div className="g-ins-top">
          <section className="g-icard" aria-label={t("insights.activityTitle")}>
            <div className="g-ihead">
              <h2 className="g-ititle">{t("insights.activityTitle")}</h2>
              <div className="g-key">
                <span>
                  <i style={{ background: "var(--g-speak)" }} />
                  {t("insights.speakingAbove")}
                </span>
                <span>
                  <i style={{ background: "var(--g-listen)" }} />
                  {t("insights.listeningBelow")}
                </span>
              </div>
            </div>
            <div ref={chartBox} className="g-box">
              <div className="g-fill">
                {activeDays.length > 0 && chartSize.width > 0 ? (
                  <TwoDirections
                    days={activity}
                    width={chartSize.width}
                    height={chartSize.height}
                  />
                ) : (
                  <p className="m-0 text-[13px] leading-relaxed text-ink-2">
                    {data && !activeDays.length
                      ? t("insights.activityEmpty")
                      : ""}
                  </p>
                )}
              </div>
            </div>
            {activeDays.length > 0 && (
              <div className="g-afoot">
                <span>
                  {t("insights.lastDays", { total: ACTIVITY_DAYS })}{" "}
                  <Trans
                    i18nKey="insights.activeDays"
                    values={{ active: activeDays.length, total: ACTIVITY_DAYS }}
                    components={{ b: <b /> }}
                  />
                  {busiest &&
                    ` ${t("insights.busiest", {
                      day: parseDay(busiest.day).toLocaleDateString(
                        i18n.language,
                        {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        },
                      ),
                    })}`}
                </span>
              </div>
            )}
          </section>

          <section className="g-icard" aria-label={t("insights.streakLabel")}>
            <div className="g-ihead">
              <h2 className="g-ititle">
                {data && data.streak_days > 0
                  ? t("insights.streak", { count: data.streak_days })
                  : t("insights.noStreak")}
              </h2>
              {data && data.longest_streak_days > 0 && (
                <span className="g-small">
                  {t("insights.longest", { count: data.longest_streak_days })}
                </span>
              )}
            </div>
            <div ref={heatBox} className="g-box">
              <div className="g-fill">
                {data && heatSize.width > 0 && (
                  <Heatmap
                    days={data.days}
                    width={heatSize.width}
                    height={heatSize.height}
                  />
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="g-ins-bottom">
          <section className="g-icard g-cols">
            <Column
              title={t("sidebar.dictation")}
              figure={data?.wpm != null ? number.format(data.wpm) : dash}
              unit={t("insights.wpmUnit")}
              note={data ? trendLine : ""}
            >
              <Row
                label={t("insights.dictations")}
                explain={t("insights.explain.dictations")}
                value={data ? number.format(data.dictations) : dash}
              />
              <Row
                label={t("insights.average")}
                explain={t("insights.explain.average")}
                value={
                  data?.dictations
                    ? rowWords(data.average_dictation_words)
                    : dash
                }
              />
              <Row
                label={t("insights.longestDictation")}
                explain={t("insights.explain.longest")}
                value={
                  data?.dictations
                    ? rowWords(data.longest_dictation_words)
                    : dash
                }
              />
              <Row
                label={t("insights.languages")}
                explain={t("insights.explain.languages")}
                value={languageNames.length ? languageNames.join(", ") : dash}
              />
            </Column>
            <Column
              title={t("sidebar.readAloud")}
              figure={data ? number.format(data.words_read) : dash}
              unit={t("insights.heardUnit")}
              note={
                data?.usual_speed != null
                  ? t("insights.usuallyAt", {
                      speed: data.usual_speed.toFixed(1),
                    })
                  : ""
              }
            >
              <Row
                label={t("insights.reads")}
                explain={t("insights.explain.reads")}
                value={data ? number.format(data.reads) : dash}
              />
              <Row
                label={t("insights.timeListened")}
                explain={t("insights.explain.timeListened")}
                value={data ? hours(data.minutes_listened) : dash}
              />
              <Row
                label={t("insights.longestRead")}
                explain={t("insights.explain.longestRead")}
                value={data?.reads ? rowWords(data.longest_read_words) : dash}
              />
              <Row
                label={t("insights.voice")}
                explain={t("insights.explain.voice")}
                value={data?.voice ?? dash}
              />
            </Column>
            <Column
              title={t("sidebar.rewrite")}
              figure={data ? number.format(data.rewrites) : dash}
              unit={t("insights.rewritesUnit", { count: data?.rewrites ?? 0 })}
              note={
                data?.rewrites
                  ? t("insights.wordsRewritten", {
                      count: data.words_rewritten,
                      n: number.format(data.words_rewritten),
                    })
                  : ""
              }
            >
              {data && data.rewrite_mix.length > 0 ? (
                data.rewrite_mix.slice(0, 4).map((r) => (
                  <div className="g-mix" key={r.prompt_id}>
                    <span className="truncate">{promptName(r.prompt_id)}</span>
                    <span className="g-cap">
                      <i style={{ width: `${(r.count / mixMax) * 100}%` }} />
                    </span>
                    <b>{number.format(r.count)}</b>
                  </div>
                ))
              ) : (
                <div>{t("insights.rewritesEmpty")}</div>
              )}
            </Column>
          </section>
          <section
            className="g-icard g-solo"
            aria-label={t("insights.appsLabel")}
          >
            <Column
              title={t("insights.appsTitle")}
              figure={topApp ? `${topApp.share}%` : dash}
              unit={topApp ? t("insights.inApp", { app: topApp.name }) : ""}
              note={t("insights.appsHint")}
            >
              {apps.length > 0 ? (
                apps.map((app) => {
                  const name = app.name ?? t("insights.otherApps");
                  const share = Math.round((app.words / totalAppWords) * 100);
                  return (
                    <div className="g-app" key={app.name ?? "other"}>
                      <span className="truncate text-text">{name}</span>
                      <span
                        className="g-cap"
                        role="img"
                        aria-label={t("insights.appShare", { name, share })}
                      >
                        {share > 0 && <i style={{ width: `${share}%` }} />}
                      </span>
                      <b>{share}%</b>
                    </div>
                  );
                })
              ) : (
                <div>{t("insights.appsEmpty")}</div>
              )}
            </Column>
          </section>
        </div>
      </div>
    </>
  );
};
