//! What Insights shows: speed, time saved, where the user dictates, reading
//! habits and the activity streak. Built from `activity_log` (one row per
//! dictation, read and rewrite) and the daily totals in `usage_stats`.

use crate::features::history::service::HistoryManager;
use anyhow::Result;
use chrono::{Datelike, Duration, Local, NaiveDate, TimeZone, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use specta::Type;
use std::collections::HashMap;

/// Typing speed that dictation is compared with, in words per minute.
pub const TYPING_WPM: u32 = 40;
/// Weeks of days in the streak calendar.
const CALENDAR_WEEKS: i64 = 15;
/// Apps listed by name before the rest become "Other".
const TOP_APPS: usize = 5;
/// Rewrites kept with their text, for feedback and "See changes".
const REFINE_HISTORY_LIMIT: i64 = 200;

pub enum Activity<'a> {
    Dictation {
        words: i64,
        duration_ms: u64,
        app_name: Option<&'a str>,
    },
    Read {
        words: i64,
        duration_ms: u64,
        speed: f32,
    },
    Rewrite {
        words: i64,
        prompt_id: &'a str,
        app_name: Option<&'a str>,
    },
}

#[derive(Clone, Debug, Serialize, Type)]
pub struct AppShare {
    /// `None` is everything outside the top apps, and dictations whose app
    /// isn't known.
    pub name: Option<String>,
    pub words: i64,
}

#[derive(Clone, Debug, Serialize, Type)]
pub struct DayActivity {
    /// `YYYY-MM-DD`, local time.
    pub day: String,
    pub words: i64,
    /// Time spent dictating and listening that day, in milliseconds.
    pub speaking_ms: i64,
    pub listening_ms: i64,
}

/// How many times one rewrite ran.
#[derive(Clone, Debug, Serialize, Type)]
pub struct RewriteShare {
    pub prompt_id: String,
    pub count: i64,
}

#[derive(Clone, Debug, Serialize, Type)]
pub struct Insights {
    /// Words per minute while dictating, when there's enough to tell.
    pub wpm: Option<u32>,
    /// Words per minute, week by week, oldest first.
    pub wpm_trend: Vec<u32>,
    /// The first week of the trend: when it started (`YYYY-MM-DD`) and its speed.
    pub wpm_from_day: Option<String>,
    pub wpm_from: Option<u32>,
    pub minutes_saved: i64,
    pub words_dictated: i64,
    /// Dictations in the range, and their average and longest length in words.
    pub dictations: i64,
    pub average_dictation_words: i64,
    pub longest_dictation_words: i64,
    /// Dictation languages (codes such as "en"), most used first, at most three.
    pub languages: Vec<String>,
    pub rewrites: i64,
    pub words_rewritten: i64,
    /// Rewrites by prompt id, most used first.
    pub rewrite_mix: Vec<RewriteShare>,
    pub typing_wpm: u32,
    pub words_read: i64,
    pub reads: i64,
    /// The voice used for the most reads, named as History shows it.
    pub voice: Option<String>,
    pub minutes_listened: i64,
    /// The speed the user reads at most often.
    pub usual_speed: Option<f32>,
    pub longest_read_words: i64,
    /// Dictated words by app, biggest first; the last one may be "Other".
    pub apps: Vec<AppShare>,
    pub streak_days: u32,
    pub longest_streak_days: u32,
    /// The calendar: every day of the last weeks, oldest first, starting on a
    /// Monday and ending today.
    pub days: Vec<DayActivity>,
}

/// One rewrite, with its text, as "See changes" shows it.
#[derive(Clone, Debug, Serialize, Type)]
pub struct RefineRecord {
    pub id: i64,
    pub prompt_id: String,
    pub prompt_name: String,
    pub model: String,
    pub before: String,
    pub after: String,
}

impl HistoryManager {
    /// Logs one dictation, read or rewrite for Insights. Never fails loudly:
    /// stats must not get in the way of the work itself.
    pub fn record_activity(&self, activity: Activity) {
        let result = self
            .get_connection()
            .and_then(|conn| insert_activity(&conn, Utc::now().timestamp(), &activity));
        if let Err(e) = result {
            log::warn!("Failed to log activity for Insights: {e}");
        }
    }

    /// `days`: the last 30 days, or `None` for all time.
    pub fn insights(&self, days: Option<u32>) -> Result<Insights> {
        let conn = self.get_connection()?;
        insights(&conn, Local::now().date_naive(), days)
    }

    pub fn save_refine(&self, record: &RefineRecord, app_name: Option<&str>) -> Result<i64> {
        let conn = self.get_connection()?;
        conn.execute(
            "INSERT INTO refine_history
             (timestamp, prompt_id, prompt_name, model, before_text, after_text, app_name)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                Utc::now().timestamp(),
                record.prompt_id,
                record.prompt_name,
                record.model,
                record.before,
                record.after,
                app_name
            ],
        )?;
        let id = conn.last_insert_rowid();
        conn.execute(
            "DELETE FROM refine_history WHERE saved = 0 AND id NOT IN
             (SELECT id FROM refine_history WHERE saved = 0 ORDER BY id DESC LIMIT ?1)",
            params![REFINE_HISTORY_LIMIT],
        )?;
        Ok(id)
    }

    pub fn update_refine_result(&self, id: i64, after: &str) -> Result<()> {
        self.get_connection()?.execute(
            "UPDATE refine_history SET after_text = ?2 WHERE id = ?1",
            params![id, after],
        )?;
        Ok(())
    }

    /// How many times each rewrite has run, by prompt id.
    pub fn rewrite_usage(&self) -> Result<HashMap<String, i64>> {
        let conn = self.get_connection()?;
        let mut statement = conn.prepare(
            "SELECT detail, COUNT(*) FROM activity_log WHERE kind = 'rewrite' GROUP BY detail",
        )?;
        let usage = statement
            .query_map([], |row| {
                Ok((row.get::<_, Option<String>>(0)?, row.get::<_, i64>(1)?))
            })?
            .filter_map(|row| row.ok())
            .filter_map(|(id, count)| id.map(|id| (id, count)))
            .collect();
        Ok(usage)
    }
}

fn insert_activity(conn: &Connection, timestamp: i64, activity: &Activity) -> Result<()> {
    let (kind, words, duration_ms, app_name, speed, detail) = match *activity {
        Activity::Dictation {
            words,
            duration_ms,
            app_name,
        } => ("dictation", words, duration_ms, app_name, None, None),
        Activity::Read {
            words,
            duration_ms,
            speed,
        } => ("read", words, duration_ms, None, Some(speed), None),
        Activity::Rewrite {
            words,
            prompt_id,
            app_name,
        } => ("rewrite", words, 0, app_name, None, Some(prompt_id)),
    };
    conn.execute(
        "INSERT INTO activity_log (timestamp, kind, words, duration_ms, app_name, speed, detail)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            timestamp,
            kind,
            words,
            duration_ms as i64,
            app_name,
            speed,
            detail
        ],
    )?;
    Ok(())
}

/// Start of `day` (local midnight) as a Unix timestamp.
fn day_start(day: NaiveDate) -> i64 {
    let midnight = day.and_hms_opt(0, 0, 0).expect("valid time");
    Local
        .from_local_datetime(&midnight)
        .earliest()
        .map(|t| t.timestamp())
        .unwrap_or_else(|| midnight.and_utc().timestamp())
}

fn words_per_minute(words: i64, duration_ms: i64) -> Option<u32> {
    // Under half a minute of speech says little about a speed.
    (duration_ms >= 30_000 && words > 0)
        .then(|| (words as f64 * 60_000.0 / duration_ms as f64).round() as u32)
}

fn insights(conn: &Connection, today: NaiveDate, days: Option<u32>) -> Result<Insights> {
    let since_day = days.map(|d| today - Duration::days(i64::from(d) - 1));
    let since_ts = since_day.map(day_start).unwrap_or(i64::MIN);
    let since_text = since_day
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_default();

    let (words_dictated, words_read): (i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(dictated_words), 0), COALESCE(SUM(read_words), 0)
         FROM usage_stats WHERE day >= ?1",
        params![since_text],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    // Speed: dictations with a measured duration.
    let (timed_words, timed_ms): (i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(words), 0), COALESCE(SUM(duration_ms), 0) FROM activity_log
         WHERE kind = 'dictation' AND duration_ms > 0 AND timestamp >= ?1",
        params![since_ts],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let wpm = words_per_minute(timed_words, timed_ms);

    let (dictations, average_dictation_words, longest_dictation_words): (i64, f64, i64) = conn
        .query_row(
            "SELECT COUNT(*), COALESCE(AVG(words), 0), COALESCE(MAX(words), 0) FROM activity_log
             WHERE kind = 'dictation' AND timestamp >= ?1",
            params![since_ts],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;
    let languages: Vec<String> = {
        let mut statement = conn.prepare(
            "SELECT language FROM transcription_history
             WHERE language IS NOT NULL AND language != '' AND source_name IS NULL
               AND timestamp >= ?1
             GROUP BY language ORDER BY COUNT(*) DESC LIMIT 3",
        )?;
        let rows = statement.query_map(params![since_ts], |row| row.get(0))?;
        rows.flatten().collect()
    };

    // Week by week, oldest first. Monday starts a week.
    let mut weekly: Vec<(NaiveDate, i64, i64)> = Vec::new();
    {
        let mut statement = conn.prepare(
            "SELECT timestamp, words, duration_ms FROM activity_log
             WHERE kind = 'dictation' AND duration_ms > 0 AND timestamp >= ?1 ORDER BY timestamp",
        )?;
        let rows = statement.query_map(params![since_ts], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })?;
        for row in rows.flatten() {
            let (timestamp, words, ms) = row;
            let Some(day) = Local
                .timestamp_opt(timestamp, 0)
                .single()
                .map(|t| t.date_naive())
            else {
                continue;
            };
            let week = day - Duration::days(i64::from(day.weekday().num_days_from_monday()));
            match weekly.last_mut() {
                Some((w, sum_words, sum_ms)) if *w == week => {
                    *sum_words += words;
                    *sum_ms += ms;
                }
                _ => weekly.push((week, words, ms)),
            }
        }
    }
    let trend: Vec<(NaiveDate, u32)> = weekly
        .iter()
        .filter_map(|(week, words, ms)| words_per_minute(*words, *ms).map(|w| (*week, w)))
        .collect();
    let (wpm_from_day, wpm_from) = match trend.first() {
        Some((week, value)) if trend.len() > 1 => {
            (Some(week.format("%Y-%m-%d").to_string()), Some(*value))
        }
        _ => (None, None),
    };

    // Time saved against typing everything at TYPING_WPM.
    let speaking_wpm = f64::from(wpm.unwrap_or(150).max(TYPING_WPM + 1));
    let minutes_saved = (words_dictated as f64 / f64::from(TYPING_WPM)
        - words_dictated as f64 / speaking_wpm)
        .max(0.0)
        .round() as i64;

    let (rewrites, words_rewritten): (i64, i64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(words), 0) FROM activity_log
         WHERE kind = 'rewrite' AND timestamp >= ?1",
        params![since_ts],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let rewrite_mix: Vec<RewriteShare> = {
        let mut statement = conn.prepare(
            "SELECT detail, COUNT(*) AS n FROM activity_log
             WHERE kind = 'rewrite' AND detail IS NOT NULL AND timestamp >= ?1
             GROUP BY detail ORDER BY n DESC, detail",
        )?;
        let rows = statement.query_map(params![since_ts], |row| {
            Ok(RewriteShare {
                prompt_id: row.get(0)?,
                count: row.get(1)?,
            })
        })?;
        rows.flatten().collect()
    };

    let (listened_ms, longest_read_words, reads): (i64, i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(duration_ms), 0), COALESCE(MAX(words), 0), COUNT(*) FROM activity_log
         WHERE kind = 'read' AND timestamp >= ?1",
        params![since_ts],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    let voice: Option<String> = conn
        .query_row(
            "SELECT voice FROM read_aloud_history WHERE timestamp >= ?1
             GROUP BY voice ORDER BY COUNT(*) DESC, MAX(id) DESC LIMIT 1",
            params![since_ts],
            |row| row.get(0),
        )
        .ok();
    let usual_speed: Option<f32> = conn
        .query_row(
            "SELECT ROUND(speed, 1) AS s FROM activity_log
         WHERE kind = 'read' AND speed IS NOT NULL AND timestamp >= ?1
         GROUP BY s ORDER BY COUNT(*) DESC, s DESC LIMIT 1",
            params![since_ts],
            |row| row.get::<_, f64>(0).map(|s| s as f32),
        )
        .ok();

    let mut apps: Vec<AppShare> = {
        let mut statement = conn.prepare(
            "SELECT MIN(app_name), SUM(words) AS w FROM activity_log
             WHERE kind = 'dictation' AND timestamp >= ?1 AND words > 0
             GROUP BY lower(app_name) ORDER BY w DESC",
        )?;
        let rows = statement.query_map(params![since_ts], |row| {
            Ok(AppShare {
                name: row.get(0)?,
                words: row.get(1)?,
            })
        })?;
        rows.flatten().collect()
    };
    let mut other = 0;
    apps.retain(|app| {
        if app.name.is_none() {
            other += app.words;
            false
        } else {
            true
        }
    });
    if apps.len() > TOP_APPS {
        other += apps.drain(TOP_APPS..).map(|a| a.words).sum::<i64>();
    }
    if other > 0 {
        apps.push(AppShare {
            name: None,
            words: other,
        });
    }

    // Streaks and the calendar come from the daily totals, which go back to
    // before activity was logged.
    let mut totals: HashMap<NaiveDate, i64> = HashMap::new();
    {
        let mut statement = conn.prepare(
            "SELECT day, dictated_words + read_words FROM usage_stats
             WHERE dictated_words + read_words > 0",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for (day, words) in rows.flatten() {
            if let Ok(day) = NaiveDate::parse_from_str(&day, "%Y-%m-%d") {
                totals.insert(day, words);
            }
        }
    }
    let mut active: Vec<NaiveDate> = totals.keys().copied().collect();
    active.sort_unstable_by(|a, b| b.cmp(a));
    let streak_days = crate::features::history::service::streak_days(&active, today);
    let longest_streak_days = longest_streak(&active);

    let first = today
        - Duration::days(i64::from(today.weekday().num_days_from_monday()))
        - Duration::weeks(CALENDAR_WEEKS - 1);
    // Speaking and listening time per day, for the Activity chart.
    let mut durations: HashMap<NaiveDate, (i64, i64)> = HashMap::new();
    {
        let mut statement = conn.prepare(
            "SELECT timestamp, kind, duration_ms FROM activity_log
             WHERE kind IN ('dictation', 'read') AND duration_ms > 0 AND timestamp >= ?1",
        )?;
        let rows = statement.query_map(params![day_start(first)], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })?;
        for (timestamp, kind, ms) in rows.flatten() {
            let Some(day) = Local
                .timestamp_opt(timestamp, 0)
                .single()
                .map(|t| t.date_naive())
            else {
                continue;
            };
            let entry = durations.entry(day).or_default();
            if kind == "dictation" {
                entry.0 += ms;
            } else {
                entry.1 += ms;
            }
        }
    }
    let days = first
        .iter_days()
        .take_while(|day| *day <= today)
        .map(|day| {
            let (speaking_ms, listening_ms) = durations.get(&day).copied().unwrap_or((0, 0));
            DayActivity {
                day: day.format("%Y-%m-%d").to_string(),
                words: totals.get(&day).copied().unwrap_or(0),
                speaking_ms,
                listening_ms,
            }
        })
        .collect();

    Ok(Insights {
        wpm,
        wpm_trend: trend.iter().map(|(_, w)| *w).collect(),
        wpm_from_day,
        wpm_from,
        minutes_saved,
        words_dictated,
        dictations,
        average_dictation_words: average_dictation_words.round() as i64,
        longest_dictation_words,
        languages,
        rewrites,
        words_rewritten,
        rewrite_mix,
        typing_wpm: TYPING_WPM,
        words_read,
        reads,
        voice,
        minutes_listened: (listened_ms as f64 / 60_000.0).round() as i64,
        usual_speed,
        longest_read_words,
        apps,
        streak_days,
        longest_streak_days,
        days,
    })
}

/// The longest run of consecutive days. `active` is sorted newest first.
fn longest_streak(active: &[NaiveDate]) -> u32 {
    let mut longest = 0;
    let mut run = 0;
    let mut previous: Option<NaiveDate> = None;
    for &day in active {
        run = match previous {
            Some(p) if p.pred_opt() == Some(day) => run + 1,
            _ => 1,
        };
        longest = longest.max(run);
        previous = Some(day);
    }
    longest
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        HistoryManager::apply_migrations(&mut conn).unwrap();
        conn
    }

    #[test]
    fn insights_add_up_activity() {
        let conn = conn();
        let today = NaiveDate::from_ymd_opt(2026, 11, 11).unwrap();
        let at = |day: NaiveDate| day_start(day) + 3600;
        for (day, words, app) in [
            (today, 120, Some("Zed")),
            (today, 60, Some("Chrome")),
            (today - Duration::days(1), 30, None),
        ] {
            insert_activity(
                &conn,
                at(day),
                &Activity::Dictation {
                    words,
                    duration_ms: 60_000,
                    app_name: app,
                },
            )
            .unwrap();
            conn.execute(
                "INSERT INTO usage_stats (day, dictated_words) VALUES (?1, ?2)
                 ON CONFLICT(day) DO UPDATE SET dictated_words = dictated_words + excluded.dictated_words",
                params![day.format("%Y-%m-%d").to_string(), words],
            )
            .unwrap();
        }
        insert_activity(
            &conn,
            at(today),
            &Activity::Read {
                words: 300,
                duration_ms: 120_000,
                speed: 1.6,
            },
        )
        .unwrap();
        insert_activity(
            &conn,
            at(today),
            &Activity::Rewrite {
                words: 40,
                prompt_id: "default_refine_polish",
                app_name: Some("Zed"),
            },
        )
        .unwrap();

        let all = insights(&conn, today, None).unwrap();
        assert_eq!(all.words_dictated, 210);
        assert_eq!(all.wpm, Some(70)); // 210 words over 3 minutes
        assert_eq!(all.rewrites, 1);
        assert_eq!(all.minutes_listened, 2);
        assert_eq!(all.usual_speed, Some(1.6));
        assert_eq!(all.longest_read_words, 300);
        assert_eq!(all.apps.len(), 3);
        assert_eq!(all.apps[0].name.as_deref(), Some("Zed"));
        assert_eq!(all.apps[2].name, None); // the unknown app is "Other"
        assert_eq!(all.streak_days, 2);
        assert_eq!(all.longest_streak_days, 2);
        assert_eq!(all.days.last().unwrap().day, "2026-11-11");
        assert_eq!(all.days.first().unwrap().day.len(), 10);
        assert_eq!(all.days.len() % 7, 3); // whole weeks, then Mon..Wed
                                           // 210 words typed at 40 wpm take 5 minutes; spoken at 70, 3.
        assert_eq!(all.minutes_saved, 2);

        assert_eq!(all.dictations, 3);
        assert_eq!(all.average_dictation_words, 70);
        assert_eq!(all.longest_dictation_words, 120);
        assert_eq!(all.reads, 1);
        assert_eq!(all.voice, None); // no read in read_aloud_history
        assert_eq!(all.words_rewritten, 40);
        assert_eq!(all.rewrite_mix.len(), 1);
        assert_eq!(all.rewrite_mix[0].prompt_id, "default_refine_polish");
        assert_eq!(all.rewrite_mix[0].count, 1);
        let today_row = all.days.last().unwrap();
        assert_eq!(today_row.speaking_ms, 120_000); // two dictations today
        assert_eq!(today_row.listening_ms, 120_000);

        let recent = insights(&conn, today, Some(1)).unwrap();
        assert_eq!(recent.words_dictated, 180);
        assert_eq!(recent.dictations, 2);
    }

    #[test]
    fn apps_merge_whatever_their_casing() {
        let conn = conn();
        let today = NaiveDate::from_ymd_opt(2026, 11, 11).unwrap();
        for app in ["Glider", "glider", "Zed"] {
            insert_activity(
                &conn,
                day_start(today) + 60,
                &Activity::Dictation {
                    words: 10,
                    duration_ms: 1_000,
                    app_name: Some(app),
                },
            )
            .unwrap();
        }
        let all = insights(&conn, today, None).unwrap();
        assert_eq!(all.apps.len(), 2);
        assert_eq!(all.apps[0].name.as_deref(), Some("Glider"));
        assert_eq!(all.apps[0].words, 20);
    }

    #[test]
    fn languages_and_voice_come_from_history() {
        let conn = conn();
        let today = NaiveDate::from_ymd_opt(2026, 11, 11).unwrap();
        let at = day_start(today) + 60;
        for (lang, n) in [("en", 3), ("hi", 1)] {
            for _ in 0..n {
                conn.execute(
                    "INSERT INTO transcription_history (file_name, timestamp, title, transcription_text, language)
                     VALUES ('a.wav', ?1, 't', 'text', ?2)",
                    params![at, lang],
                )
                .unwrap();
            }
        }
        for voice in ["Kokoro", "Supertonic 3", "Supertonic 3"] {
            conn.execute(
                "INSERT INTO read_aloud_history (timestamp, text, voice, speed) VALUES (?1, 'x', ?2, 1.0)",
                params![at, voice],
            )
            .unwrap();
        }
        let all = insights(&conn, today, None).unwrap();
        assert_eq!(all.languages, vec!["en", "hi"]);
        assert_eq!(all.voice.as_deref(), Some("Supertonic 3"));
    }

    #[test]
    fn longest_streak_finds_the_longest_run() {
        let d = |n: u32| NaiveDate::from_ymd_opt(2026, 11, n).unwrap();
        assert_eq!(longest_streak(&[d(10), d(9), d(5), d(4), d(3)]), 3);
        assert_eq!(longest_streak(&[]), 0);
    }
}
