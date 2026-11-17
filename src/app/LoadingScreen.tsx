import React from "react";
import { useTranslation } from "react-i18next";
import GliderMark from "@/common/icons/GliderMark";

/** The launch screen: the wing draws itself, fills, fades, and loops while
 * the speech model loads. */
export const LoadingScreen: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div
      className="flex h-screen w-full items-center justify-center bg-ground select-none"
      data-tauri-drag-region
      role="status"
      aria-label={t("loading.label")}
    >
      <GliderMark className="g-boot-wing" />
    </div>
  );
};
