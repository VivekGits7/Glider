import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRewrites } from "@/features/llm/hooks/useRewrites";
import { useSettings } from "@/common/settings/useSettings";

/** The footer's Rewrite model: the LLM on this computer or the provider,
 * with a menu of every downloaded LLM. */
const RewriteSelector: React.FC = () => {
  const { t } = useTranslation();
  const { llms, llm, usesProvider, modelName, refresh } = useRewrites();
  const { getSetting, updateSetting } = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const downloaded = llms.filter((m) => m.is_downloaded);
  const provider = getSetting("post_process_providers")?.find(
    (p) => p.id === getSetting("post_process_provider_id"),
  );
  const providerModel = provider
    ? getSetting("post_process_models")?.[provider.id]
    : undefined;
  const label = modelName || t("footer.noRewriteModel");

  const toggle = () => {
    // Models can be downloaded on the Models page while the footer stays put.
    if (!open) refresh();
    setOpen(!open);
  };

  const pickLlm = async (id: string) => {
    setOpen(false);
    await updateSetting("llm_model", id);
    if (usesProvider) await updateSetting("llm_use_provider", false);
  };

  const pickProvider = async () => {
    setOpen(false);
    await updateSetting("llm_use_provider", true);
  };

  const row = (
    key: string,
    name: string,
    description: string,
    active: boolean,
    onPick: () => void,
  ) => (
    <button
      key={key}
      type="button"
      onClick={onPick}
      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-start ${active ? "bg-raised" : "hover:bg-wash"}`}
    >
      <span className="min-w-0">
        <span className="block text-sm text-text">{name}</span>
        <span className="block text-xs text-ink-3 italic">{description}</span>
      </span>
      {active && (
        <span className="g-fmenu-active">{t("modelSelector.active")}</span>
      )}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="g-fbtn cursor-pointer"
        aria-expanded={open}
        aria-label={t("footer.rewriteLabel", { model: label })}
        onClick={toggle}
      >
        <i className="g-ic g-i-sparkles" aria-hidden="true" />
        <span className="max-w-40 truncate">{label}</span>
        <i
          className={`g-ic cv g-i-chev transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="g-fmenu">
          <p className="g-fmenu-head">{t("footer.rewriteModel")}</p>
          {downloaded.length === 0 && !providerModel ? (
            <p className="m-0 px-2.5 py-2 text-[13px] text-ink-3">
              {t("footer.noRewriteModel")}
            </p>
          ) : (
            <>
              {downloaded.map((m) =>
                row(
                  m.id,
                  m.name,
                  m.description,
                  !usesProvider && m.id === llm?.id,
                  () => pickLlm(m.id),
                ),
              )}
              {provider &&
                providerModel &&
                row(
                  "provider",
                  providerModel,
                  t("footer.providerDesc", { provider: provider.label }),
                  usesProvider,
                  pickProvider,
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RewriteSelector;
