import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { prefersStill, sleep, tokens } from "@/common/lib/demo";
import { CheckIcon, Spinner } from "@/overlay/icons";

/** One rewrite the example runs: its shortcut, name and sample result. */
export interface RewriteStep {
  keys: string;
  name: string;
  result: string;
}

const ALL = Number.MAX_SAFE_INTEGER;

type Refine = "off" | "refining" | "done";

/** The Refine overlay's pill in miniature: "Using Polish" while the model
 * works, then "Done · See changes". Themed like the real one. */
const MiniRefine: React.FC<{ state: Refine; name: string }> = ({
  state,
  name,
}) => {
  const { t } = useTranslation();
  return (
    <span
      className={`g-mini g-mrefine ${state === "off" ? "away" : ""}`}
      aria-hidden="true"
    >
      {state === "done" ? (
        <>
          <CheckIcon color="var(--g-moss)" />
          <b>{t("overlay.done")}</b>
          <span className="g-mlink">{t("overlay.seeChanges")}</span>
        </>
      ) : (
        <>
          <span className="g-mshimmer">
            {t("overlay.usingRewrite", { name })}
          </span>
          <Spinner />
        </>
      )}
    </span>
  );
};

/** Rewrite's example on a loop: the draft gets selected, then each rewrite's
 * shortcut is pressed in turn, the Refine overlay works, and its result types
 * itself out. */
export const RewriteDemo: React.FC<{
  draft: string;
  steps: RewriteStep[];
}> = ({ draft, steps }) => {
  const parts = tokens(draft);
  const [selected, setSelected] = useState(parts.length);
  const [current, setCurrent] = useState(0);
  const [shown, setShown] = useState(ALL);
  const [pressed, setPressed] = useState(false);
  const [refine, setRefine] = useState<Refine>("off");
  const [out, setOut] = useState(false);
  // The loop restarts only when what it shows changes, not on every render.
  const plan = JSON.stringify(steps);

  useEffect(() => {
    const ctl = new AbortController();
    const { signal } = ctl;
    const list: RewriteStep[] = JSON.parse(plan);
    const words = tokens(draft);
    const play = async () => {
      if (!list.length) return;
      if (prefersStill()) {
        setRefine("done");
        return;
      }
      for (;;) {
        setOut(false);
        setSelected(0);
        setCurrent(0);
        setShown(0);
        await sleep(600, signal);
        for (let i = 1; i <= words.length; i++) {
          setSelected(i);
          await sleep(26, signal);
        }
        await sleep(350, signal);
        for (let s = 0; s < list.length; s++) {
          const text = list[s].result;
          setCurrent(s);
          setShown(0);
          await sleep(300, signal);
          setPressed(true);
          await sleep(280, signal);
          setPressed(false);
          // The overlay while the model works, the result, then "Done".
          setRefine("refining");
          await sleep(900, signal);
          for (let n = 1; n <= text.length; n++) {
            setShown(n);
            await sleep(22, signal);
          }
          setRefine("done");
          await sleep(1500, signal);
          setRefine("off");
          await sleep(450, signal);
        }
        await sleep(300, signal);
        setOut(true);
        await sleep(320, signal);
      }
    };
    play().catch(() => {});
    return () => {
      ctl.abort();
      setRefine("off");
    };
  }, [draft, plan]);

  const step = steps[Math.min(current, steps.length - 1)];
  return (
    <div className={`g-run ${out ? "out" : ""}`}>
      <p>
        {parts.map((part, i) => (
          <span key={i} className={i < selected ? "sel" : undefined}>
            {part}
          </span>
        ))}
      </p>
      {step && (
        <p className={`g-k ${pressed ? "held" : ""}`}>
          <b>{step.keys}</b>
          {step.name}
          <MiniRefine state={refine} name={step.name} />
        </p>
      )}
      {/* Every result sits in one cell, so the card keeps the longest's height. */}
      <div className="g-stack">
        {steps.map((s, i) =>
          i === current ? (
            <p key={i} className="g-a">
              {s.result.slice(0, shown)}
              <span className="g-caret" aria-hidden="true" />
              <span className="invisible">{s.result.slice(shown)}</span>
            </p>
          ) : (
            <p key={i} className="g-a invisible" aria-hidden="true">
              {s.result}
            </p>
          ),
        )}
      </div>
    </div>
  );
};
