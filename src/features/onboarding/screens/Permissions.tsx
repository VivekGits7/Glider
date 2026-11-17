import React, { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { relaunch } from "@tauri-apps/plugin-process";
import { commands } from "@/bindings";
import { NextButton, ObHeader, OnboardingShell } from "../OnboardingShell";
import { useOnboardingStore } from "../onboardingStore";
import type { Permissions as PermissionsState } from "../usePermissions";

interface PermissionRowProps {
  /** A canvas icon name. */
  icon: string;
  title: string;
  why: string;
  status: PermissionsState["microphone"];
  /** Its turn: the rows are allowed in order, so only this one is live. */
  next: boolean;
  action: string;
  /** While waiting, what to do in the OS, in place of `why`. */
  instruction?: string;
  onRequest: () => void;
}

/** One permission row (the canvas's .perm): icon, why, then Allow or Allowed. */
const PermissionRow: React.FC<PermissionRowProps> = ({
  icon,
  title,
  why,
  status,
  next,
  action,
  instruction,
  onRequest,
}) => {
  const { t } = useTranslation();
  const waiting = status === "waiting";
  return (
    <div className="g-perm">
      <span className="g-picon">
        <i className={`g-ic g-i-${icon}`} aria-hidden="true" />
      </span>
      <div>
        <div className="g-rt">{title}</div>
        <div className={`g-rd ${waiting && instruction ? "text-text" : ""}`}>
          {(waiting && instruction) || why}
        </div>
      </div>
      {status === "granted" ? (
        <span className="g-badge moss">
          <i className="g-ic g-i-check" aria-hidden="true" />
          {t("onboarding.permissions.allowed")}
        </span>
      ) : waiting ? (
        <span className="inline-flex items-center gap-2 text-[13px] text-ink-3">
          <span className="g-spin" aria-hidden="true" />
          {t("onboarding.permissions.waiting")}
        </span>
      ) : (
        <button
          type="button"
          className={`g-btn sm ${next ? "pri cursor-pointer" : "off cursor-not-allowed"}`}
          disabled={!next}
          onClick={onRequest}
        >
          {action}
        </button>
      )}
    </div>
  );
};

interface PermissionsProps {
  permissions: PermissionsState;
  /** In the flow: its place and Back. Standalone (a returning user): neither. */
  progress?: { index: number; count: number };
  onBack?: () => void;
  onContinue: () => void;
}

/** Screen 2: microphone, plus Accessibility on macOS, granted in order. */
export const Permissions: React.FC<PermissionsProps> = ({
  permissions,
  progress,
  onBack,
  onContinue,
}) => {
  const { t } = useTranslation();
  const { welcomeBack, preview, set } = useOnboardingStore();
  const isMac = permissions.platform === "macos";
  const rows = isMac
    ? (["microphone", "accessibility"] as const)
    : (["microphone"] as const);
  const next = rows.find((r) => permissions[r] !== "granted");
  // Asking for the microphone opens the OS settings on Windows, and on macOS
  // once it has asked: then the row says what to turn on there.
  const [micInSettings, setMicInSettings] = useState(false);
  // macOS: Fn (🌐) alone opens the emoji picker or switches the input source,
  // which would fire with every Fn dictation. Optional: null hides the row.
  const [fnKey, setFnKey] = useState<"needed" | "granted" | null>(null);
  useEffect(() => {
    if (!isMac || preview) return;
    commands.fnKeyHasSystemAction().then((has) => has && setFnKey("needed"));
  }, [isMac, preview]);
  const turnOffFnKey = async () => {
    const result = await commands.disableFnKeySystemAction();
    if (result.status === "ok") setFnKey("granted");
    else await commands.openKeyboardSettings();
  };
  const turnOn = t(
    isMac
      ? "onboarding.permissions.turnOnMac"
      : "onboarding.permissions.turnOnWindows",
  );

  const relaunchGlider = async () => {
    if (preview) return;
    set({ step: "permissions", welcomeBack: true });
    await relaunch();
  };

  return (
    <OnboardingShell
      progress={progress}
      onBack={onBack}
      hint={
        permissions.allGranted
          ? ""
          : t(
              isMac
                ? "onboarding.permissions.hintBoth"
                : "onboarding.permissions.hintMicrophone",
            )
      }
      primary={
        <NextButton
          disabled={!permissions.allGranted}
          onClick={() => {
            if (welcomeBack) set({ welcomeBack: false });
            onContinue();
          }}
        />
      }
    >
      <ObHeader
        above={
          welcomeBack && (
            <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-moss">
              <i className="g-ic g-i-check size-3.5" aria-hidden="true" />
              {t("onboarding.permissions.welcomeBack")}
            </p>
          )
        }
        title={t(
          isMac
            ? "onboarding.permissions.titleMac"
            : "onboarding.permissions.titleWindows",
        )}
        sub={t(
          isMac
            ? "onboarding.permissions.subtitleMac"
            : "onboarding.permissions.subtitleWindows",
        )}
      />
      <div className="g-list">
        <PermissionRow
          icon="mic"
          title={t("onboarding.permissions.microphone.name")}
          why={t("onboarding.permissions.microphone.why")}
          status={permissions.microphone}
          next={next === "microphone"}
          action={t(
            permissions.microphoneAsked && isMac
              ? "onboarding.permissions.openSettings"
              : "onboarding.permissions.allow",
          )}
          instruction={micInSettings ? turnOn : undefined}
          onRequest={() => {
            setMicInSettings(!isMac || permissions.microphoneAsked);
            permissions.requestMicrophone();
          }}
        />
        {isMac && (
          <PermissionRow
            icon="keyboard"
            title={t("onboarding.permissions.accessibility.name")}
            why={t("onboarding.permissions.accessibility.why")}
            status={permissions.accessibility}
            next={next === "accessibility"}
            action={t("onboarding.permissions.allow")}
            instruction={turnOn}
            onRequest={permissions.requestAccessibility}
          />
        )}
        {isMac && fnKey && (
          <PermissionRow
            icon="globe"
            title={t("onboarding.permissions.fnKey.name")}
            why={t("onboarding.permissions.fnKey.why")}
            status={fnKey}
            next={next === undefined}
            action={t("onboarding.permissions.fnKey.action")}
            onRequest={turnOffFnKey}
          />
        )}
      </div>
      {isMac && (
        <p className="g-small m-0">
          <Trans
            i18nKey="onboarding.permissions.relaunch"
            components={{
              relaunch: (
                <button
                  type="button"
                  className="g-link cursor-pointer"
                  onClick={relaunchGlider}
                />
              ),
            }}
          />
        </p>
      )}
    </OnboardingShell>
  );
};
