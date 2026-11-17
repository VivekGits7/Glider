import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { countChanges, wordDiff } from "@/features/llm/lib/wordDiff";
import { CountdownClose } from "./CountdownClose";
import { AgainIcon, CheckIcon, CopyIcon, Spinner } from "./icons";

/** The last rewrite, as Rust sends it with `refine-changes`. */
export interface RefineChanges {
  id: number;
  prompt_id: string;
  prompt_name: string;
  model: string;
  before: string;
  after: string;
  rating: number | null;
}

export type RefineState = "refining" | "refined" | "refine_changes";

export const isRefineState = (state: string): state is RefineState =>
  state === "refining" || state === "refined" || state === "refine_changes";

interface RefineOverlayProps {
  state: RefineState;
  visible: boolean;
  position: "top" | "bottom";
  /** The rewrite running, e.g. "Polish". */
  name: string;
  changes: RefineChanges | null;
  mac: boolean;
}

/** One icon button in the changes card, with its tooltip. */
const Action: React.FC<{
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, onClick, children }) => (
  <span className="mo-tipwrap">
    <button
      type="button"
      className="mo-abtn"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
    <span className="mo-tip">{label}</span>
  </span>
);

/** Refine on the overlay: "Using Polish" while it runs, "Done · See
 * changes" after the paste, and the card that shows what changed. */
export const RefineOverlay: React.FC<RefineOverlayProps> = ({
  state,
  visible,
  position,
  name,
  changes,
  mac,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const result = await commands.copyRefineResult();
    if (result.status === "ok") {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  let card: React.ReactNode = null;
  if (state === "refining") {
    card = (
      <div className="mo-pill tight" role="status">
        <span className="mo-shimmer">
          {t("overlay.usingRewrite", { name })}
        </span>
        <Spinner />
      </div>
    );
  } else if (state === "refined") {
    card = (
      <div className="mo-pill tight" role="status">
        <CheckIcon color="var(--mo-moss)" />
        <span className="mo-strong">{t("overlay.done")}</span>
        <button
          type="button"
          className="mo-link"
          onClick={() => commands.showRefineChanges()}
        >
          {t("overlay.seeChanges")}
        </button>
      </div>
    );
  } else if (changes) {
    const parts = wordDiff(changes.before, changes.after);
    card = (
      <section
        className="mo-card mo-changes"
        aria-label={t("overlay.changesLabel")}
      >
        <div className="mo-chtop">
          <span className="mo-chtitle">
            {t("overlay.changes", { count: countChanges(parts) })}
          </span>
          <span className="mo-chright">
            <span className="mo-undo">
              <kbd>{mac ? "⌘" : "Ctrl"}</kbd>
              <kbd>Z</kbd>
              {t("overlay.toUndo")}
            </span>
            <CountdownClose
              key={changes.id}
              label={t("overlay.close")}
              mac={mac}
              onClose={() => commands.hideRefineOverlay()}
            />
          </span>
        </div>
        <p className="mo-diff">
          {parts.map((part, i) =>
            part.type === "same" ? (
              <React.Fragment key={i}>{part.text}</React.Fragment>
            ) : part.type === "del" ? (
              <del key={i}>{part.text}</del>
            ) : (
              <ins key={i}>{part.text}</ins>
            ),
          )}
        </p>
        <div className="mo-chfoot">
          <div className="mo-acts">
            <Action label={t("overlay.copyResult")} onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Action>
            <Action
              label={t("overlay.again")}
              onClick={() => commands.refineAgainCommand()}
            >
              <AgainIcon />
            </Action>
          </div>
          <span className="mo-meta">
            {changes.model
              ? `${changes.prompt_name} · ${changes.model}`
              : changes.prompt_name}
          </span>
        </div>
      </section>
    );
  }

  return (
    <div className={`ov-stage ${position} ov-fade ${visible ? "show" : ""}`}>
      <div className="mo">{card}</div>
    </div>
  );
};
