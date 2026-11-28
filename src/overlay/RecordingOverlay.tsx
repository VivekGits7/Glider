import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./RecordingOverlay.css";
import { commands, events } from "@/bindings";
import type {
  Notice,
  StreamPhase,
  StreamPhaseEvent,
  StreamTextEvent,
  StreamWorkKind,
} from "@/bindings";
import { NoticeBadgeIcon } from "@/common/icons/NoticeBadgeIcon";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { noticeDisplay } from "@/common/notices/notices";
import type { ModelStateEvent } from "@/common/lib/events";
import { getLanguageDirection } from "@/common/lib/rtl";
import "@/styles/glider-ui.css";
import {
  BarsIcon,
  CheckIcon,
  CopyIcon,
  MinusIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  PrevIcon,
  Spinner,
  XIcon,
} from "./icons";
import { CountdownClose, ESC_KEY } from "./CountdownClose";
import {
  RefineOverlay,
  isRefineState,
  type RefineChanges,
} from "./RefineOverlay";

type OverlayState =
  | "recording"
  | "streaming"
  | "transcribing"
  | "processing"
  | "notice"
  | "live_notice"
  | "reading"
  | "refining"
  | "refined"
  | "refine_changes"
  | "nowhere"
  | "read_done";

// Read Aloud: the sentence being spoken and the few before it.
interface ReadingProgress {
  done: string;
  current: string;
  /** Which sentence of how many. */
  index: number;
  total: number;
}
const NO_READING: ReadingProgress = {
  done: "",
  current: "",
  index: 0,
  total: 0,
};
/** Past this many sentences, progress is one bar instead of a segment each. */
const MAX_SEGMENTS = 16;
/** Bars in the listening pill. */
const LISTEN_BARS = 11;
/** How long a new reading speed stays highlighted. */
const SPEED_FLASH_MS = 1200;

const isNoticeState = (state: OverlayState) =>
  state === "notice" || state === "live_notice";

// Only call out a model load in the Live preview once it has run this long.
// Warm loads finish in well under this (~0.2s on Apple Silicon, ~1.5s on a
// Windows CPU backend), so the common case never flashes a loading notice while
// the user is speaking; cold loads can take 40s+.
const SLOW_MODEL_LOAD_MS = 2000;

// Matches the delay in `hide_recording_overlay`, so a notice can fade out.
const OVERLAY_FADE_MS = 300;

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  // `Stream::play()` returning does not mean hardware callbacks are flowing.
  // Stay visually in an arming state until the backend processes the first
  // actual microphone sample chunk.
  const [captureReady, setCaptureReady] = useState(false);
  // Recording starts while the model loads in the background. Say so, otherwise
  // a cold start looks like an empty Live preview that ignores speech, then a
  // hung "Transcribing..." spinner. Once recording stops, any in-flight load is
  // the wait, so the working label reflects it immediately; the Live notice
  // waits for the load to be slow so fast loads don't flash it mid-speech.
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoadSlow, setModelLoadSlow] = useState(false);
  const modelLoadTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // Latched per Live session: once the loading notice has opened the panel, keep
  // it open after the load so it doesn't collapse and reopen when text arrives.
  const [loadNoticeShown, setLoadNoticeShown] = useState(false);
  // All 16 smoothed buckets: the Live waveform shows the first few, the
  // listening pill more.
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0));
  const [streamText, setStreamText] = useState<StreamTextEvent>({
    committed: "",
    tentative: "",
  });
  const [phase, setPhase] = useState<StreamPhase>("listening");
  const [workKind, setWorkKind] = useState<StreamWorkKind>("transcribing");
  // Bumped on each new session so a card (Live text, nowhere to type)
  // remounts fresh.
  const [session, setSession] = useState(0);
  // Overlay placement (top vs bottom of the screen). The Live panel grows downward
  // from a top overlay (oldest line under the pill) and upward from a bottom one.
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  // True once live text overflows the cap. A top overlay fades its top edge only
  // while overflowing, so the resting first line stays crisp flush under the pill.
  const [overflowing, setOverflowing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reading, setReading] = useState<ReadingProgress>(NO_READING);
  const [readingPaused, setReadingPaused] = useState(false);
  const [readingSpeed, setReadingSpeed] = useState(1);
  // Read Aloud's live preview: the sentence being read, above the player.
  const [readingPreview, setReadingPreview] = useState(true);
  const [refineName, setRefineName] = useState("");
  // Hands-free: the key came up quickly (or the shortcut toggles), so the
  // recording runs until ✓, the shortcut again, or ✕.
  const [locked, setLocked] = useState(false);
  const [nowhereText, setNowhereText] = useState("");
  const [nowhereCopied, setNowhereCopied] = useState(false);
  const [speedChanged, setSpeedChanged] = useState(false);
  const speedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [refineChanges, setRefineChanges] = useState<RefineChanges | null>(
    null,
  );
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));
  // Live-text scroll-back: the text region "sticks" to the newest line while the
  // user is at the bottom; if they scroll up to read history, auto-follow pauses
  // until they scroll back down.
  const capRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const direction = getLanguageDirection(i18n.language);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenNotice = await listen<Notice>("overlay-notice", (event) => {
        clearTimeout(fadeTimerRef.current);
        setNotice(event.payload);
      });

      const unlistenShow = await listen("show-overlay", async (event) => {
        const overlayState = event.payload as OverlayState;
        clearTimeout(fadeTimerRef.current);
        if (!isNoticeState(overlayState)) setNotice(null);
        // Reset synchronously before settings I/O. A fast microphone can emit
        // recording-ready while the awaits below are in flight; resetting after
        // them would overwrite that event and leave the overlay stuck arming.
        if (overlayState === "reading") {
          setReading(NO_READING);
          setReadingPaused(false);
          setSession((s) => s + 1);
        }
        if (overlayState === "nowhere") {
          setNowhereCopied(false);
          setSession((s) => s + 1);
        }
        if (overlayState === "recording" || overlayState === "streaming") {
          setCaptureReady(false);
          smoothedLevelsRef.current = Array(16).fill(0);
          setLevels(Array(16).fill(0));
          setStreamText({ committed: "", tentative: "" });
        }

        await syncLanguageFromSettings();
        // The Live panel flows downward from a top overlay and upward from a
        // bottom one; read the placement so the layout can flip to match.
        try {
          const settings = await commands.getAppSettings();
          if (settings.status === "ok") {
            setPosition(
              settings.data.overlay_position === "top" ? "top" : "bottom",
            );
            setReadingSpeed(settings.data.tts_speed ?? 1);
            setReadingPreview(settings.data.tts_live_preview ?? true);
          }
        } catch {
          // Keep the previous/default placement if settings can't be read.
        }
        setState(overlayState);
        if (overlayState === "streaming") {
          setPhase("listening");
          setWorkKind("transcribing");
          setLoadNoticeShown(false);
          setSession((s) => s + 1); // remount the card fresh for this session
        }
        setIsVisible(true);
      });

      const unlistenRefineStatus = await listen<{ prompt: string }>(
        "refine-status",
        (event) => setRefineName(event.payload.prompt),
      );
      const unlistenNowhere = await listen<string>("nowhere-text", (event) =>
        setNowhereText(event.payload),
      );
      const unlistenPaused = await listen<boolean>("reading-paused", (event) =>
        setReadingPaused(event.payload),
      );
      // Started comes before Locked from the same thread, so it resets first.
      const unlistenPhase2 = await events.recordingStateEvent.listen(
        (event) => {
          const phase = event.payload.phase;
          if (phase === "started") setLocked(false);
          else if (phase === "locked") setLocked(true);
        },
      );
      const unlistenRefineChanges = await listen<RefineChanges>(
        "refine-changes",
        (event) => setRefineChanges(event.payload),
      );

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
        setCaptureReady(false);
        // A notice keeps rendering while it fades. Dropping the transcript here
        // stops a later notice from showing an old session's text.
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => {
          setNotice(null);
          setStreamText({ committed: "", tentative: "" });
          setReading(NO_READING);
        }, OVERLAY_FADE_MS);
      });

      const unlistenReady = await listen("recording-ready", () => {
        setCaptureReady(true);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];
        // Exponential smoothing across the 16 buckets, then take the first N
        // bars for the shared waveform.
        const smoothed = smoothedLevelsRef.current.map((prev, i) => {
          const target = newLevels[i] || 0;
          return prev * 0.7 + target * 0.3;
        });
        smoothedLevelsRef.current = smoothed;
        setLevels(smoothed);
      });

      const unlistenReading = await listen<ReadingProgress>(
        "reading-progress",
        (event) => setReading(event.payload),
      );

      const unlistenStream = await events.streamTextEvent.listen((event) => {
        setStreamText(event.payload);
      });

      const unlistenPhase = await events.streamPhaseEvent.listen((event) => {
        const payload: StreamPhaseEvent = event.payload;
        setPhase(payload.phase);
        if (payload.kind) setWorkKind(payload.kind);
      });

      // The backend ends every `loading_started` with exactly one of completed
      // or failed, so only those end a load. Other events (e.g. `unloaded` from
      // the idle watcher) aren't ordered against an in-flight load and must not
      // clear it.
      const unlistenModel = await listen<ModelStateEvent>(
        "model-state-changed",
        (event) => {
          const type = event.payload.event_type;
          if (type === "loading_started") {
            clearTimeout(modelLoadTimerRef.current);
            setModelLoading(true);
            setModelLoadSlow(false);
            modelLoadTimerRef.current = setTimeout(
              () => setModelLoadSlow(true),
              SLOW_MODEL_LOAD_MS,
            );
          } else if (
            type === "loading_completed" ||
            type === "loading_failed"
          ) {
            clearTimeout(modelLoadTimerRef.current);
            setModelLoading(false);
            setModelLoadSlow(false);
          }
        },
      );

      return () => {
        unlistenNotice();
        unlistenShow();
        unlistenHide();
        unlistenReady();
        unlistenLevel();
        unlistenStream();
        unlistenReading();
        unlistenPhase();
        unlistenModel();
        unlistenRefineStatus();
        unlistenNowhere();
        unlistenPaused();
        unlistenPhase2();
        unlistenRefineChanges();
        clearTimeout(modelLoadTimerRef.current);
        clearTimeout(fadeTimerRef.current);
        clearTimeout(speedTimerRef.current);
      };
    };

    setupEventListeners();
  }, []);

  // Stick to the bottom as text streams in — but only while pinned, so a user who
  // has scrolled up to read history isn't yanked back down by the next chunk.
  useLayoutEffect(() => {
    const el = capRef.current;
    if (!el) return;
    // Fade the top edge only once text actually overflows the cap.
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
    if (pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [streamText, reading]);

  // `session` re-runs this when a new Live session starts mid-load (e.g. a
  // retry during a cold load), since the reset doesn't change the other deps.
  useEffect(() => {
    if (modelLoadSlow && state === "streaming") setLoadNoticeShown(true);
  }, [modelLoadSlow, state, session]);

  // Each fresh streaming session starts pinned to the bottom, fade cleared.
  useEffect(() => {
    pinnedRef.current = true;
    setOverflowing(false);
  }, [session]);

  const shownNotice = notice && isNoticeState(state) ? notice : null;
  const noticeTitle = shownNotice
    ? t(noticeDisplay(shownNotice.code).title)
    : "";

  if (!isVisible && !shownNotice) return null;

  // Re-pin when the user is within ~a line of the bottom; unpin otherwise.
  const handleStreamScroll = () => {
    const el = capRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 16;
  };

  const transcribingLabel = modelLoading
    ? t("overlay.loadingModel")
    : t("overlay.transcribing");

  const dismissNotice = shownNotice
    ? () => commands.dismissOverlayNotice()
    : undefined;

  // ---- Refine: the Refining and Done pills, and the changes card ----
  if (isRefineState(state)) {
    return (
      <RefineOverlay
        state={state}
        visible={isVisible}
        position={position}
        name={refineName}
        changes={refineChanges}
        mac={navigator.userAgent.includes("Mac")}
      />
    );
  }

  const mac = navigator.userAgent.includes("Mac");
  /** A tooltip line, with its key on a Mac. */
  const keyed = (label: string, key: string) => (
    <span className={`mo-tip ${mac ? "keyed" : ""}`}>
      {label}
      {mac && <kbd>{key}</kbd>}
    </span>
  );

  // ---- Nowhere to type: the dictated text, ready to copy ----
  if (state === "nowhere") {
    const dismiss = () => commands.dismissOverlayNotice();
    return (
      <div
        dir={direction}
        className={`ov-stage ${position} ov-fade ${isVisible ? "show" : ""}`}
      >
        <div className="mo">
          <div key={session} className="mo-card" role="status">
            <div className="mo-cardtop">
              <BarsIcon />
              <span className="mo-hint">{t("overlay.nowhereHint")}</span>
              <CountdownClose
                label={t("overlay.close")}
                mac={mac}
                onClose={dismiss}
              />
            </div>
            <p className="mo-said">{nowhereText}</p>
            <div className="mo-cardfoot">
              {nowhereCopied ? (
                <>
                  <span className="mo-note">
                    {t("overlay.pasteHint", { keys: mac ? "⌘V" : "Ctrl+V" })}
                  </span>
                  <button type="button" className="mo-copied">
                    <CheckIcon size={11} />
                    {t("overlay.copied")}
                  </button>
                </>
              ) : (
                <>
                  <span className="mo-note">{t("overlay.savedInHistory")}</span>
                  <button
                    type="button"
                    className="mo-copy"
                    onClick={async () => {
                      const result = await commands.copyNowhereText();
                      if (result.status === "ok") setNowhereCopied(true);
                    }}
                  >
                    <CopyIcon />
                    {t("overlay.copy")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Read Aloud: the player while it speaks ----
  if (state === "reading" || state === "read_done") {
    const hasText = reading.current.length > 0;
    const segments = reading.total > 0 && reading.total <= MAX_SEGMENTS;
    // Roughly how long the sentence takes, so its dash fills as it's read.
    const sentenceSeconds = Math.max(
      1.5,
      reading.current.length / (15 * Math.max(0.5, readingSpeed)),
    );
    const sentenceLabel = t("overlay.sentence", {
      index: reading.index + 1,
      total: reading.total,
    });
    const changeSpeed = async (delta: number) => {
      setReadingSpeed(await commands.changeReadingSpeed(delta));
      setSpeedChanged(true);
      clearTimeout(speedTimerRef.current);
      speedTimerRef.current = setTimeout(
        () => setSpeedChanged(false),
        SPEED_FLASH_MS,
      );
    };
    const playLabel = readingPaused ? t("overlay.play") : t("overlay.pause");

    let body: React.ReactNode;
    if (state === "read_done") {
      body = (
        <div className="mo-pill tight" role="status">
          <CheckIcon color="var(--mo-moss)" />
          <span className="mo-strong">{t("overlay.doneReading")}</span>
        </div>
      );
    } else if (!hasText) {
      body = (
        <div className="mo-pill tight" role="status">
          <Spinner />
          <span className="mo-shimmer">{t("overlay.preparingVoice")}</span>
          {/* Like dictation's pill: stop it here, as well as with Esc. */}
          <button
            type="button"
            className="mo-hbtn cancel"
            aria-label={t("overlay.cancel")}
            title={t("overlay.cancel")}
            onClick={() => commands.stopSpeaking()}
          >
            <XIcon />
          </button>
        </div>
      );
    } else {
      body = (
        <div
          className="mo-player"
          role="group"
          aria-label={t("overlay.readingAloud")}
        >
          <span className="mo-tipwrap">
            <button
              type="button"
              className="mo-ibtn"
              aria-label={t("overlay.previous")}
              onClick={() => commands.skipReading(-1)}
            >
              <PrevIcon />
            </button>
            {keyed(t("overlay.previous"), "F7")}
          </span>
          <span className="mo-tipwrap">
            <button
              type="button"
              className="mo-play"
              aria-label={playLabel}
              onClick={async () =>
                setReadingPaused(await commands.toggleReadingPause())
              }
            >
              {readingPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
            {keyed(playLabel, "F8")}
          </span>
          <span className="mo-tipwrap">
            <button
              type="button"
              className="mo-ibtn"
              aria-label={t("overlay.next")}
              onClick={() => commands.skipReading(1)}
            >
              <NextIcon />
            </button>
            {keyed(t("overlay.next"), "F9")}
          </span>
          <span className="mo-tipwrap">
            {segments ? (
              <span className="mo-segs" role="img" aria-label={sentenceLabel}>
                {Array.from({ length: reading.total }, (_, i) => (
                  <span
                    key={i}
                    className={`mo-seg ${
                      i < reading.index
                        ? "done"
                        : i === reading.index
                          ? `cur ${readingPaused ? "paused" : ""}`
                          : ""
                    }`}
                    style={
                      i === reading.index
                        ? ({
                            "--mo-dur": `${sentenceSeconds}s`,
                          } as React.CSSProperties)
                        : undefined
                    }
                  />
                ))}
              </span>
            ) : (
              <span
                style={{ display: "inline-flex", alignItems: "center" }}
                role="img"
                aria-label={sentenceLabel}
              >
                <span className="mo-longbar">
                  <span
                    style={{
                      width: `${((reading.index + 1) / Math.max(1, reading.total)) * 100}%`,
                    }}
                  />
                </span>
                <span className="mo-count">{`${reading.index + 1} / ${reading.total}`}</span>
              </span>
            )}
            <span className={`mo-tip ${mac ? "keyed" : ""}`}>
              {sentenceLabel}
              {mac && (
                <>
                  {" ·"}
                  <kbd>{ESC_KEY}</kbd>
                  {t("overlay.toStop")}
                </>
              )}
            </span>
          </span>
          <span className="mo-speed">
            <button
              type="button"
              className="mo-sbtn"
              aria-label={t("overlay.slower")}
              onClick={() => changeSpeed(-0.1)}
            >
              <MinusIcon />
            </button>
            <span
              className={`mo-sval ${speedChanged ? "changed" : ""}`}
              aria-live="polite"
            >{`${readingSpeed.toFixed(1)}x`}</span>
            <button
              type="button"
              className="mo-sbtn"
              aria-label={t("overlay.faster")}
              onClick={() => changeSpeed(0.1)}
            >
              <PlusIcon />
            </button>
          </span>
        </div>
      );
    }
    return (
      <div
        dir={direction}
        className={`ov-stage ${position} ov-fade ${isVisible ? "show" : ""}`}
      >
        <div className="mo mo-stack">
          {state === "reading" && hasText && readingPreview && (
            <div className="mo-card mo-live">
              <div className="mo-livetext">
                <p key={reading.index} className="mo-fadein">
                  {reading.current}
                </p>
              </div>
            </div>
          )}
          {body}
        </div>
      </div>
    );
  }

  // ---- Dictation: one pill at a time — listening (hold), hands-free
  // (✕ · bars · ✓), transcribing (dots), Refining, or a notice. The Live style
  // adds what you've said so far in a small card above the pill.
  const liveNotice = state === "live_notice" ? shownNotice : null;
  const live = state === "streaming" || liveNotice !== null;
  const liveWorking = state === "streaming" && phase === "working";
  const polishing =
    state === "processing" || (liveWorking && workKind === "polishing");
  const transcribing = state === "transcribing" || (liveWorking && !polishing);

  const bars = (
    <div
      className={`mo-wave ${captureReady ? "" : "arming"}`}
      aria-hidden="true"
    >
      {levels.slice(0, LISTEN_BARS).map((v, i) => (
        <i
          key={i}
          style={{
            height: `${captureReady ? 2 + Math.min(1, Math.pow(v, 0.7)) * 10 : 2}px`,
          }}
        />
      ))}
    </div>
  );

  let pill: React.ReactNode;
  if (shownNotice) {
    const code = shownNotice.code;
    pill = (
      <div
        className={`mo-pill tight level-${shownNotice.level}`}
        role="status"
        onClick={dismissNotice}
      >
        {code === "VoiceModelMissing" ? (
          <>
            <span>{t("overlay.noVoiceYet")}</span>
            <button
              type="button"
              className="mo-link"
              onClick={(event) => {
                event.stopPropagation();
                commands.openModelsTab("voices");
                commands.dismissOverlayNotice();
              }}
            >
              {t("overlay.getVoice")}
            </button>
          </>
        ) : (
          <>
            {code !== "NoTextSelected" && (
              <NoticeBadgeIcon className="nglyph" />
            )}
            <span>{noticeTitle}</span>
          </>
        )}
      </div>
    );
  } else if (polishing) {
    pill = (
      <div className="mo-pill" role="status">
        <span className="mo-shimmer">{t("overlay.refining")}</span>
        <Spinner />
      </div>
    );
  } else if (transcribing) {
    pill = (
      <div className="mo-pill" role="status" aria-label={transcribingLabel}>
        <div className="mo-wave dots" aria-hidden="true">
          {Array.from({ length: LISTEN_BARS }, (_, i) => (
            <i
              key={i}
              style={{ animationDelay: `${(i * 0.09).toFixed(2)}s` }}
            />
          ))}
        </div>
        <Spinner />
      </div>
    );
  } else if (locked) {
    pill = (
      <div
        className="mo-pill hf"
        role="status"
        aria-label={t("overlay.listening")}
      >
        <span className="mo-tipwrap">
          <button
            type="button"
            className="mo-hbtn cancel"
            aria-label={t("overlay.cancel")}
            onClick={() => commands.cancelOperation()}
          >
            <XIcon />
          </button>
          <span className="mo-tip">{t("overlay.cancel")}</span>
        </span>
        {bars}
        <span className="mo-tipwrap">
          <button
            type="button"
            className="mo-hbtn finish"
            aria-label={t("overlay.finishAndPaste")}
            onClick={() => commands.finishRecording()}
          >
            <CheckIcon />
          </button>
          <span className="mo-tip">{t("overlay.finishAndPaste")}</span>
        </span>
      </div>
    );
  } else {
    pill = (
      <div
        className="mo-pill"
        role="status"
        aria-label={t("overlay.listening")}
      >
        {bars}
      </div>
    );
  }

  let liveCard: React.ReactNode = null;
  if (live) {
    const hasText =
      streamText.committed.length > 0 || streamText.tentative.length > 0;
    // A notice keeps the transcript; with none, the card explains the notice.
    const noticeText =
      liveNotice && !hasText
        ? (noticeDisplay(liveNotice.code).explanation?.(t) ?? liveNotice.detail)
        : null;
    // A slow model load says so where the text would be, so speech that isn't
    // transcribing yet doesn't look ignored; the card then stays open.
    const loadingNotice =
      !liveNotice && modelLoadSlow && !liveWorking && !hasText;
    if (
      hasText ||
      noticeText ||
      loadingNotice ||
      (loadNoticeShown && !liveWorking && !liveNotice)
    ) {
      liveCard = (
        <div key={session} className="mo-card mo-live">
          <div
            className={`mo-livetext ${overflowing ? "overflowing" : ""}`}
            ref={capRef}
            onScroll={handleStreamScroll}
          >
            <p>
              {loadingNotice && (
                <span className="mo-muted">{t("overlay.loadingModel")}</span>
              )}
              {noticeText && <span className="mo-muted">{noticeText}</span>}
              {streamText.committed ? `${streamText.committed} ` : ""}
              <span className="mo-tentative">{streamText.tentative}</span>
              {!liveWorking && !loadingNotice && !liveNotice && (
                <span className="scaret" />
              )}
            </p>
          </div>
        </div>
      );
    }
  }

  return (
    <div
      dir={direction}
      className={`ov-stage ${position} ov-fade ${isVisible ? "show" : ""}`}
    >
      <div className="mo mo-stack">
        {liveCard}
        {pill}
      </div>
    </div>
  );
};

export default RecordingOverlay;
