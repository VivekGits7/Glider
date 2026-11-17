import React from "react";
import { useTranslation } from "react-i18next";

/** A feature page's opening card: how to use it on the left, and on the
 * right a small editor-style example of what it does. */
export const IntroCard: React.FC<{
  /** The serif how-to sentence, usually with the shortcut's keycaps in it. */
  line: React.ReactNode;
  hint: React.ReactNode;
  actions?: React.ReactNode;
  /** `.g-demo` children: the input, a `.g-k` shortcut note, the result. */
  demo: React.ReactNode;
  demoLabel: string;
  dim?: boolean;
  /** Adds the example's mute button beside its first line; leave out when there's no voice. */
  sound?: { on: boolean; toggle: () => void };
}> = ({ line, hint, actions, demo, demoLabel, dim = false, sound }) => {
  const { t } = useTranslation();
  const soundLabel = sound?.on
    ? t("common.muteExample")
    : t("common.hearExample");
  return (
    <section className={`g-intro ${dim ? "opacity-60" : ""}`}>
      <div>
        <p className="g-sline">{line}</p>
        <p className="g-hint">{hint}</p>
        {actions && (
          <div className="mt-5 flex items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="g-demo" role="figure" aria-label={demoLabel}>
        {/* Centred in the column; the mute button sits on its first line. */}
        <div className="g-demo-in">
          {demo}
          {sound && (
            <button
              type="button"
              className="g-ib g-intro-sound cursor-pointer"
              aria-label={soundLabel}
              title={soundLabel}
              onClick={sound.toggle}
            >
              <i
                className={`g-ic ${sound.on ? "g-i-speaker" : "g-i-speaker-off"}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
