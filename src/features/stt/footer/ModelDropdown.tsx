import React from "react";
import { useTranslation } from "react-i18next";
import type { ModelInfo } from "@/bindings";
import {
  getTranslatedModelName,
  getTranslatedModelDescription,
} from "../lib/modelTranslation";

interface ModelDropdownProps {
  models: ModelInfo[];
  currentModelId: string;
  // A file is transcribing: show the models, but don't let them be picked.
  locked?: boolean;
  onModelSelect: (modelId: string) => void;
}

const ModelDropdown: React.FC<ModelDropdownProps> = ({
  models,
  currentModelId,
  locked = false,
  onModelSelect,
}) => {
  const { t } = useTranslation();
  const downloadedModels = models.filter((m) => m.is_downloaded);

  const handleModelClick = (modelId: string) => {
    if (locked) return;
    onModelSelect(modelId);
  };

  return (
    <div className="g-fmenu">
      <p className="g-fmenu-head">{t("footer.dictationModel")}</p>
      {locked && (
        <div className="px-3 pb-2 mb-1 text-xs text-ink-2 border-b border-line">
          {t("modelSelector.lockedWhileTranscribing")}
        </div>
      )}
      {downloadedModels.length > 0 ? (
        <div>
          {downloadedModels.map((model) => (
            <div
              key={model.id}
              onClick={() => handleModelClick(model.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleModelClick(model.id);
                }
              }}
              tabIndex={locked ? -1 : 0}
              role="button"
              aria-disabled={locked}
              className={`w-full rounded-lg px-2.5 py-2 text-start transition-colors focus:outline-none ${
                locked
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-wash cursor-pointer"
              } ${currentModelId === model.id ? "bg-raised" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-text">
                    {getTranslatedModelName(model, t)}
                    {model.is_custom && (
                      <span className="ms-1.5 text-[10px] font-medium text-ink-3 uppercase">
                        {t("modelSelector.custom")}
                      </span>
                    )}
                    {model.supports_streaming && (
                      <span className="ms-1.5 text-[10px] font-medium text-logo-primary uppercase">
                        {t("modelSelector.streaming")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-3 italic pe-4">
                    {getTranslatedModelDescription(model, t)}
                  </div>
                </div>
                {currentModelId === model.id && (
                  <span className="g-fmenu-active">
                    {t("modelSelector.active")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 text-sm text-ink-2">
          {t("modelSelector.noModelsAvailable")}
        </div>
      )}
    </div>
  );
};

export default ModelDropdown;
