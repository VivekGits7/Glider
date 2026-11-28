import React, { useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { commands, type ChineseScript } from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";
import {
  STEP_ORDER,
  clearOnboardingProgress,
  useOnboardingStore,
  type OnboardingStep,
} from "./onboardingStore";
import { usePermissions } from "./usePermissions";
import type { ChineseScriptChoice } from "@/common/lib/languageSuggestions";
import { isChinese } from "@/common/lib/languageSuggestions";
import { Permissions } from "./screens/Permissions";
import { Languages } from "./steps/Languages";
import { DictationModel } from "./steps/DictationModel";
import { Voices, defaultVoices } from "./steps/Voices";
import { RefineModel } from "./steps/RefineModel";
import { Practice } from "./steps/Practice";
import { AllSet } from "./steps/AllSet";
import { ObDownloads, queueVoices, useLocalModels } from "./ObDownloads";
import { useOnboardingModels } from "./useOnboardingModels";
import { useModelStore } from "@/features/stt/store/modelStore";
import { downloadPick } from "./downloadPick";

interface OnboardingFlowProps {
  /** Debug preview: inert (no prompts, downloads or setting writes). */
  preview?: boolean;
  /** The screen a preview opens on. */
  previewStep?: OnboardingStep;
  /** Called after the last screen, to show Settings. */
  onComplete: () => void;
}

// The backend's chinese_script values for the script picked on Welcome.
const SCRIPT_SETTING: Record<ChineseScriptChoice, ChineseScript> = {
  "zh-Hans": "simplified",
  "zh-Hant": "traditional_tw",
  "zh-HK": "traditional_hk",
};

/** First-run onboarding. Progress persists, so a relaunch or quit resumes. */
export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  preview = false,
  previewStep,
  onComplete,
}) => {
  const { i18n } = useTranslation();
  const store = useOnboardingStore();
  const { settings, updateSetting } = useSettings();
  const permissions = usePermissions(preview);
  const models = useOnboardingModels(store.languages);
  const local = useLocalModels();
  const currentModel = useModelStore((s) => s.currentModel);
  const selectModel = useModelStore((s) => s.selectModel);

  // Once models load: start from an on-disk model if there is one, or flag a
  // download interrupted by a quit. Reads the store since reset() runs first.
  useEffect(() => {
    if (preview || !models.offered.length) return;
    const { downloadId } = useOnboardingStore.getState();
    if (downloadId) {
      const model = models.offered.find((m) => m.id === downloadId);
      if (model && models.downloadState(model).state === "none")
        store.set({ downloadFailed: true });
      return;
    }
    const onDisk = models.offered.filter(
      (m) => models.infoFor(m)?.is_downloaded,
    );
    if (!onDisk.length) return;
    const selected = models.catalogFor(settings?.selected_model ?? "");
    const chosen =
      onDisk.find((m) => m.id === selected?.id) ??
      onDisk.find((m) => models.picks.some((p) => p.model.id === m.id)) ??
      onDisk[0];
    store.set({ downloadId: chosen.id });
    // Decided once the model list is in.
  }, [models.offered.length]);

  // Select the picked model as soon as it's on disk, so Try it can use it.
  const downloaded = models.offered.find((m) => m.id === store.downloadId);
  const downloadedInfo = downloaded && models.infoFor(downloaded);
  useEffect(() => {
    if (preview || !downloadedInfo?.is_downloaded) return;
    if (currentModel !== downloadedInfo.id) selectModel(downloadedInfo.id);
  }, [
    preview,
    downloadedInfo?.id,
    downloadedInfo?.is_downloaded,
    currentModel,
    selectModel,
  ]);

  // Before first paint so a preview never shows the saved step.
  useLayoutEffect(() => {
    store.reset(preview);
    if (preview && previewStep) store.set({ step: previewStep });
    return () => {
      if (preview) store.reset(false);
    };
    // Once per mount.
  }, []);

  // Restore the UI language a preview may have changed on Welcome.
  useEffect(() => {
    if (!preview) return;
    const before = i18n.language;
    return () => {
      if (i18n.language !== before) i18n.changeLanguage(before);
    };
  }, [preview]);

  const startModel = (id: string) => {
    if (!preview) downloadPick(models, id, store.downloadId);
    store.set({
      modelId: id,
      downloadId: id,
    });
  };

  // The recommended picks start downloading as their screens open, as the
  // design shows; picking something else (or Not now) switches or stops it.
  const recommended = models.groups.picks[0]?.model;
  useEffect(() => {
    if (preview || store.step !== "model" || store.downloadId || !recommended)
      return;
    startModel(recommended.id);
  }, [preview, store.step, store.downloadId, recommended?.id]);
  useEffect(() => {
    if (
      store.step !== "voices" ||
      store.voiceIds !== null ||
      !local.voices.length
    )
      return;
    const picks = defaultVoices(local.voices, store.languages);
    store.set({ voiceIds: picks });
    if (!preview) queueVoices(picks);
  }, [store.step, store.voiceIds, local.voices.length]);

  if (!permissions.checked) return null;

  const steps = STEP_ORDER.filter(
    (s) => s !== "permissions" || permissions.needed || store.welcomeBack,
  );
  const step = steps.includes(store.step) ? store.step : steps[0];
  const progress = { index: steps.indexOf(step), count: steps.length };
  // Reaching returnTo ends the detour.
  const go = (to: OnboardingStep) =>
    store.set(
      to === store.returnTo ? { step: to, returnTo: null } : { step: to },
    );
  /** Next screen, or back to All set after a detour from its panel. */
  const onward = () => (store.returnTo ? go(store.returnTo) : next());
  const next = () => {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) go(steps[i + 1]);
    else finish();
  };

  const back = () => {
    const i = steps.indexOf(step);
    if (i > 0) go(steps[i - 1]);
  };

  const finish = async () => {
    // Saved only now: each login item change posts a macOS notification.
    if (!preview) {
      await updateSetting("autostart_enabled", store.atLogin);
      const voice = store.voiceIds?.[0];
      if (voice) {
        await updateSetting("tts_model", voice);
        await updateSetting("tts_voice", 0);
      }
      // A refine model was picked: Rewrite is on.
      if (store.llmId) await updateSetting("post_process_enabled", true);
      await commands.completeOnboarding();
    }
    onComplete();
    // After Settings replaces the flow, so Welcome doesn't flash.
    if (!preview) clearOnboardingProgress();
  };

  const downloadNow = preview
    ? ({ state: "ready" } as const)
    : models.downloadState(downloaded);
  const modelReady = downloadNow.state === "ready";

  const saveLanguages = () => {
    if (preview) return;
    const { languages, script } = useOnboardingStore.getState();
    // The model's own Language stays as is; effective_language uses these.
    updateSetting("spoken_languages", languages);
    if (languages.some(isChinese))
      updateSetting("chinese_script", SCRIPT_SETTING[script]);
  };

  const downloads = (
    <ObDownloads
      models={models}
      dictation={downloaded}
      voices={local.voices}
      voiceIds={store.voiceIds ?? []}
      llms={local.llms}
      llmId={store.llmId}
    />
  );
  const selectedModel =
    models.offered.find((m) => m.id === (store.modelId ?? store.downloadId)) ??
    recommended;
  const modelName =
    (selectedModel && models.infoFor(selectedModel)?.name) ??
    selectedModel?.name ??
    "";

  switch (step) {
    case "welcome":
      return (
        <Languages
          progress={progress}
          onContinue={() => {
            saveLanguages();
            onward();
          }}
        />
      );
    case "permissions":
      return (
        <Permissions
          permissions={permissions}
          progress={progress}
          onBack={back}
          onContinue={next}
        />
      );
    case "model":
      return (
        <DictationModel
          progress={progress}
          models={models}
          languages={store.languages}
          selected={selectedModel}
          onPick={startModel}
          downloads={downloads}
          onBack={store.returnTo ? () => go(store.returnTo!) : back}
          onContinue={onward}
        />
      );
    case "voices":
      return (
        <Voices
          progress={progress}
          voices={local.voices}
          languages={store.languages}
          picked={store.voiceIds ?? []}
          onChange={(ids) => store.set({ voiceIds: ids })}
          downloads={downloads}
          onBack={back}
          onContinue={next}
        />
      );
    case "refine":
      return (
        <RefineModel
          progress={progress}
          llms={local.llms}
          picked={store.llmId ?? ""}
          onPick={(id) => {
            const previous = store.llmId;
            if (!preview && previous && previous !== id) {
              void commands.cancelLlmDownload(previous);
            }
            store.set({ llmId: id });
            if (!preview && id) void commands.downloadLlmModel(id);
          }}
          downloads={downloads}
          onBack={back}
          onContinue={next}
        />
      );
    case "try":
      return (
        <Practice
          progress={progress}
          preview={preview}
          ready={modelReady}
          modelName={modelName}
          onBack={back}
          onContinue={next}
        />
      );
    case "done":
      return (
        <AllSet
          progress={progress}
          languages={store.languages}
          modelName={modelName}
          atLogin={store.atLogin}
          onAtLogin={(on) => store.set({ atLogin: on })}
          onChangeLanguages={() =>
            store.set({ step: "welcome", returnTo: "done" })
          }
          onChangeModel={() => store.set({ step: "model", returnTo: "done" })}
          onDone={finish}
        />
      );
  }
};
