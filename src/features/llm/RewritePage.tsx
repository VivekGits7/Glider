import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";
import { useOsType } from "@/common/hooks/useOsType";
import { PageHeader } from "@/common/shared/PageHeader";
import { Keycaps } from "@/common/shared/Keycaps";
import { IntroCard } from "@/common/shared/IntroCard";
import { keycapLabel } from "@/common/lib/keyboard";
import { Switch } from "@/common/ui/Switch";
import { RewriteDetail } from "./RewriteDetail";
import { RewriteDemo, type RewriteStep } from "./RewriteDemo";
import { builtinKey, isBuiltin, useRewrites } from "./hooks/useRewrites";

interface RewritePageProps {
  /** Opens Models on its Large language model tab. */
  onManageModels: () => void;
}

/** Rewrite: rewrites selected text in any app with the LLM, on a shortcut. */
export const RewritePage: React.FC<RewritePageProps> = ({ onManageModels }) => {
  const { t } = useTranslation();
  const osType = useOsType();
  const { getSetting, updateSetting, refreshSettings } = useSettings();
  const { rewrites, usage, ready, modelName, usesProvider } = useRewrites();
  const [open, setOpen] = useState<string | null>(null);
  const [demoAfter, setDemoAfter] = useState<string | null>(null);
  const [trying, setTrying] = useState(false);
  const [busy, setBusy] = useState(false);

  const enabled = getSetting("post_process_enabled") ?? false;
  const bindings = getSetting("bindings") ?? {};
  const first = rewrites[0];
  const opened = rewrites.find((r) => r.rewrite.id === open);

  if (opened) {
    return (
      <RewriteDetail
        slotted={opened}
        onBack={() => setOpen(null)}
        onManageModels={onManageModels}
      />
    );
  }

  const keysFor = (slot: number) => {
    const binding = bindings[`refine_${slot}`]?.current_binding;
    return binding ? <Keycaps binding={binding} osType={osType} /> : <span />;
  };

  // Plain text for the demo, where keycaps would read as boxes.
  const keyText = (slot: number) => {
    const binding = bindings[`refine_${slot}`]?.current_binding;
    return binding ? keycapLabel(binding, osType) : "";
  };

  const demoBefore = t("rewrite.demo.before");
  const tryIt = async () => {
    if (!first) return;
    setTrying(true);
    const result = await commands.runRewrite(first.rewrite.id, demoBefore);
    setTrying(false);
    if (result.status === "ok") setDemoAfter(result.data);
    else if (result.error === "no_model") onManageModels();
  };

  const newRewrite = async () => {
    setBusy(true);
    const result = await commands.createRewrite(t("rewrite.newName"), "");
    await refreshSettings();
    setBusy(false);
    if (result.status === "ok") setOpen(result.data.id);
  };

  const resetAll = async () => {
    setBusy(true);
    await commands.resetRewrites();
    await refreshSettings();
    setBusy(false);
  };

  // The built-ins on their shortcuts, in slot order, each with a sample
  // result; Try it's real result stands in for the first rewrite's.
  const steps: RewriteStep[] = rewrites
    .filter(
      ({ rewrite }) =>
        isBuiltin(rewrite.id) ||
        (rewrite.id === first?.rewrite.id && demoAfter),
    )
    .slice(0, 4)
    .map(({ slot, rewrite }) => ({
      keys: keyText(slot),
      name: rewrite.name,
      result:
        rewrite.id === first?.rewrite.id && demoAfter
          ? demoAfter
          : t(`rewrite.demo.results.${builtinKey(rewrite.id)}`),
    }));

  const slotsFull = rewrites.length >= 9;
  const firstName = first?.rewrite.name ?? "";
  const heroKey =
    first && isBuiltin(first.rewrite.id)
      ? `rewrite.hero.${builtinKey(first.rewrite.id)}`
      : "rewrite.hero.custom";
  const undoKeys = osType === "macos" ? "⌘Z" : "Ctrl+Z";

  return (
    <>
      <PageHeader
        title={t("sidebar.rewrite")}
        badge={<span className="g-badge plain">{t("rewrite.new")}</span>}
        right={
          <div className="flex items-center gap-2.5">
            {!ready && (
              <button
                type="button"
                className="g-link me-3 cursor-pointer"
                onClick={onManageModels}
              >
                {usesProvider ? t("rewrite.noProvider") : t("rewrite.noModel")}
              </button>
            )}
            <span className="text-[14px] text-ink-2">
              {enabled ? t("rewrite.on") : t("rewrite.off")}
            </span>
            <Switch
              checked={enabled}
              onChange={(on) => updateSetting("post_process_enabled", on)}
              ariaLabel={t("sidebar.rewrite")}
            />
          </div>
        }
        lede={t("rewrite.lede")}
      />

      <IntroCard
        dim={!enabled}
        line={
          first ? (
            <Trans
              i18nKey={heroKey}
              values={{ name: firstName }}
              components={{
                keys: (
                  <span className="g-keys mx-1">{keysFor(first.slot)}</span>
                ),
              }}
            />
          ) : (
            t("rewrite.hero.none")
          )
        }
        hint={t("rewrite.heroHint", { undo: undoKeys })}
        actions={
          <>
            <button
              type="button"
              className="g-try"
              onClick={tryIt}
              disabled={trying || !first}
            >
              {trying ? t("rewrite.trying") : t("rewrite.tryIt")}
            </button>
            {modelName && (
              <button
                type="button"
                className="g-btn ghost cursor-pointer"
                onClick={onManageModels}
              >
                <i className="g-ic g-i-cpu" aria-hidden="true" />
                {modelName}
              </button>
            )}
          </>
        }
        demoLabel={t("rewrite.demo.label")}
        demo={<RewriteDemo draft={demoBefore} steps={steps} />}
      />

      <section className="g-group">
        <div className="g-titlebar items-center px-1">
          <h2 className="g-h2i">{t("rewrite.yours")}</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="g-btn ghost sm cursor-pointer"
              onClick={resetAll}
              disabled={busy}
            >
              <i className="g-ic g-i-again" aria-hidden="true" />
              {t("rewrite.resetAll")}
            </button>
            <button
              type="button"
              className="g-btn sec sm cursor-pointer disabled:opacity-50"
              onClick={newRewrite}
              disabled={busy || slotsFull}
            >
              <i className="g-ic g-i-plus" aria-hidden="true" />
              {t("rewrite.newRewrite")}
            </button>
          </div>
        </div>
        <div className="g-rwgrid">
          {rewrites.map(({ slot, rewrite }) => {
            const count = usage[rewrite.id] ?? 0;
            return (
              <button
                key={rewrite.id}
                type="button"
                className="g-rwcard cursor-pointer text-start"
                onClick={() => setOpen(rewrite.id)}
              >
                <span className="g-keys">{keysFor(slot)}</span>
                <span className="g-t">{rewrite.name}</span>
                <span className="g-d">
                  {rewrite.description ||
                    (isBuiltin(rewrite.id)
                      ? t(`rewrite.builtin.${builtinKey(rewrite.id)}.card`)
                      : rewrite.prompt || t("rewrite.customCard"))}
                </span>
                <span className="g-u">
                  {count > 0
                    ? t("rewrite.used", { count })
                    : t("rewrite.notUsed")}
                </span>
              </button>
            );
          })}
          {!slotsFull && (
            <button
              type="button"
              className="g-rwcard new cursor-pointer text-start"
              onClick={newRewrite}
              disabled={busy}
            >
              <span className="g-plusb">
                <i className="g-ic g-i-plus" aria-hidden="true" />
              </span>
              <span className="g-t">{t("rewrite.writeOwn")}</span>
              <span className="g-d">{t("rewrite.writeOwnHint")}</span>
            </button>
          )}
        </div>
        {bindings.refine_compare && (
          <p className="g-small mx-1 my-0">
            <Trans
              i18nKey="rewrite.compareHint"
              components={{
                keys: (
                  <Keycaps
                    binding={bindings.refine_compare.current_binding}
                    osType={osType}
                    size="line"
                  />
                ),
              }}
            />
          </p>
        )}
      </section>
    </>
  );
};
