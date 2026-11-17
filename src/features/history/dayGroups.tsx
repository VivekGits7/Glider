import type { TFunction } from "i18next";

/** "9:30 PM" in the user's locale. `timestamp` is in seconds. */
export const formatTime = (timestamp: number, locale: string): string =>
  new Date(timestamp * 1000).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });

const dayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Groups a list by local day. `timestamp` is in seconds. */
export const dayKey = (timestamp: number): number =>
  dayStart(new Date(timestamp * 1000));

/** Splits a newest-first list into one list per local day. */
export const groupByDay = <T extends { timestamp: number }>(
  items: T[],
): T[][] => {
  const days: T[][] = [];
  for (const item of items) {
    const last = days[days.length - 1];
    if (last && dayKey(last[0].timestamp) === dayKey(item.timestamp)) {
      last.push(item);
    } else {
      days.push([item]);
    }
  }
  return days;
};

/** "Today", "Yesterday", or the date. */
export const dayLabel = (
  timestamp: number,
  locale: string,
  t: TFunction,
): string => {
  const now = new Date();
  const day = dayKey(timestamp);
  if (day === dayStart(now)) return t("settings.history.days.today");
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  if (day === yesterday.getTime()) return t("settings.history.days.yesterday");
  return new Date(timestamp * 1000).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};
