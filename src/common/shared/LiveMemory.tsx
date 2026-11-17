import React from "react";
import { useTranslation } from "react-i18next";
import type { WorkerMemory } from "@/bindings";
import { formatModelSize } from "@/common/lib/format";

/** The Memory cell of the model in use: what its worker process is using
 * right now, or "Not loaded" once it has unloaded (after idling) or before
 * its first use. */
export const LiveMemory: React.FC<{
  live: WorkerMemory | null;
  modelId: string;
}> = ({ live, modelId }) => {
  const { t } = useTranslation();
  if (!live || live.model_id !== modelId) {
    return (
      <span className="g-size whitespace-nowrap text-ink-3">
        {t("settings.models.notLoaded")}
      </span>
    );
  }
  return (
    <span
      className="g-size inline-flex items-center justify-end gap-1.5 whitespace-nowrap"
      title={t("settings.models.liveMemory")}
    >
      <i
        className="size-1.5 shrink-0 rounded-full bg-moss"
        aria-hidden="true"
      />
      {formatModelSize(live.bytes / (1024 * 1024))}
    </span>
  );
};
