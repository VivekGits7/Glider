import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs } from "@/common/ui/Tabs";
import { PageHeader } from "@/common/shared/PageHeader";
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
  const tabs = (
    <div className="flex items-center gap-2">
      <Tabs
        label={t("settings.history.tabs.label")}
        value={tab}
        onChange={setTab}
        options={[
          {
            value: "dictation",
            label: t("settings.history.tabs.dictation"),
            icon: "mic",
          },
          {
            value: "readAloud",
            label: t("settings.history.tabs.readAloud"),
            icon: "audio",
          },
          {
            value: "rewrite",
            label: t("settings.history.tabs.rewrite"),
            icon: "sparkles",
          },
        ]}
      />
      {/* Shown on every tab; a bare icon like the recordings folder button. */}
      <button
        type="button"
        aria-pressed={savedOnly}
        onClick={() => setSavedOnly((on) => !on)}
        title={t("settings.history.savedOnly")}
        aria-label={t("settings.history.savedOnly")}
        className={`g-ib size-9 cursor-pointer ${savedOnly ? "on" : ""}`}
      >
        <i
          className={`g-ic ${savedOnly ? "g-i-star-fill" : "g-i-star"}`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
  return (
    <>
      <PageHeader title={t("sidebar.history")} />
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
