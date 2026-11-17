use anyhow::{anyhow, Result};
use chrono::{DateTime, Local, Utc};
use log::{debug, error, info, warn};
use rusqlite::{params, Connection, OptionalExtension};
use rusqlite_migration::{MigrationDefinitionError, Migrations, M};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_specta::Event;

use crate::features::stt::language::detection::{LanguageDecision, LanguageSource};

/// Database migrations for transcription history.
/// Each migration is applied in order. The library tracks which migrations
/// have been applied using SQLite's user_version pragma.
///
/// Note: For users upgrading from tauri-plugin-sql, migrate_from_tauri_plugin_sql()
/// converts the old _sqlx_migrations table tracking to the user_version pragma,
/// ensuring migrations don't re-run on existing databases.
static MIGRATIONS: &[M] = &[
    M::up(
        "CREATE TABLE IF NOT EXISTS transcription_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            saved BOOLEAN NOT NULL DEFAULT 0,
            title TEXT NOT NULL,
            transcription_text TEXT NOT NULL
        );",
    ),
    M::up("ALTER TABLE transcription_history ADD COLUMN post_processed_text TEXT;"),
    M::up("ALTER TABLE transcription_history ADD COLUMN post_process_prompt TEXT;"),
    M::up("ALTER TABLE transcription_history ADD COLUMN post_process_requested BOOLEAN NOT NULL DEFAULT 0;"),
];

/// Nullable columns added outside [`MIGRATIONS`]; see
/// [`HistoryManager::apply_migrations`].
const ADDED_COLUMNS: &[&str] = &["source_name", "language", "language_source"];

/// Glider tables that gained a `saved` column after they shipped. Saved rows
/// are kept when old ones are trimmed.
const SAVED_TABLES: &[&str] = &["read_aloud_history", "refine_history"];

/// Glider's own tables (Read Aloud history and daily word counts). Created if
/// missing rather than as migrations, so Glider's schema never collides with a
/// migration Glider adds upstream.
const GLIDER_TABLES: &str = "
    CREATE TABLE IF NOT EXISTS read_aloud_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        text TEXT NOT NULL,
        voice TEXT NOT NULL,
        speed REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usage_stats (
        day TEXT PRIMARY KEY,
        dictated_words INTEGER NOT NULL DEFAULT 0,
        read_words INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        kind TEXT NOT NULL,
        words INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        app_name TEXT,
        speed REAL,
        detail TEXT
    );
    CREATE INDEX IF NOT EXISTS activity_log_kind_time ON activity_log (kind, timestamp);
    CREATE TABLE IF NOT EXISTS refine_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        prompt_id TEXT NOT NULL,
        prompt_name TEXT NOT NULL,
        model TEXT NOT NULL,
        before_text TEXT NOT NULL,
        after_text TEXT NOT NULL,
        rating INTEGER,
        app_name TEXT
    );";

/// Read Aloud keeps this many recent reads.
const READ_ALOUD_HISTORY_LIMIT: i64 = 200;

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct ReadAloudEntry {
    pub id: i64,
    pub timestamp: i64,
    pub text: String,
    pub voice: String,
    pub speed: f32,
    pub saved: bool,
}

/// One rewrite, as History lists it.
#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct RewriteEntry {
    pub id: i64,
    pub timestamp: i64,
    pub prompt_name: String,
    pub before: String,
    pub after: String,
    pub app_name: Option<String>,
    pub saved: bool,
}

/// Totals for the Home page.
#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct UsageStats {
    pub dictated_words: i64,
    pub read_words: i64,
    /// Consecutive days with any dictation or read, ending today or yesterday.
    pub streak_days: u32,
}

pub enum Usage {
    Dictated,
    Read,
}

/// Words in `text`, as the stats count them.
pub fn word_count(text: &str) -> i64 {
    text.split_whitespace().count() as i64
}

/// Days in a row ending today (or yesterday, so a streak survives until the
/// day is over). `active_days` must be sorted newest first.
pub(crate) fn streak_days(active_days: &[chrono::NaiveDate], today: chrono::NaiveDate) -> u32 {
    let mut expected = match active_days.first() {
        Some(&day) if day == today || Some(day) == today.pred_opt() => day,
        _ => return 0,
    };
    let mut streak = 0;
    for &day in active_days {
        if day != expected {
            break;
        }
        streak += 1;
        match expected.pred_opt() {
            Some(previous) => expected = previous,
            None => break,
        }
    }
    streak
}

/// Unsaved dictations that still have a recording, past the newest `limit`.
/// Transcribed files are only ever deleted explicitly, and don't count.
fn recordings_beyond(conn: &Connection, limit: usize) -> Result<Vec<(i64, String)>> {
    let mut statement = conn.prepare(
        "SELECT id, file_name FROM transcription_history
         WHERE saved = 0 AND source_name IS NULL AND file_name != ''
         ORDER BY timestamp DESC LIMIT -1 OFFSET ?1",
    )?;
    let rows = statement
        .query_map(params![limit as i64], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// Saved rewrites, newest first.
fn rewrite_entries(conn: &Connection) -> Result<Vec<RewriteEntry>> {
    let mut statement = conn.prepare(
        "SELECT id, timestamp, prompt_name, before_text, after_text, app_name, saved
         FROM refine_history ORDER BY id DESC",
    )?;
    let entries = statement
        .query_map([], |row| {
            Ok(RewriteEntry {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                prompt_name: row.get(2)?,
                before: row.get(3)?,
                after: row.get(4)?,
                app_name: row.get(5)?,
                saved: row.get(6)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(entries)
}

/// Every column a [`HistoryEntry`] is read from.
const ENTRY_COLUMNS: &str = "id, file_name, timestamp, saved, title, transcription_text, \
    post_processed_text, post_process_prompt, post_process_requested, source_name, language, \
    language_source";

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct PaginatedHistory {
    pub entries: Vec<HistoryEntry>,
    pub has_more: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(tag = "action")]
pub enum HistoryUpdatePayload {
    #[serde(rename = "added")]
    Added { entry: HistoryEntry },
    #[serde(rename = "updated")]
    Updated { entry: HistoryEntry },
    #[serde(rename = "deleted")]
    Deleted { id: i64 },
    #[serde(rename = "toggled")]
    Toggled { id: i64 },
}

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct HistoryEntry {
    pub id: i64,
    pub file_name: String,
    pub timestamp: i64,
    pub saved: bool,
    pub title: String,
    pub transcription_text: String,
    pub post_processed_text: Option<String>,
    pub post_process_prompt: Option<String>,
    pub post_process_requested: bool,
    /// The name of the file this entry was transcribed from; `None` for a
    /// dictation.
    pub source_name: Option<String>,
    /// The language it was transcribed in, when known.
    pub language: Option<String>,
    /// How that language was chosen; `None` before it was recorded.
    pub language_source: Option<LanguageSource>,
}

pub struct HistoryManager {
    app_handle: AppHandle,
    recordings_dir: PathBuf,
    db_path: PathBuf,
}

/// A transcription's language as its two columns.
fn split_language(language: Option<LanguageDecision>) -> (Option<String>, Option<LanguageSource>) {
    match language {
        Some(decision) => (decision.language, Some(decision.source)),
        None => (None, None),
    }
}

impl HistoryManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self> {
        // Create recordings directory in app data dir
        let app_data_dir = crate::common::system::portable::app_data_dir(app_handle)?;
        let recordings_dir = app_data_dir.join("recordings");
        let db_path = app_data_dir.join("history.db");

        // Ensure recordings directory exists
        if !recordings_dir.exists() {
            fs::create_dir_all(&recordings_dir)?;
            debug!("Created recordings directory: {:?}", recordings_dir);
        }

        let manager = Self {
            app_handle: app_handle.clone(),
            recordings_dir,
            db_path,
        };

        // Initialize database and run migrations synchronously
        manager.init_database()?;

        Ok(manager)
    }

    fn init_database(&self) -> Result<()> {
        info!("Initializing database at {:?}", self.db_path);

        let mut conn = Connection::open(&self.db_path)?;

        // Handle migration from tauri-plugin-sql to rusqlite_migration
        // tauri-plugin-sql used _sqlx_migrations table, rusqlite_migration uses user_version pragma
        self.migrate_from_tauri_plugin_sql(&conn)?;

        // Validate migrations in debug builds
        #[cfg(debug_assertions)]
        Migrations::new(MIGRATIONS.to_vec())
            .validate()
            .expect("Invalid migrations");

        // Get current version before migration
        let version_before: i32 =
            conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
        debug!("Database version before migration: {}", version_before);

        Self::apply_migrations(&mut conn)?;

        // Get version after migration
        let version_after: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

        if version_after > version_before {
            info!(
                "Database migrated from version {} to {}",
                version_before, version_after
            );
        } else {
            debug!("Database already at latest version {}", version_after);
        }

        Ok(())
    }

    /// Bring the schema up to date. A newer Glider's database opens as is:
    /// migrations only add columns, and every query names its columns.
    pub(crate) fn apply_migrations(conn: &mut Connection) -> Result<()> {
        match Migrations::new(MIGRATIONS.to_vec()).to_latest(conn) {
            Err(rusqlite_migration::Error::MigrationDefinition(
                MigrationDefinitionError::DatabaseTooFarAhead,
            )) => {
                warn!("history.db is from a newer version of Glider; opening it without migrating")
            }
            other => other?,
        }

        // Glider's tables. The first time, seed word counts from the
        // dictations already in history so Home's totals don't start at zero.
        let seed_stats = !Self::has_table(conn, "usage_stats")?;
        conn.execute_batch(GLIDER_TABLES)?;
        if seed_stats {
            conn.execute(
                "INSERT INTO usage_stats (day, dictated_words)
                 SELECT date(timestamp, 'unixepoch', 'localtime'),
                        SUM(CASE WHEN trim(transcription_text) = '' THEN 0
                            ELSE length(trim(transcription_text))
                               - length(replace(trim(transcription_text), ' ', '')) + 1 END)
                 FROM transcription_history GROUP BY 1",
                [],
            )?;
        }

        // Not a migration: a higher user_version makes released builds refuse
        // the database, while an extra nullable column is invisible to them.
        for column in ADDED_COLUMNS {
            if !Self::has_column(conn, "transcription_history", column)? {
                conn.execute(
                    &format!("ALTER TABLE transcription_history ADD COLUMN {column} TEXT"),
                    [],
                )?;
                info!("Added the {column} column to transcription history");
            }
        }
        for table in SAVED_TABLES {
            if !Self::has_column(conn, table, "saved")? {
                conn.execute(
                    &format!("ALTER TABLE {table} ADD COLUMN saved INTEGER NOT NULL DEFAULT 0"),
                    [],
                )?;
                info!("Added the saved column to {table}");
            }
        }

        Ok(())
    }

    fn has_table(conn: &Connection, name: &str) -> Result<bool> {
        Ok(conn.query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = ?1",
            [name],
            |row| row.get(0),
        )?)
    }

    /// Adds `words` to today's count for `usage`.
    pub fn record_usage(&self, usage: Usage, words: i64) -> Result<()> {
        if words <= 0 {
            return Ok(());
        }
        let column = match usage {
            Usage::Dictated => "dictated_words",
            Usage::Read => "read_words",
        };
        let today = Local::now().format("%Y-%m-%d").to_string();
        self.get_connection()?.execute(
            &format!(
                "INSERT INTO usage_stats (day, {column}) VALUES (?1, ?2)
                 ON CONFLICT(day) DO UPDATE SET {column} = {column} + excluded.{column}"
            ),
            params![today, words],
        )?;
        Ok(())
    }

    pub fn usage_stats(&self) -> Result<UsageStats> {
        let conn = self.get_connection()?;
        let (dictated_words, read_words) = conn.query_row(
            "SELECT COALESCE(SUM(dictated_words), 0), COALESCE(SUM(read_words), 0) FROM usage_stats",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let mut statement = conn.prepare(
            "SELECT day FROM usage_stats WHERE dictated_words + read_words > 0 ORDER BY day DESC",
        )?;
        let active_days = statement
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|day| day.ok())
            .filter_map(|day| chrono::NaiveDate::parse_from_str(&day, "%Y-%m-%d").ok())
            .collect::<Vec<_>>();
        Ok(UsageStats {
            dictated_words,
            read_words,
            streak_days: streak_days(&active_days, Local::now().date_naive()),
        })
    }

    /// Saves a Read Aloud read and counts its words.
    pub fn save_read_aloud(&self, text: &str, voice: &str, speed: f32) -> Result<()> {
        let conn = self.get_connection()?;
        conn.execute(
            "INSERT INTO read_aloud_history (timestamp, text, voice, speed) VALUES (?1, ?2, ?3, ?4)",
            params![Utc::now().timestamp(), text, voice, speed],
        )?;
        conn.execute(
            "DELETE FROM read_aloud_history WHERE saved = 0 AND id NOT IN
             (SELECT id FROM read_aloud_history WHERE saved = 0 ORDER BY id DESC LIMIT ?1)",
            params![READ_ALOUD_HISTORY_LIMIT],
        )?;
        self.record_usage(Usage::Read, word_count(text))
    }

    pub fn read_aloud_entries(&self) -> Result<Vec<ReadAloudEntry>> {
        let conn = self.get_connection()?;
        let mut statement = conn.prepare(
            "SELECT id, timestamp, text, voice, speed, saved FROM read_aloud_history ORDER BY id DESC",
        )?;
        let entries = statement
            .query_map([], |row| {
                Ok(ReadAloudEntry {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    text: row.get(2)?,
                    voice: row.get(3)?,
                    speed: row.get(4)?,
                    saved: row.get(5)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(entries)
    }

    pub fn delete_read_aloud_entry(&self, id: i64) -> Result<()> {
        self.get_connection()?
            .execute("DELETE FROM read_aloud_history WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn rewrite_entries(&self) -> Result<Vec<RewriteEntry>> {
        rewrite_entries(&self.get_connection()?)
    }

    pub fn toggle_read_aloud_saved(&self, id: i64) -> Result<()> {
        self.get_connection()?.execute(
            "UPDATE read_aloud_history SET saved = NOT saved WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn toggle_rewrite_saved(&self, id: i64) -> Result<()> {
        self.get_connection()?.execute(
            "UPDATE refine_history SET saved = NOT saved WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn delete_rewrite_entry(&self, id: i64) -> Result<()> {
        self.get_connection()?
            .execute("DELETE FROM refine_history WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn has_column(conn: &Connection, table: &str, name: &str) -> Result<bool> {
        Ok(conn.query_row(
            "SELECT COUNT(*) > 0 FROM pragma_table_info(?1) WHERE name = ?2",
            [table, name],
            |row| row.get(0),
        )?)
    }

    /// Migrate from tauri-plugin-sql's migration tracking to rusqlite_migration's.
    /// tauri-plugin-sql used a _sqlx_migrations table, while rusqlite_migration uses
    /// SQLite's user_version pragma. This function checks if the old system was in use
    /// and sets the user_version accordingly so migrations don't re-run.
    fn migrate_from_tauri_plugin_sql(&self, conn: &Connection) -> Result<()> {
        // Check if the old _sqlx_migrations table exists
        let has_sqlx_migrations: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='_sqlx_migrations'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_sqlx_migrations {
            return Ok(());
        }

        // Check current user_version
        let current_version: i32 =
            conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

        if current_version > 0 {
            // Already migrated to rusqlite_migration system
            return Ok(());
        }

        // Get the highest version from the old migrations table
        let old_version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM _sqlx_migrations WHERE success = 1",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if old_version > 0 {
            info!(
                "Migrating from tauri-plugin-sql (version {}) to rusqlite_migration",
                old_version
            );

            // Set user_version to match the old migration state
            conn.pragma_update(None, "user_version", old_version)?;

            // Optionally drop the old migrations table (keeping it doesn't hurt)
            // conn.execute("DROP TABLE IF EXISTS _sqlx_migrations", [])?;

            info!(
                "Migration tracking converted: user_version set to {}",
                old_version
            );
        }

        Ok(())
    }

    pub(crate) fn get_connection(&self) -> Result<Connection> {
        Ok(Connection::open(&self.db_path)?)
    }

    fn map_history_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<HistoryEntry> {
        Ok(HistoryEntry {
            id: row.get("id")?,
            file_name: row.get("file_name")?,
            timestamp: row.get("timestamp")?,
            saved: row.get("saved")?,
            title: row.get("title")?,
            transcription_text: row.get("transcription_text")?,
            post_processed_text: row.get("post_processed_text")?,
            post_process_prompt: row.get("post_process_prompt")?,
            post_process_requested: row.get("post_process_requested")?,
            source_name: row.get("source_name")?,
            language: row.get("language")?,
            language_source: row
                .get::<_, Option<String>>("language_source")?
                .as_deref()
                .and_then(LanguageSource::parse),
        })
    }

    pub fn recordings_dir(&self) -> &std::path::Path {
        &self.recordings_dir
    }

    /// Save a new history entry to the database.
    /// The WAV file should already have been written to the recordings directory.
    pub fn save_entry(
        &self,
        file_name: String,
        transcription_text: String,
        post_process_requested: bool,
        post_processed_text: Option<String>,
        post_process_prompt: Option<String>,
        language: Option<LanguageDecision>,
    ) -> Result<HistoryEntry> {
        let (language, language_source) = split_language(language);
        let entry = self.insert_entry(HistoryEntry {
            id: 0,
            file_name,
            timestamp: Utc::now().timestamp(),
            saved: false,
            title: String::new(),
            transcription_text,
            post_processed_text,
            post_process_prompt,
            post_process_requested,
            source_name: None,
            language,
            language_source,
        })?;
        // Stats never block saving the dictation.
        let spoken = entry
            .post_processed_text
            .as_deref()
            .unwrap_or(&entry.transcription_text);
        if let Err(e) = self.record_usage(Usage::Dictated, word_count(spoken)) {
            warn!("Failed to record dictation words: {e}");
        }

        self.cleanup_old_entries()?;

        Ok(entry)
    }

    /// Save the entry for a file whose audio is already at `file_name`.
    /// Retention never removes it (only deleting it does); never
    /// post-processed.
    pub fn save_file_entry(&self, file_name: String, source_name: String) -> Result<HistoryEntry> {
        self.insert_entry(HistoryEntry {
            id: 0,
            file_name,
            timestamp: Utc::now().timestamp(),
            saved: false,
            title: String::new(),
            transcription_text: String::new(),
            post_processed_text: None,
            post_process_prompt: None,
            post_process_requested: false,
            source_name: Some(source_name),
            language: None,
            language_source: None,
        })
    }

    /// Insert `entry`, filling in its id and title, and announce it.
    fn insert_entry(&self, mut entry: HistoryEntry) -> Result<HistoryEntry> {
        entry.title = self.format_timestamp_title(entry.timestamp);

        let conn = self.get_connection()?;
        conn.execute(
            "INSERT INTO transcription_history (
                file_name,
                timestamp,
                saved,
                title,
                transcription_text,
                post_processed_text,
                post_process_prompt,
                post_process_requested,
                source_name,
                language,
                language_source
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                &entry.file_name,
                entry.timestamp,
                entry.saved,
                &entry.title,
                &entry.transcription_text,
                &entry.post_processed_text,
                &entry.post_process_prompt,
                entry.post_process_requested,
                &entry.source_name,
                &entry.language,
                entry.language_source.map(LanguageSource::as_str),
            ],
        )?;
        entry.id = conn.last_insert_rowid();

        debug!("Saved history entry with id {}", entry.id);

        // Emit typed event for real-time frontend updates
        if let Err(e) = (HistoryUpdatePayload::Added {
            entry: entry.clone(),
        })
        .emit(&self.app_handle)
        {
            error!("Failed to emit history-updated event: {}", e);
        }

        Ok(entry)
    }

    /// Update an existing history entry with new transcription results (used by retry).
    pub fn update_transcription(
        &self,
        id: i64,
        transcription_text: String,
        post_processed_text: Option<String>,
        post_process_prompt: Option<String>,
        language: Option<LanguageDecision>,
    ) -> Result<HistoryEntry> {
        let (language, language_source) = split_language(language);
        let conn = self.get_connection()?;
        let updated = conn.execute(
            "UPDATE transcription_history
             SET transcription_text = ?1,
                 post_processed_text = ?2,
                 post_process_prompt = ?3,
                 language = ?4,
                 language_source = ?5
             WHERE id = ?6",
            params![
                transcription_text,
                post_processed_text,
                post_process_prompt,
                language,
                language_source.map(LanguageSource::as_str),
                id
            ],
        )?;

        if updated == 0 {
            return Err(anyhow!("History entry {} not found", id));
        }

        let entry = conn.query_row(
            &format!("SELECT {ENTRY_COLUMNS} FROM transcription_history WHERE id = ?1"),
            params![id],
            Self::map_history_entry,
        )?;

        debug!("Updated transcription for history entry {}", id);

        if let Err(e) = (HistoryUpdatePayload::Updated {
            entry: entry.clone(),
        })
        .emit(&self.app_handle)
        {
            error!("Failed to emit history-updated event: {}", e);
        }

        Ok(entry)
    }

    pub fn cleanup_old_entries(&self) -> Result<()> {
        let retention_period =
            crate::common::settings::get_recording_retention_period(&self.app_handle);

        match retention_period {
            crate::common::settings::RecordingRetentionPeriod::Never => {
                // Don't delete anything
                Ok(())
            }
            crate::common::settings::RecordingRetentionPeriod::PreserveLimit => {
                // Use the old count-based logic with history_limit
                let limit = crate::common::settings::get_history_limit(&self.app_handle);
                self.cleanup_by_count(limit)
            }
            _ => {
                // Use time-based logic
                self.cleanup_by_time(retention_period)
            }
        }
    }

    /// Deletes these entries' recordings to save space. Their text stays in
    /// History; an empty `file_name` marks an entry whose audio is gone.
    fn delete_recordings(&self, entries: &[(i64, String)]) -> Result<usize> {
        if entries.is_empty() {
            return Ok(0);
        }

        let conn = self.get_connection()?;
        let mut deleted_count = 0;

        for (id, file_name) in entries {
            let file_path = self.recordings_dir.join(file_name);
            if file_path.exists() {
                if let Err(e) = fs::remove_file(&file_path) {
                    // Keep the name so the next cleanup tries again.
                    error!("Failed to delete WAV file {}: {}", file_name, e);
                    continue;
                }
                debug!("Deleted old WAV file: {}", file_name);
                deleted_count += 1;
            }
            conn.execute(
                "UPDATE transcription_history SET file_name = '' WHERE id = ?1",
                params![id],
            )?;
        }

        Ok(deleted_count)
    }

    fn cleanup_by_count(&self, limit: usize) -> Result<()> {
        let old = recordings_beyond(&self.get_connection()?, limit)?;
        let deleted_count = self.delete_recordings(&old)?;
        if deleted_count > 0 {
            debug!("Deleted {} old recordings by count", deleted_count);
        }
        Ok(())
    }

    fn cleanup_by_time(
        &self,
        retention_period: crate::common::settings::RecordingRetentionPeriod,
    ) -> Result<()> {
        let conn = self.get_connection()?;

        // Calculate cutoff timestamp (current time minus retention period)
        let now = Utc::now().timestamp();
        let cutoff_timestamp = match retention_period {
            crate::common::settings::RecordingRetentionPeriod::Days3 => now - (3 * 24 * 60 * 60), // 3 days in seconds
            crate::common::settings::RecordingRetentionPeriod::Weeks2 => {
                now - (2 * 7 * 24 * 60 * 60)
            } // 2 weeks in seconds
            crate::common::settings::RecordingRetentionPeriod::Months3 => {
                now - (3 * 30 * 24 * 60 * 60)
            } // 3 months in seconds (approximate)
            _ => unreachable!("Should not reach here"),
        };

        // Recordings of unsaved dictations older than the cutoff; transcribed
        // files are only ever deleted explicitly.
        let mut stmt = conn.prepare(
            "SELECT id, file_name FROM transcription_history
             WHERE saved = 0 AND source_name IS NULL AND file_name != '' AND timestamp < ?1",
        )?;

        let rows = stmt.query_map(params![cutoff_timestamp], |row| {
            Ok((row.get::<_, i64>("id")?, row.get::<_, String>("file_name")?))
        })?;

        let mut entries_to_delete: Vec<(i64, String)> = Vec::new();
        for row in rows {
            entries_to_delete.push(row?);
        }

        let deleted_count = self.delete_recordings(&entries_to_delete)?;

        if deleted_count > 0 {
            debug!(
                "Deleted {} old recordings based on retention period",
                deleted_count
            );
        }

        Ok(())
    }

    pub async fn get_history_entries(
        &self,
        cursor: Option<i64>,
        limit: Option<usize>,
        saved_only: bool,
    ) -> Result<PaginatedHistory> {
        let conn = self.get_connection()?;
        let limit = limit.map(|l| l.min(100));
        let saved = if saved_only { "saved = 1" } else { "1" };

        let mut entries: Vec<HistoryEntry> = match (cursor, limit) {
            (Some(cursor_id), Some(lim)) => {
                let fetch_count = (lim + 1) as i64;
                let mut stmt = conn.prepare(&format!(
                    "SELECT {ENTRY_COLUMNS}
                     FROM transcription_history
                     WHERE id < ?1 AND {saved}
                     ORDER BY id DESC
                     LIMIT ?2"
                ))?;
                let result = stmt
                    .query_map(params![cursor_id, fetch_count], Self::map_history_entry)?
                    .collect::<std::result::Result<Vec<_>, _>>()?;
                result
            }
            (None, Some(lim)) => {
                let fetch_count = (lim + 1) as i64;
                let mut stmt = conn.prepare(&format!(
                    "SELECT {ENTRY_COLUMNS}
                     FROM transcription_history
                     WHERE {saved}
                     ORDER BY id DESC
                     LIMIT ?1"
                ))?;
                let result = stmt
                    .query_map(params![fetch_count], Self::map_history_entry)?
                    .collect::<std::result::Result<Vec<_>, _>>()?;
                result
            }
            (_, None) => {
                let mut stmt = conn.prepare(&format!(
                    "SELECT {ENTRY_COLUMNS}
                     FROM transcription_history
                     WHERE {saved}
                     ORDER BY id DESC"
                ))?;
                let result = stmt
                    .query_map([], Self::map_history_entry)?
                    .collect::<std::result::Result<Vec<_>, _>>()?;
                result
            }
        };

        let has_more = limit.is_some_and(|lim| entries.len() > lim);
        if has_more {
            entries.pop();
        }

        Ok(PaginatedHistory { entries, has_more })
    }

    #[cfg(test)]
    fn get_latest_entry_with_conn(conn: &Connection) -> Result<Option<HistoryEntry>> {
        let mut stmt = conn.prepare(&format!(
            "SELECT {ENTRY_COLUMNS}
             FROM transcription_history
             ORDER BY timestamp DESC
             LIMIT 1"
        ))?;

        let entry = stmt.query_row([], Self::map_history_entry).optional()?;
        Ok(entry)
    }

    /// Get the latest dictation with non-empty transcription text. Files are
    /// left out: a long file's transcript is never the "last transcript".
    pub fn get_latest_completed_entry(&self) -> Result<Option<HistoryEntry>> {
        let conn = self.get_connection()?;
        Self::get_latest_completed_entry_with_conn(&conn)
    }

    fn get_latest_completed_entry_with_conn(conn: &Connection) -> Result<Option<HistoryEntry>> {
        let mut stmt = conn.prepare(&format!(
            "SELECT {ENTRY_COLUMNS}
             FROM transcription_history
             WHERE transcription_text != '' AND source_name IS NULL
             ORDER BY timestamp DESC
             LIMIT 1"
        ))?;

        let entry = stmt.query_row([], Self::map_history_entry).optional()?;
        Ok(entry)
    }

    pub async fn toggle_saved_status(&self, id: i64) -> Result<()> {
        let conn = self.get_connection()?;

        // Get current saved status
        let current_saved: bool = conn.query_row(
            "SELECT saved FROM transcription_history WHERE id = ?1",
            params![id],
            |row| row.get("saved"),
        )?;

        let new_saved = !current_saved;

        conn.execute(
            "UPDATE transcription_history SET saved = ?1 WHERE id = ?2",
            params![new_saved, id],
        )?;

        debug!("Toggled saved status for entry {}: {}", id, new_saved);

        // Emit history updated event
        if let Err(e) = (HistoryUpdatePayload::Toggled { id }).emit(&self.app_handle) {
            error!("Failed to emit history-updated event: {}", e);
        }

        Ok(())
    }

    pub fn get_audio_file_path(&self, file_name: &str) -> PathBuf {
        self.recordings_dir.join(file_name)
    }

    pub async fn get_entry_by_id(&self, id: i64) -> Result<Option<HistoryEntry>> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {ENTRY_COLUMNS}
             FROM transcription_history
             WHERE id = ?1"
        ))?;

        let entry = stmt.query_row([id], Self::map_history_entry).optional()?;

        Ok(entry)
    }

    pub async fn delete_entry(&self, id: i64) -> Result<()> {
        let conn = self.get_connection()?;

        // Get the entry to find the file name
        if let Some(entry) = self.get_entry_by_id(id).await? {
            // Delete the audio file first, unless cleanup already did.
            let file_path = self.get_audio_file_path(&entry.file_name);
            if !entry.file_name.is_empty() && file_path.exists() {
                if let Err(e) = fs::remove_file(&file_path) {
                    error!("Failed to delete audio file {}: {}", entry.file_name, e);
                    // Continue with database deletion even if file deletion fails
                }
            }
        }

        // Delete from database
        conn.execute(
            "DELETE FROM transcription_history WHERE id = ?1",
            params![id],
        )?;

        debug!("Deleted history entry with id: {}", id);

        // Emit history updated event
        if let Err(e) = (HistoryUpdatePayload::Deleted { id }).emit(&self.app_handle) {
            error!("Failed to emit history-updated event: {}", e);
        }

        Ok(())
    }

    fn format_timestamp_title(&self, timestamp: i64) -> String {
        if let Some(utc_datetime) = DateTime::from_timestamp(timestamp, 0) {
            // Convert UTC to local timezone
            let local_datetime = utc_datetime.with_timezone(&Local);
            local_datetime.format("%B %e, %Y - %l:%M%p").to_string()
        } else {
            format!("Recording {}", timestamp)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streak_counts_consecutive_days_ending_today_or_yesterday() {
        let day = |d: u32| chrono::NaiveDate::from_ymd_opt(2026, 11, d).unwrap();
        assert_eq!(streak_days(&[day(10), day(9), day(8), day(6)], day(10)), 3);
        // Yesterday still counts until today is over.
        assert_eq!(streak_days(&[day(9), day(8)], day(10)), 2);
        assert_eq!(streak_days(&[day(7)], day(10)), 0);
        assert_eq!(streak_days(&[], day(10)), 0);
    }

    #[test]
    fn glider_tables_record_reads_and_words() {
        let mut conn = Connection::open_in_memory().unwrap();
        HistoryManager::apply_migrations(&mut conn).unwrap();
        // Applying twice is safe: the tables are created only if missing.
        HistoryManager::apply_migrations(&mut conn).unwrap();
        conn.execute(
            "INSERT INTO usage_stats (day, read_words) VALUES ('2026-11-10', 3)
             ON CONFLICT(day) DO UPDATE SET read_words = read_words + excluded.read_words",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO usage_stats (day, read_words) VALUES ('2026-11-10', 4)
             ON CONFLICT(day) DO UPDATE SET read_words = read_words + excluded.read_words",
            [],
        )
        .unwrap();
        let read: i64 = conn
            .query_row(
                "SELECT read_words FROM usage_stats WHERE day = '2026-11-10'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(read, 7);
    }

    #[test]
    fn only_recordings_past_the_limit_are_dropped() {
        let conn = setup_conn();
        // (file, timestamp, saved, source): newest first after sorting.
        for (file, timestamp, saved, source) in [
            ("a.wav", 5, false, None),
            ("b.wav", 4, false, None),
            ("", 3, false, None),               // audio already gone
            ("c.wav", 2, true, None),           // starred: keeps its audio
            ("d.wav", 1, false, Some("x.mp3")), // transcribed file
            ("e.wav", 0, false, None),
        ] {
            conn.execute(
                "INSERT INTO transcription_history (file_name, timestamp, saved, title, transcription_text, source_name)
                 VALUES (?1, ?2, ?3, 't', 'text', ?4)",
                params![file, timestamp, saved, source],
            )
            .unwrap();
        }
        let names = |limit| -> Vec<String> {
            recordings_beyond(&conn, limit)
                .unwrap()
                .into_iter()
                .map(|(_, name)| name)
                .collect()
        };
        assert_eq!(names(1), vec!["b.wav", "e.wav"]);
        assert_eq!(names(3), Vec::<String>::new());
    }

    #[test]
    fn glider_tables_gain_a_saved_column() {
        let mut conn = Connection::open_in_memory().unwrap();
        HistoryManager::apply_migrations(&mut conn).unwrap();
        for table in SAVED_TABLES {
            assert!(
                HistoryManager::has_column(&conn, table, "saved").unwrap(),
                "{table}"
            );
        }
        assert!(!HistoryManager::has_column(&conn, "read_aloud_history", "nope").unwrap());
    }

    #[test]
    fn rewrite_entries_list_newest_first() {
        let mut conn = Connection::open_in_memory().unwrap();
        HistoryManager::apply_migrations(&mut conn).unwrap();
        for (timestamp, after, app) in [(1, "first", None), (2, "second", Some("Slack"))] {
            conn.execute(
                "INSERT INTO refine_history
                 (timestamp, prompt_id, prompt_name, model, before_text, after_text, app_name)
                 VALUES (?1, 'default_refine_polish', 'Polish', 'Qwen3 4B', 'raw', ?2, ?3)",
                params![timestamp, after, app],
            )
            .unwrap();
        }
        let entries = rewrite_entries(&conn).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].after, "second");
        assert_eq!(entries[0].app_name.as_deref(), Some("Slack"));
        assert_eq!(entries[1].before, "raw");
        assert_eq!(entries[1].app_name, None);
    }
    use rusqlite::{params, Connection};

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch(
            "CREATE TABLE transcription_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                saved BOOLEAN NOT NULL DEFAULT 0,
                title TEXT NOT NULL,
                transcription_text TEXT NOT NULL,
                post_processed_text TEXT,
                post_process_prompt TEXT,
                post_process_requested BOOLEAN NOT NULL DEFAULT 0,
                source_name TEXT,
                language TEXT,
                language_source TEXT
            );",
        )
        .expect("create transcription_history table");
        conn
    }

    fn insert_entry(conn: &Connection, timestamp: i64, text: &str, post_processed: Option<&str>) {
        conn.execute(
            "INSERT INTO transcription_history (
                file_name,
                timestamp,
                saved,
                title,
                transcription_text,
                post_processed_text,
                post_process_prompt,
                post_process_requested
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                format!("glider-{}.wav", timestamp),
                timestamp,
                false,
                format!("Recording {}", timestamp),
                text,
                post_processed,
                Option::<String>::None,
                false,
            ],
        )
        .expect("insert history entry");
    }

    fn user_version(conn: &Connection) -> i32 {
        conn.pragma_query_value(None, "user_version", |row| row.get(0))
            .expect("read user_version")
    }

    #[test]
    fn migrating_adds_columns_without_raising_the_version() {
        let mut conn = Connection::open_in_memory().expect("open in-memory db");
        HistoryManager::apply_migrations(&mut conn).expect("migrate");
        for column in ADDED_COLUMNS {
            assert!(
                HistoryManager::has_column(&conn, "transcription_history", column)
                    .expect("read table info")
            );
        }
        assert_eq!(user_version(&conn), MIGRATIONS.len() as i32);

        // Opening it again changes nothing.
        HistoryManager::apply_migrations(&mut conn).expect("migrate again");
        assert_eq!(user_version(&conn), MIGRATIONS.len() as i32);
    }

    #[test]
    fn a_database_from_a_newer_handy_still_opens() {
        let mut conn = Connection::open_in_memory().expect("open in-memory db");
        HistoryManager::apply_migrations(&mut conn).expect("migrate");
        conn.execute(
            "ALTER TABLE transcription_history ADD COLUMN from_the_future TEXT",
            [],
        )
        .expect("add newer column");
        conn.pragma_update(None, "user_version", MIGRATIONS.len() as i32 + 3)
            .expect("set newer version");

        HistoryManager::apply_migrations(&mut conn).expect("open newer database");
        insert_entry(&conn, 100, "still works", None);
        let entry = HistoryManager::get_latest_entry_with_conn(&conn)
            .expect("fetch latest entry")
            .expect("entry exists");
        assert_eq!(entry.transcription_text, "still works");
    }

    #[test]
    fn reads_the_language_and_ignores_an_unknown_source() {
        let conn = setup_conn();
        let latest = |source: &str| {
            conn.execute(
                "INSERT INTO transcription_history (file_name, timestamp, title, transcription_text, language, language_source)
                 VALUES ('a.wav', (SELECT COUNT(*) FROM transcription_history), 'a', 'hallo', 'de', ?1)",
                [source],
            )
            .expect("insert entry");
            HistoryManager::get_latest_entry_with_conn(&conn)
                .unwrap()
                .unwrap()
        };
        let entry = latest("detected");
        assert_eq!(entry.language.as_deref(), Some("de"));
        assert_eq!(entry.language_source, Some(LanguageSource::Detected));
        assert_eq!(latest("from_the_future").language_source, None);
    }

    #[test]
    fn get_latest_entry_returns_none_when_empty() {
        let conn = setup_conn();
        let entry = HistoryManager::get_latest_entry_with_conn(&conn).expect("fetch latest entry");
        assert!(entry.is_none());
    }

    #[test]
    fn get_latest_entry_returns_newest_entry() {
        let conn = setup_conn();
        insert_entry(&conn, 100, "first", None);
        insert_entry(&conn, 200, "second", Some("processed"));

        let entry = HistoryManager::get_latest_entry_with_conn(&conn)
            .expect("fetch latest entry")
            .expect("entry exists");

        assert_eq!(entry.timestamp, 200);
        assert_eq!(entry.transcription_text, "second");
        assert_eq!(entry.post_processed_text.as_deref(), Some("processed"));
    }

    #[test]
    fn get_latest_completed_entry_skips_empty_entries() {
        let conn = setup_conn();
        insert_entry(&conn, 100, "completed", None);
        insert_entry(&conn, 200, "", None);

        let entry = HistoryManager::get_latest_completed_entry_with_conn(&conn)
            .expect("fetch latest completed entry")
            .expect("completed entry exists");

        assert_eq!(entry.timestamp, 100);
        assert_eq!(entry.transcription_text, "completed");
    }

    #[test]
    fn get_latest_completed_entry_skips_files() {
        let conn = setup_conn();
        insert_entry(&conn, 100, "dictated", None);
        conn.execute(
            "INSERT INTO transcription_history (file_name, timestamp, saved, title, transcription_text, source_name)
             VALUES ('handy-file-1.wav', 200, 1, 'file', 'from a file', 'talk.mp3')",
            [],
        )
        .expect("insert file entry");

        let entry = HistoryManager::get_latest_completed_entry_with_conn(&conn)
            .expect("fetch latest completed entry")
            .expect("completed entry exists");

        assert_eq!(entry.transcription_text, "dictated");
    }
}
