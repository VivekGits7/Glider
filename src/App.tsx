import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { platform } from "@tauri-apps/plugin-os";
import { listen } from "@tauri-apps/api/event";
import {
  checkAccessibilityPermission,
  checkMicrophonePermission,
} from "tauri-plugin-macos-permissions-api";
import "./App.css";
import SecureInputWarning from "@/app/SecureInputWarning";
import Footer from "@/app/footer";
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow";
import ModelMigration from "@/features/onboarding/ModelMigration";
import {
  ReplaceModel,
  ReturningPermissions,
} from "@/features/onboarding/StandaloneScreens";
import {
  clearOnboardingProgress,
  type OnboardingStep as OnboardingPreviewStep,
} from "@/features/onboarding/onboardingStore";
import { DebugSettings } from "@/features/settings/debug/DebugSettings";
import { HistoryPage } from "@/features/history/HistoryPage";
import { ModelsPage, type ModelsTab } from "@/features/models/ModelsPage";
import { ReadAloudPage } from "@/features/tts/ReadAloudPage";
import { DictationPage } from "@/features/stt/DictationPage";
import { HomePage } from "@/features/home/HomePage";
import { InsightsPage } from "@/features/insights/InsightsPage";
import { RewritePage } from "@/features/llm/RewritePage";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { LoadingScreen } from "@/app/LoadingScreen";
import { useModelStore } from "@/features/stt/store/modelStore";
import { FileDropOverlay } from "@/app/FileDropOverlay";
import { Sidebar, SidebarSection, SECTIONS_CONFIG } from "@/app/Sidebar";
import { TopBar } from "@/app/TopBar";
import { WhatsNewGate } from "@/features/updates/whats-new";
import { useSettings } from "@/common/settings/useSettings";
import { useSettingsStore } from "@/common/settings/settingsStore";
import { commands } from "@/bindings";
import { deleteRetiredModel } from "@/features/stt/lib/retired";
import { NoticePanel } from "@/common/notices/NoticePanel";
import { getLanguageDirection, initializeRTL } from "@/common/lib/rtl";

/** The longest the launch screen waits for the speech model. */
const BOOT_LIMIT_MS = 4000;
/** "1" while the sidebar is folded down to its icon rail. */
const SIDEBAR_COLLAPSED_KEY = "glider.sidebarCollapsed";

// flow is first-run onboarding; the rest are single screens for returning users.
type OnboardingStep =
  | "flow"
  | "permissions"
  | "migration"
  | "replaceModel"
  | "done";

const renderSettingsContent = (
  section: SidebarSection,
  onPreviewOnboarding: (step: OnboardingPreviewStep) => void,
  onRunOnboarding: () => void,
  onRunModelMigration: () => void,
  onSectionChange: (section: SidebarSection) => void,
  modelsTab: ModelsTab,
  openModels: (tab: ModelsTab) => void,
) => {
  if (section === "home") {
    return (
      <HomePage
        onNavigate={onSectionChange}
        onHowToUse={() => onPreviewOnboarding("try")}
      />
    );
  }
  if (section === "insights") {
    return <InsightsPage />;
  }
  if (section === "dictation") {
    return (
      <DictationPage
        onTry={() => onPreviewOnboarding("try")}
        onManageModels={() => openModels("speech")}
      />
    );
  }
  if (section === "readAloud") {
    return <ReadAloudPage onManageVoices={() => openModels("voices")} />;
  }
  if (section === "rewrite") {
    return <RewritePage onManageModels={() => openModels("llm")} />;
  }
  if (section === "history") {
    return <HistoryPage />;
  }
  if (section === "models") {
    return (
      <ModelsPage
        tab={modelsTab}
        onTabChange={openModels}
        onChangeLanguages={() => onSectionChange("general")}
      />
    );
  }
  if (section === "debug") {
    return (
      <DebugSettings
        onPreviewOnboarding={onPreviewOnboarding}
        onRunOnboarding={onRunOnboarding}
        onRunModelMigration={onRunModelMigration}
      />
    );
  }

  const ActiveComponent =
    SECTIONS_CONFIG[section]?.component || SECTIONS_CONFIG.general.component;
  return <ActiveComponent />;
};

function App() {
  const { t, i18n } = useTranslation();
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(
    null,
  );
  const [onboardingPreview, setOnboardingPreview] =
    useState<OnboardingPreviewStep | null>(null);
  // Set when a returning user's selected model is a retired (ONNX) model that
  // is still on disk: they must update it before the app can transcribe.
  const [migrationModelId, setMigrationModelId] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<SidebarSection>("home");
  const [modelsTab, setModelsTab] = useState<ModelsTab>("speech");
  const openModels = useCallback((tab: ModelsTab) => {
    setModelsTab(tab);
    setCurrentSection("models");
  }, []);
  const showHistory = useCallback(() => setCurrentSection("history"), []);
  const { settings, updateSetting } = useSettings();
  const direction = getLanguageDirection(i18n.language);
  const refreshAudioDevices = useSettingsStore(
    (state) => state.refreshAudioDevices,
  );
  const refreshOutputDevices = useSettingsStore(
    (state) => state.refreshOutputDevices,
  );
  const hasCompletedPostOnboardingInit = useRef(false);
  const [booted, setBooted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "1",
  );
  const toggleSidebar = () =>
    setSidebarOpen((open) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, open ? "1" : "0");
      return !open;
    });
  useEffect(() => {
    if (onboardingStep === null || booted) return;
    if (onboardingStep !== "done" || !settings?.selected_model) {
      setBooted(true);
      return;
    }
    const modelStore = useModelStore.getState();
    if (!modelStore.models.length) void modelStore.loadModels();
    let live = true;
    const started = Date.now();
    commands.preloadModel().catch(() => false);
    const tick = async () => {
      if (!live) return;
      const status = await commands.getModelLoadStatus();
      const loaded = status.status === "ok" && status.data.is_loaded;
      if (loaded || Date.now() - started > BOOT_LIMIT_MS) {
        setBooted(true);
        return;
      }
      setTimeout(tick, 150);
    };
    void tick();
    return () => {
      live = false;
    };
  }, [onboardingStep, booted, settings?.selected_model]);
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  // Reset the scroll position whenever the active section changes.
  useLayoutEffect(() => {
    settingsScrollRef.current?.scrollTo({ top: 0 });
  }, [currentSection]);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // The overlay's "Get a voice" opens Models on that tab.
  useEffect(() => {
    const unlisten = listen<ModelsTab>("open-models", (event) =>
      openModels(event.payload),
    );
    return () => {
      unlisten.then((off) => off());
    };
  }, [openModels]);

  // Initialize RTL direction when language changes
  useEffect(() => {
    initializeRTL(i18n.language);
  }, [i18n.language]);

  // Initialize Enigo, shortcuts, and refresh audio devices when main app loads
  useEffect(() => {
    if (onboardingStep === "done" && !hasCompletedPostOnboardingInit.current) {
      hasCompletedPostOnboardingInit.current = true;
      Promise.all([
        commands.initializeEnigo(),
        commands.initializeShortcuts(),
      ]).catch((e) => {
        console.warn("Failed to initialize:", e);
      });
      refreshAudioDevices();
      refreshOutputDevices();
    }
  }, [onboardingStep, refreshAudioDevices, refreshOutputDevices]);

  // Handle keyboard shortcuts for debug mode toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+D (Windows/Linux) or Cmd+Shift+D (macOS)
      const isDebugShortcut =
        event.shiftKey &&
        event.key.toLowerCase() === "d" &&
        (event.ctrlKey || event.metaKey);

      if (isDebugShortcut) {
        event.preventDefault();
        const currentDebugMode = settings?.debug_mode ?? false;
        updateSetting("debug_mode", !currentDebugMode);
      }
    };

    // Add event listener when component mounts
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup event listener when component unmounts
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settings?.debug_mode, updateSetting]);

  const revealMainWindowForPermissions = async () => {
    try {
      await commands.showMainWindowCommand();
    } catch (e) {
      console.warn("Failed to show main window for permission onboarding:", e);
    }
  };

  const getMigrationModelId = async (
    selectedModel: string,
  ): Promise<string | null> => {
    const retired = await commands.getRetiredModels();
    return retired.some((m) => m.id === selectedModel) ? selectedModel : null;
  };

  // Returning users land in the app unless their model needs updating. The
  // window may start hidden, so bring it forward for the update screen.
  const finishReturningUser = async (retiredModelId: string | null) => {
    if (retiredModelId) {
      await revealMainWindowForPermissions();
      setOnboardingStep("migration");
    } else {
      setOnboardingStep("done");
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const settingsResult = await commands.getAppSettings();
      const hasCompletedOnboarding =
        settingsResult.status === "ok" &&
        settingsResult.data.onboarding_completed === true;
      const currentPlatform = platform();

      if (hasCompletedOnboarding) {
        // Returning user - check if they need to grant permissions first
        const retiredModelId = await getMigrationModelId(
          settingsResult.data.selected_model ?? "",
        );
        setMigrationModelId(retiredModelId);

        if (currentPlatform === "macos") {
          try {
            const [hasAccessibility, hasMicrophone] = await Promise.all([
              checkAccessibilityPermission(),
              checkMicrophonePermission(),
            ]);
            if (!hasAccessibility || !hasMicrophone) {
              await revealMainWindowForPermissions();
              setOnboardingStep("permissions");
              return;
            }
          } catch (e) {
            console.warn("Failed to check macOS permissions:", e);
            // If we can't check, proceed to main app and let them fix it there
          }
        }

        if (currentPlatform === "windows") {
          try {
            const microphoneStatus =
              await commands.getWindowsMicrophonePermissionStatus();
            if (
              microphoneStatus.supported &&
              microphoneStatus.overall_access === "denied"
            ) {
              await revealMainWindowForPermissions();
              setOnboardingStep("permissions");
              return;
            }
          } catch (e) {
            console.warn("Failed to check Windows microphone permissions:", e);
            // If we can't check, proceed to main app and let them fix it there
          }
        }

        await finishReturningUser(retiredModelId);
      } else {
        // New user - start full onboarding
        setOnboardingStep("flow");
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      setOnboardingStep("flow");
    }
  };

  // Debug: the real onboarding from Welcome, for testing it end to end.
  const runOnboarding = () => {
    clearOnboardingProgress();
    setOnboardingStep("flow");
  };

  // Debug: the real model migration screen. It leads with the selected model
  // if that's retired, otherwise with the first retired model on disk.
  const runModelMigration = async () => {
    const retired = await commands.getRetiredModels();
    if (retired.length === 0) {
      console.info("Model migration: no old-format models on disk");
      return;
    }
    const selected = settings?.selected_model;
    setMigrationModelId(
      retired.find((m) => m.id === selected)?.id ?? retired[0].id,
    );
    setOnboardingStep("migration");
  };

  const handleModelSelected = async () => {
    // Reached when the user picks a different model instead of updating.
    for (const model of await commands.getRetiredModels()) {
      await deleteRetiredModel(model.id);
    }
    setOnboardingStep("done");
  };

  // Launch: the speech model loads behind the loading screen, so the first
  // dictation doesn't wait for it. Capped, so a slow load never holds the window.
  if (onboardingStep === null || (onboardingStep === "done" && !booted)) {
    return <LoadingScreen />;
  }

  // Select the content for the current step. NoticePanel is rendered once,
  // beside this node, so errors surface on every step, including onboarding.
  let content: ReactNode;
  if (onboardingPreview) {
    // Previews render in the same top-level slot as real onboarding, inert:
    // no prompts, downloads or setting writes.
    content = (
      <>
        <OnboardingFlow
          preview
          previewStep={onboardingPreview}
          onComplete={() => setOnboardingPreview(null)}
        />
        <button
          type="button"
          onClick={() => setOnboardingPreview(null)}
          className="fixed top-4 end-4 z-50 rounded-lg border border-line bg-background px-4 py-2 text-sm font-medium text-text shadow-lg hover:bg-logo-primary/20 cursor-pointer"
        >
          {t("settings.debug.onboardingPreview.exitButton")}
        </button>
      </>
    );
  } else if (onboardingStep === "flow") {
    content = <OnboardingFlow onComplete={() => setOnboardingStep("done")} />;
  } else if (onboardingStep === "permissions") {
    content = (
      <ReturningPermissions
        onComplete={() => finishReturningUser(migrationModelId)}
      />
    );
  } else if (onboardingStep === "migration" && migrationModelId) {
    content = (
      <ModelMigration
        inUseModelId={migrationModelId}
        onComplete={() => setOnboardingStep("done")}
        onChooseAnother={() => setOnboardingStep("replaceModel")}
      />
    );
  } else if (onboardingStep === "replaceModel") {
    content = (
      <ReplaceModel
        onBack={() => setOnboardingStep("migration")}
        onComplete={handleModelSelected}
      />
    );
  } else {
    content = (
      <div
        dir={direction}
        className="h-screen flex flex-col select-none cursor-default bg-ground"
      >
        <ErrorBoundary context="What's New">
          <WhatsNewGate />
        </ErrorBoundary>
        <TopBar sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            activeSection={currentSection}
            onSectionChange={setCurrentSection}
            collapsed={!sidebarOpen}
          />
          {/* The inset panel: the page scrolls inside it, the footer stays. */}
          <main className="@container mb-2 me-2 flex flex-1 flex-col overflow-hidden rounded-[20px] border border-line bg-background">
            {/* Relative, so absolutely placed children (sr-only labels) stay
                inside the panel instead of stretching the whole window. */}
            <div
              ref={settingsScrollRef}
              className="relative flex-1 overflow-y-auto"
            >
              {/* Models and Insights fill the panel: Models' table scrolls,
                  and Insights fits itself to the height, not the page. */}
              <div
                className={`mx-auto flex w-full flex-col gap-7 max-w-[1280px] px-6 pt-9 pb-10 @[640px]:px-10 ${currentSection === "models" || currentSection === "insights" ? "h-full" : ""}`}
              >
                <SecureInputWarning />
                {renderSettingsContent(
                  currentSection,
                  setOnboardingPreview,
                  runOnboarding,
                  runModelMigration,
                  setCurrentSection,
                  modelsTab,
                  openModels,
                )}
              </div>
            </div>
            <Footer onShowHistory={showHistory} />
          </main>
        </div>
        <FileDropOverlay onDropped={showHistory} />
      </div>
    );
  }

  return (
    <>
      {content}
      <NoticePanel />
    </>
  );
}

export default App;
