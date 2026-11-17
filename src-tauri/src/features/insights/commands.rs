//! Tauri commands for Insights and Home's numbers. Both read the history
//! database through `HistoryManager`.

use super::service::Insights;
use crate::features::history::service::{HistoryManager, UsageStats};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn get_usage_stats(
    history_manager: State<'_, Arc<HistoryManager>>,
) -> Result<UsageStats, String> {
    history_manager.usage_stats().map_err(|e| e.to_string())
}

/// Insights for the last `days` days, or all time when `None`.
#[tauri::command]
#[specta::specta]
pub fn get_insights(
    history_manager: State<'_, Arc<HistoryManager>>,
    days: Option<u32>,
) -> Result<Insights, String> {
    history_manager.insights(days).map_err(|e| e.to_string())
}
