import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { homeDir } from "@tauri-apps/api/path";

/** A folder Glider keeps: its title, its path (with ~ for home), and Open. */
export const PathRow: React.FC<{
  title: string;
  loadPath: () => Promise<string | null>;
  onOpen: () => void;
}> = ({ title, loadPath, onOpen }) => {
  const { t } = useTranslation();
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadPath(), homeDir().catch(() => "")]).then(([p, home]) => {
      if (!live || !p) return;
      const h = (home ?? "").replace(/[\\/]$/, "");
      setPath(h && p.startsWith(h) ? `~${p.slice(h.length)}` : p);
    });
    return () => {
      live = false;
    };
  }, [loadPath]);

  return (
    <div className="g-row">
      <div className="g-rl">
        <h3 className="g-rt m-0">{title}</h3>
        <p
          className="g-rd m-0 mt-0.5 truncate font-mono text-[13px] select-text"
          title={path ?? undefined}
        >
          {path ?? "…"}
        </p>
      </div>
      <div className="g-rr">
        <button
          type="button"
          className="g-btn sec cursor-pointer disabled:opacity-50"
          disabled={!path}
          onClick={onOpen}
        >
          <i className="g-ic g-i-folder" aria-hidden="true" />
          {t("common.open")}
        </button>
      </div>
    </div>
  );
};
