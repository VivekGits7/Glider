import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs } from "@/common/ui/Tabs";
import { PageHeader } from "@/common/shared/PageHeader";
import { commands, type ModelFolder } from "@/bindings";
import { useModelStore } from "@/features/stt/store/modelStore";
import { notify } from "@/common/notices/noticeStore";
import { SpeechModels } from "@/features/stt/models/SpeechModels";
import { VoiceModelsTab } from "@/features/tts/models/VoiceModelsTab";
import { LlmModels } from "@/features/llm/models/LlmModels";
import { useModelMemory } from "./useModelMemory";

/** Each tab is also the folder its models download into. */
export type ModelsTab = ModelFolder;

/** Speech-to-text models, Read Aloud voices and Rewrite's LLMs, on one page. */
export const ModelsPage: React.FC<{
  tab: ModelsTab;
  onTabChange: (tab: ModelsTab) => void;
  onChangeLanguages: () => void;
}> = ({ tab, onTabChange }) => {
  const { t } = useTranslation();
  // Each tab keeps its own search.
  const [queries, setQueries] = useState<Record<ModelsTab, string>>({
    speech: "",
    voices: "",
    llm: "",
  });
  const query = queries[tab];
  const rescanning = useModelStore((s) => s.isRescanning);
  const memory = useModelMemory();
  // Voices and LLMs reload their lists on mount; a new key remounts them.
  const [reloads, setReloads] = useState(0);
  const reload = () =>
    tab === "speech"
      ? useModelStore.getState().rescanLocalModels()
      : setReloads((n) => n + 1);
  const openFolder = async () => {
    const result = await commands.openModelsDir(tab);
    if (result.status === "error") {
      notify({
        level: "error",
        title: t("settings.models.openFolderFailed"),
        detail: result.error,
      });
    }
  };
  return (
    <>
      <PageHeader
        title={t("sidebar.models")}
        lede={t("settings.models.lede")}
        right={
          <>
            <button
              type="button"
              className="g-btn sec w-(--g-btn-h) px-0 cursor-pointer"
              disabled={rescanning}
              title={t("settings.models.rescan.tooltip")}
              aria-label={t("settings.models.rescan.tooltip")}
              onClick={reload}
            >
              <i
                className={`g-ic g-i-refresh ${rescanning ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              className="g-btn sec w-(--g-btn-h) px-0 cursor-pointer"
              title={t("settings.models.openFolder")}
              aria-label={t("settings.models.openFolder")}
              onClick={openFolder}
            >
              <i className="g-ic g-i-folder" aria-hidden="true" />
            </button>
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          label={t("settings.models.tabs.label")}
          value={tab}
          onChange={onTabChange}
          options={[
            { value: "speech", label: t("settings.models.tabs.speech") },
            { value: "voices", label: t("settings.models.tabs.voices") },
            { value: "llm", label: t("settings.models.tabs.llm") },
          ]}
        />
        <label className="g-search mb-0 w-[240px] max-w-full">
          <i className="g-ic g-i-search" aria-hidden="true" />
          <input
            type="search"
            aria-label={t("settings.models.search")}
            placeholder={t("settings.models.search")}
            value={query}
            onChange={(e) => setQueries({ ...queries, [tab]: e.target.value })}
          />
        </label>
      </div>
      {tab === "speech" ? (
        <SpeechModels query={query} live={memory?.stt} />
      ) : tab === "voices" ? (
        <VoiceModelsTab key={reloads} query={query} live={memory?.tts} />
      ) : (
        <LlmModels key={reloads} query={query} live={memory?.llm} />
      )}
    </>
  );
};
