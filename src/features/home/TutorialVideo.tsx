import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const HOW_TO_VIDEO_URL: string | null = null;

/** The tutorial video: a thumbnail until it's clicked, then the player. */
export const TutorialVideo: React.FC = () => {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);

  if (playing && HOW_TO_VIDEO_URL) {
    return (
      <video
        src={HOW_TO_VIDEO_URL}
        controls
        autoPlay
        className="aspect-video w-full rounded-2xl border border-line bg-black"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={!HOW_TO_VIDEO_URL}
      onClick={() => setPlaying(true)}
      aria-label={t("home.tutorial.play")}
      className="group relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-logo-primary/25 via-card to-logo-primary/10 disabled:cursor-default"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-card shadow-[0_8px_24px_-10px_rgba(0,0,0,0.45)] transition-transform group-enabled:group-hover:scale-105">
        <i className="g-ic g-i-play ms-1 size-6 text-text" aria-hidden="true" />
      </span>
      <span className="font-ui text-[18px] font-normal text-text">
        {t("home.tutorial.title")}
      </span>
      {!HOW_TO_VIDEO_URL && (
        <span className="g-badge plain absolute top-3 end-3">
          {t("home.tutorial.soon")}
        </span>
      )}
    </button>
  );
};
