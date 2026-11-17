import { useCallback, useEffect, useState } from "react";
import { commands, type LLMPrompt, type LlmModelInfo } from "@/bindings";
import { useSettings } from "@/common/settings/useSettings";

export interface SlottedRewrite {
  /** 1-based: the rewrite's shortcut is `refine_<slot>`. */
  slot: number;
  rewrite: LLMPrompt;
}

/** The built-in rewrites' ids, in shortcut order. */
export const BUILTIN_REWRITES = [
  "default_refine_polish",
  "default_refine_prompt",
  "default_refine_humanize",
  "default_refine_grammar",
] as const;

export const isBuiltin = (id: string) =>
  (BUILTIN_REWRITES as readonly string[]).includes(id);

/** The short key a built-in rewrite's texts live under: polish, prompt... */
export const builtinKey = (id: string) => id.replace("default_refine_", "");

/** Rewrite's settings: the rewrites on their shortcuts, how often each ran,
 * and the LLM that runs them. */
export const useRewrites = () => {
  const { getSetting, refreshSettings } = useSettings();
  const [usage, setUsage] = useState<Partial<Record<string, number>>>({});
  const [llms, setLlms] = useState<LlmModelInfo[]>([]);

  const refresh = useCallback(async () => {
    const [counts, models] = await Promise.all([
      commands.getRewriteUsage(),
      commands.getLlmModels(),
    ]);
    setUsage(counts);
    setLlms(models);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const prompts = getSetting("post_process_prompts") ?? [];
  const slots = getSetting("refine_prompt_ids") ?? [];
  const rewrites: SlottedRewrite[] = slots
    .map((id, i) => ({
      slot: i + 1,
      rewrite: prompts.find((p) => p.id === id),
    }))
    .filter((r): r is SlottedRewrite => !!r.rewrite);

  const usesProvider = getSetting("llm_use_provider") ?? false;
  const llm = llms.find(
    (m) => m.id === getSetting("llm_model") && m.is_downloaded,
  );
  const provider = getSetting("post_process_providers")?.find(
    (p) => p.id === getSetting("post_process_provider_id"),
  );
  const providerModel = provider
    ? getSetting("post_process_models")?.[provider.id]
    : undefined;
  const modelName = usesProvider
    ? providerModel || provider?.label || ""
    : (llm?.short_name ?? "");

  return {
    rewrites,
    prompts,
    usage,
    llms,
    llm,
    usesProvider,
    modelName,
    /** Something can run a rewrite right now. */
    ready: usesProvider ? !!providerModel : !!llm,
    refresh,
    refreshSettings,
  };
};
