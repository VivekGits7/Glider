import React from "react";
import ReactDOM from "react-dom/client";
import { platform } from "@tauri-apps/plugin-os";
import App from "./App";
import { installCompatShims } from "@/common/lib/compat";
import {
  applyTheme,
  getStoredTheme,
  syncThemeFromSettings,
} from "@/common/lib/theme";

installCompatShims();

// Set platform before render so CSS can scope per-platform (e.g. scrollbar styles)
document.documentElement.dataset.platform = platform();

// Apply the last-known theme synchronously before render to avoid a flash of
// the wrong palette, then reconcile with the persisted setting once it loads.
applyTheme(getStoredTheme());
syncThemeFromSettings();

// Initialize i18n
import "@/i18n";

// Initialize model store (loads models and sets up event listeners)
import { useModelStore } from "@/features/stt/store/modelStore";
import { useNoticeStore } from "@/common/notices/noticeStore";
import { useTranscriptionJobsStore } from "@/features/stt/store/transcriptionJobsStore";
useModelStore.getState().initialize();
useTranscriptionJobsStore.getState().initialize();
useNoticeStore.getState().initialize();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
