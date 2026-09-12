"use client";

/**
 * Study Timer Component
 *
 * Mobile-first iPhone interface with near-black and electric-blue aesthetic.
 * All countdowns are derived from absolute UTC timestamps. State updates
 * and completions are announced politely without ticking noise.
 */

import { useState, useEffect, useId, useCallback } from "react";
import type {
  AppState,
  StudyTimerDurationMinutes,
  StudyTimerActionResult,
  CompletedStudySessionSummary,
} from "@/domain/types";
import {
  getDerivedTimerState,
  formatTimeRemaining,
  FOCUS_DURATION_PRESETS,
} from "@/domain/study-timer";
import { nowUtc } from "@/domain/date-time";

/* ------------------------------------------------------------------ */
/* Accessible Inline SVGs                                             */
/* ------------------------------------------------------------------ */

function PlayIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" fillOpacity="0.25" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function DismissIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export interface StudyTimerProps {
  readonly state: AppState | null;
  readonly startTimer: (durationMinutes: StudyTimerDurationMinutes) => StudyTimerActionResult;
  readonly pauseTimer: () => StudyTimerActionResult;
  readonly resumeTimer: () => StudyTimerActionResult;
  readonly cancelTimer: () => StudyTimerActionResult;
  readonly reconcileTimer: () => CompletedStudySessionSummary | null;
  readonly lastCompletedSession: CompletedStudySessionSummary | null;
  readonly clearCompletionSummary: () => void;
}

export function StudyTimer({
  state,
  startTimer,
  pauseTimer,
  resumeTimer,
  cancelTimer,
  reconcileTimer,
  lastCompletedSession,
  clearCompletionSummary,
}: StudyTimerProps) {
  const [selectedDuration, setSelectedDuration] =
    useState<StudyTimerDurationMinutes>(
      state?.studyTimer.durationMinutes ?? 25
    );

  const [announcement, setAnnouncement] = useState<string>("");
  const timerTitleId = useId();

  const timerState = state?.studyTimer;
  const status = timerState?.status ?? "idle";

  // Compute derived elapsed & remaining ms from absolute timestamps
  const [currentDisplayRemainingMs, setCurrentDisplayRemainingMs] =
    useState<number>(() => {
      if (!timerState) return selectedDuration * 60 * 1000;
      const derived = getDerivedTimerState(timerState, nowUtc());
      return status === "idle" ? selectedDuration * 60 * 1000 : derived.remainingMs;
    });

  const [currentProgressRatio, setCurrentProgressRatio] = useState<number>(() => {
    if (!timerState || status === "idle") return 0;
    return getDerivedTimerState(timerState, nowUtc()).progressRatio;
  });

  // Local ticker: only updates display every 500ms; never writes to localStorage
  const updateDisplayFromTimestamps = useCallback(() => {
    if (!timerState) return;

    if (timerState.status === "idle") {
      setCurrentDisplayRemainingMs(selectedDuration * 60 * 1000);
      setCurrentProgressRatio(0);
      return;
    }

    const derived = getDerivedTimerState(timerState, nowUtc());

    if (derived.isCompleted && timerState.status === "running") {
      // Reconcile and complete the session via store
      reconcileTimer();
    } else {
      setCurrentDisplayRemainingMs(derived.remainingMs);
      setCurrentProgressRatio(derived.progressRatio);
    }
  }, [timerState, selectedDuration, reconcileTimer]);

  useEffect(() => {
    updateDisplayFromTimestamps();

    if (status === "running") {
      const interval = setInterval(updateDisplayFromTimestamps, 500);
      return () => clearInterval(interval);
    }
  }, [status, updateDisplayFromTimestamps]);

  // Sync selectedDuration if timer in state has a different duration while idle
  useEffect(() => {
    if (timerState && timerState.status === "idle") {
      setSelectedDuration(timerState.durationMinutes);
    }
  }, [timerState]);

  // Announce completions politely to assistive technologies
  useEffect(() => {
    if (lastCompletedSession) {
      setAnnouncement(
        `Study session complete: ${lastCompletedSession.durationMinutes} minutes. Earned ${lastCompletedSession.xpEarned} XP and ${lastCompletedSession.srEarned} Season Rank points.`
      );
    }
  }, [lastCompletedSession]);

  if (!state || !timerState) {
    return null;
  }

  const focusSrEarnedToday = state.seasonRank.dailyCaps.focusSrEarned;
  const numBlocks = Math.floor(
    (status === "idle" ? selectedDuration : timerState.durationMinutes) / 25
  );

  const handleStart = () => {
    clearCompletionSummary();
    const result = startTimer(selectedDuration);
    if (result === "normal") {
      setAnnouncement(`Study session started: ${selectedDuration} minutes.`);
    }
  };

  const handlePause = () => {
    const result = pauseTimer();
    if (result === "normal") {
      setAnnouncement("Study session paused.");
    }
  };

  const handleResume = () => {
    const result = resumeTimer();
    if (result === "normal") {
      setAnnouncement("Study session resumed.");
    }
  };

  const handleCancel = () => {
    const result = cancelTimer();
    if (result === "normal") {
      setAnnouncement("Study session cancelled. No rewards awarded.");
    }
  };

  const handleSelectPreset = (preset: StudyTimerDurationMinutes) => {
    if (status !== "idle") return;
    setSelectedDuration(preset);
    setCurrentDisplayRemainingMs(preset * 60 * 1000);
    setCurrentProgressRatio(0);
    setAnnouncement(`Selected ${preset} minute preset.`);
  };

  const displayTime = formatTimeRemaining(currentDisplayRemainingMs);

  return (
    <section
      className="study-timer-card"
      aria-labelledby={timerTitleId}
      aria-label="Study Timer"
    >
      {/* Polite Screen Reader Live Region for status/completion announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Card Header & Status */}
      <div className="study-timer-header">
        <div className="study-timer-title-wrap">
          <ClockIcon />
          <h2 id={timerTitleId} className="study-timer-title">
            Focus Timer
          </h2>
        </div>
        <div className="study-timer-status-badge">
          {status === "idle" && <span className="timer-badge-idle">Ready</span>}
          {status === "running" && (
            <span className="timer-badge-running">
              <span className="timer-pulse-dot" aria-hidden="true" /> Active
            </span>
          )}
          {status === "paused" && (
            <span className="timer-badge-paused">Paused</span>
          )}
        </div>
      </div>

      {/* Completion Notification Banner */}
      {lastCompletedSession && (
        <div
          className="timer-completion-banner"
          role="region"
          aria-label="Recent Session Rewards"
        >
          <div className="completion-banner-left">
            <span className="completion-check-icon">
              <CheckIcon />
            </span>
            <div className="completion-banner-info">
              <div className="completion-banner-title">
                Session Complete · {lastCompletedSession.durationMinutes} min
              </div>
              <div className="completion-banner-meta">
                <span className="reward-pill">
                  +{lastCompletedSession.xpEarned} XP
                </span>
                <span className="sr-pill">
                  +{lastCompletedSession.srEarned} SR
                </span>
                <span className="stat-pill">
                  +{lastCompletedSession.statDeltas.discipline} Dis
                </span>
                <span className="stat-pill">
                  +{lastCompletedSession.statDeltas.knowledge} Know
                </span>
                <span className="stat-pill">
                  +{lastCompletedSession.statDeltas.focus} Focus
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="completion-dismiss-btn"
            onClick={clearCompletionSummary}
            aria-label="Dismiss completion message"
          >
            <DismissIcon />
          </button>
        </div>
      )}

      {/* Prominent MM:SS Display with Progress Indicator */}
      <div className="timer-main-display">
        <div className="timer-countdown" aria-label={`Time remaining: ${displayTime}`}>
          {displayTime}
        </div>
        <div className="timer-session-descriptor">
          {status === "idle" && (
            <span>
              {selectedDuration} min session ({numBlocks}{" "}
              {numBlocks === 1 ? "block" : "blocks"})
            </span>
          )}
          {status === "running" && (
            <span>
              In flow · {numBlocks} 25m {numBlocks === 1 ? "block" : "blocks"}
            </span>
          )}
          {status === "paused" && <span>Session paused · Tap resume to continue</span>}
        </div>

        {/* Linear progress track */}
        <div
          className="timer-progress-track"
          role="progressbar"
          aria-valuenow={Math.round(currentProgressRatio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Session elapsed progress"
        >
          <div
            className="timer-progress-bar"
            style={{ width: `${Math.max(0, Math.min(100, currentProgressRatio * 100))}%` }}
          />
        </div>
      </div>

      {/* Duration Preset Selector (Selectable while Idle Only) */}
      <div className="timer-preset-group" role="group" aria-label="Duration presets">
        {FOCUS_DURATION_PRESETS.map((preset) => {
          const isSelected = selectedDuration === preset;
          const isDisabled = status !== "idle";
          return (
            <button
              key={preset}
              type="button"
              className={`timer-preset-btn ${isSelected ? "selected" : ""}`}
              onClick={() => handleSelectPreset(preset)}
              disabled={isDisabled}
              aria-pressed={status === "idle" ? isSelected : undefined}
              aria-label={`${preset} minutes focus session`}
            >
              <span className="preset-minutes">{preset}m</span>
              <span className="preset-blocks">
                {preset / 25} {preset === 25 ? "block" : "blocks"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timer Controls (State-dependent) */}
      <div className="timer-controls-row">
        {status === "idle" && (
          <button
            type="button"
            className="btn-timer-primary"
            onClick={handleStart}
            aria-label={`Start ${selectedDuration} minute focus session`}
          >
            <PlayIcon />
            <span>Start Focus Session</span>
          </button>
        )}

        {status === "running" && (
          <div className="timer-button-group">
            <button
              type="button"
              className="btn-timer-action"
              onClick={handlePause}
              aria-label="Pause focus session"
            >
              <PauseIcon />
              <span>Pause</span>
            </button>
            <button
              type="button"
              className="btn-timer-danger"
              onClick={handleCancel}
              aria-label="Cancel focus session without rewards"
            >
              <CancelIcon />
              <span>Cancel</span>
            </button>
          </div>
        )}

        {status === "paused" && (
          <div className="timer-button-group">
            <button
              type="button"
              className="btn-timer-primary"
              onClick={handleResume}
              aria-label="Resume focus session"
            >
              <PlayIcon />
              <span>Resume</span>
            </button>
            <button
              type="button"
              className="btn-timer-danger"
              onClick={handleCancel}
              aria-label="Cancel focus session without rewards"
            >
              <CancelIcon />
              <span>Cancel</span>
            </button>
          </div>
        )}
      </div>

      {/* Ranked & Rewards Context Strip */}
      <div className="timer-ranked-context">
        <div className="context-text">
          +10 SR per completed 25-minute block · 40 SR daily cap
        </div>
        <div className="context-daily-meter">
          <span>Today: {focusSrEarnedToday} / 40 SR</span>
        </div>
      </div>
    </section>
  );
}
