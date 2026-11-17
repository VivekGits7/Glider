import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TtsModelInfo } from "@/bindings";
import { useVoiceModels } from "@/features/tts/hooks/useVoiceModels";
import { Dialog } from "@/common/ui/Dialog";
import { useSettings } from "@/common/settings/useSettings";

/** The footer's Read Aloud model: a menu of every downloaded voice model,
 * each with a pop-up of its voices. */
const VoiceSelector: React.FC = () => {
  const { t } = useTranslation();
  const { models, selected, selectModel, refresh } = useVoiceModels();
  const { getSetting, updateSetting } = useSettings();
  const [open, setOpen] = useState(false);
  const [voicesOf, setVoicesOf] = useState<TtsModelInfo | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const voice = getSetting("tts_voice") ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const downloaded = models.filter((m) => m.is_downloaded);
  const label = selected
    ? selected.voices.length > 1
      ? `${selected.name} · ${selected.voices[voice] ?? selected.voices[0]}`
      : selected.name
    : t("footer.noVoice");

  const toggle = () => {
    // Voices can be downloaded on the Models page while the footer stays put.
    if (!open) refresh();
    setOpen(!open);
  };

  const pickModel = async (model: TtsModelInfo) => {
    setOpen(false);
    if (model.id !== selected?.id) await selectModel(model.id);
  };

  const pickVoice = async (model: TtsModelInfo, index: number) => {
    setVoicesOf(null);
    if (model.id !== selected?.id) await updateSetting("tts_model", model.id);
    await updateSetting("tts_voice", index);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="g-fbtn cursor-pointer"
        aria-expanded={open}
        aria-label={t("footer.voiceLabel", { voice: label })}
        onClick={toggle}
      >
        <i className="g-ic g-i-audio" aria-hidden="true" />
        <span className="max-w-48 truncate">{label}</span>
        <i
          className={`g-ic cv g-i-chev transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="g-fmenu">
          <p className="g-fmenu-head">{t("footer.readAloudModel")}</p>
          {downloaded.length === 0 ? (
            <p className="m-0 px-2.5 py-2 text-[13px] text-ink-3">
              {t("footer.noVoice")}
            </p>
          ) : (
            downloaded.map((model) => {
              const active = model.id === selected?.id;
              return (
                <div
                  key={model.id}
                  className={`flex items-center gap-2 rounded-lg pe-2 ${active ? "bg-raised" : "hover:bg-wash"}`}
                >
                  <button
                    type="button"
                    onClick={() => pickModel(model)}
                    className="min-w-0 flex-1 cursor-pointer px-2.5 py-2 text-start"
                  >
                    <span className="block text-sm text-text">
                      {model.name}
                    </span>
                    <span className="block text-xs text-ink-3 italic">
                      {model.description}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {active && (
                      <span className="g-fmenu-active">
                        {t("modelSelector.active")}
                      </span>
                    )}
                    {model.is_downloaded && model.voices.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setVoicesOf(model);
                        }}
                        className="g-fmenu-active cursor-pointer hover:underline"
                      >
                        {t("footer.chooseVoices")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      <Dialog
        open={voicesOf !== null}
        onOpenChange={(o) => !o && setVoicesOf(null)}
        title={t("footer.voicesTitle")}
        description={voicesOf?.name}
        closeLabel={t("common.close")}
        className="max-w-sm"
      >
        <div className="flex flex-col gap-0.5">
          {voicesOf?.voices.map((name, index) => {
            const chosen = voicesOf.id === selected?.id && index === voice;
            return (
              <button
                key={name}
                type="button"
                onClick={() => pickVoice(voicesOf, index)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-start text-[13px] text-text ${chosen ? "bg-raised font-medium" : "hover:bg-wash"}`}
              >
                {name}
                {chosen && (
                  <span className="g-fmenu-active">
                    {t("modelSelector.active")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
};

export default VoiceSelector;
