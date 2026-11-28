import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { notify } from "@/common/notices/noticeStore";
import { Tabs } from "@/common/ui/Tabs";
import { PageHeader } from "@/common/shared/PageHeader";
import { pickAndTranscribeFiles } from "./transcribeFiles";
import { HistorySettings } from "./HistorySettings";
import { ReadAloudHistory } from "./ReadAloudHistory";
import { RewriteHistory } from "./RewriteHistory";

type HistoryTab = "dictation" | "readAloud" | "rewrite";

/** History, split into what you said, what was read to you, and what was
 * rewritten. */
export const HistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HistoryTab>("dictation");
  const [savedOnly, setSavedOnly] = useState(false);
  const transcribeFile = async () => {
    try {
      await pickAndTranscribeFiles();
    } catch (error) {
      console.error("Failed to pick a file to transcribe:", error);
      notify({ title: t("settings.history.transcribeFailed") });
    }
  };

  const openRecordingsFolder = async () => {
    try {
      const result = await commands.openRecordingsFolder();
      if (result.status !== "ok") {
        throw new Error(String(result.error));
      }
    } catch (error) {
      console.error("Failed to open recordings folder:", error);
    }
  };

  const tabs = (
    <div className="flex items-center justify-between gap-4">
      <Tabs
        label={t("settings.history.tabs.label")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "dictation", label: t("settings.history.tabs.dictation") },
          { value: "readAloud", label: t("settings.history.tabs.readAloud") },
          { value: "rewrite", label: t("settings.history.tabs.rewrite") },
        ]}
      />
      {/* Shown on every tab. */}
      <button
        type="button"
        aria-pressed={savedOnly}
        onClick={() => setSavedOnly((on) => !on)}
        className={`g-toggle ${savedOnly ? "on" : ""} cursor-pointer`}
      >
        <i
          className={`g-ic ${savedOnly ? "g-i-star-fill" : "g-i-star"}`}
          aria-hidden="true"
        />
        {t("settings.history.savedOnly")}
      </button>
    </div>
  );
  return (
    <>
      <PageHeader
        title={t("sidebar.history")}
        right={
          <>
            <button
              type="button"
              onClick={transcribeFile}
              className="g-btn sec cursor-pointer"
            >
              {t("settings.history.transcribeFile")}
            </button>
            <button
              type="button"
              onClick={openRecordingsFolder}
              className="g-btn sec cursor-pointer"
            >
              {t("settings.history.openFolder")}
            </button>
          </>
        }
      />
      {tab === "dictation" ? (
        <HistorySettings tabs={tabs} savedOnly={savedOnly} />
      ) : tab === "readAloud" ? (
        <ReadAloudHistory tabs={tabs} savedOnly={savedOnly} />
      ) : (
        <RewriteHistory tabs={tabs} savedOnly={savedOnly} />
      )}
    </>
  );
};
