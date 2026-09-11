"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  IPhoneFrame,
  type TitaniumFinish,
  type DisplayMode,
  type DeviceOrientation,
} from "./iphone-frame";
import { injectDemoData } from "./emulator-demo-data";

export interface EmulatorWorkbenchProps {
  readonly onExitToDirectView?: () => void;
}

export function EmulatorWorkbench({ onExitToDirectView }: EmulatorWorkbenchProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("standalone");
  const [finish, setFinish] = useState<TitaniumFinish>("natural");
  const [orientation, setOrientation] = useState<DeviceOrientation>("portrait");
  const [scalePreset, setScalePreset] = useState<"fit" | "100" | "85" | "75">("fit");
  const [calculatedScale, setCalculatedScale] = useState(1);
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [islandMessage, setIslandMessage] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show auto-dismiss toast notification
  const showToast = useCallback((msg: string, dynamicIslandText?: string) => {
    setToastMessage(msg);
    if (dynamicIslandText) setIslandMessage(dynamicIslandText);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Compute adaptive scale when "fit" is active or window resizes
  useEffect(() => {
    const handleResize = () => {
      if (scalePreset !== "fit") {
        if (scalePreset === "100") setCalculatedScale(1);
        else if (scalePreset === "85") setCalculatedScale(0.85);
        else if (scalePreset === "75") setCalculatedScale(0.75);
        return;
      }

      if (!containerRef.current) return;
      const containerHeight = containerRef.current.clientHeight - 40;
      const containerWidth = containerRef.current.clientWidth - 40;

      const deviceHeight = orientation === "portrait" ? 920 : 450;
      const deviceWidth = orientation === "portrait" ? 440 : 920;

      const scaleH = containerHeight / deviceHeight;
      const scaleW = containerWidth / deviceWidth;
      const fit = Math.min(1, Math.min(scaleH, scaleW) * 0.96);
      setCalculatedScale(Math.max(0.45, Number(fit.toFixed(2))));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [scalePreset, orientation]);

  // Reload the embedded web app iframe
  const handleReload = () => {
    if (iframeRef.current) {
      iframeRef.current.src = "/?view=app&t=" + Date.now();
      showToast("Web app reloaded");
    }
  };

  // Seed Demo Data into localStorage and refresh
  const handleSeedData = () => {
    const ok = injectDemoData();
    if (ok) {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.location.reload();
      }
      showToast("Demo progression state seeded! Level 7, quests, and habits active.", "⭐ Demo Data Loaded");
    } else {
      showToast("Failed to seed demo data.");
    }
  };

  // Quick Level Up (+100 XP)
  const handleQuickAddXp = () => {
    try {
      const raw = localStorage.getItem("personal_app:state");
      if (raw) {
        const envelope = JSON.parse(raw);
        const targetState = envelope?.state || envelope?.payload;
        if (targetState?.progression) {
          targetState.progression.totalXp = (targetState.progression.totalXp || 0) + 100;
          localStorage.setItem("personal_app:state", JSON.stringify(envelope));
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.location.reload();
          }
          showToast("+100 XP added to character progression!", "⚔️ +100 XP Granted");
          return;
        }
      }
      showToast("Seed demo data first to test XP gain.");
    } catch {
      showToast("Error updating storage.");
    }
  };

  // Reset / Clear Local Storage
  const handleClearStorage = () => {
    if (window.confirm("Clear local-first app storage to test fresh onboarding?")) {
      localStorage.removeItem("personal_app:state");
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.location.reload();
      }
      showToast("Storage cleared. Fresh state initialized.", "🔄 Fresh State");
    }
  };

  return (
    <div className="emulator-workbench-container">
      {/* Workbench Header & Control Bar */}
      <header className="emulator-toolbar">
        {/* Device Brand & Title */}
        <div className="toolbar-brand-group">
          <div className="toolbar-brand-title">
            <span className="apple-logo-icon"></span>
            <span className="brand-text">iPhone 17 Pro Studio</span>
          </div>
          <div className="toolbar-badges">
            <span className="toolbar-badge active">iOS 18 Web App</span>
            <span className="toolbar-badge specs">402 × 874 pt</span>
          </div>
        </div>

        {/* Display Mode Selector */}
        <div className="toolbar-control-section" aria-label="Web App Display Mode">
          <span className="control-section-label">Mode:</span>
          <div className="pill-group">
            <button
              type="button"
              className={`pill-btn ${displayMode === "standalone" ? "active" : ""}`}
              onClick={() => {
                setDisplayMode("standalone");
                showToast("Switched to Standalone PWA (Home Screen) mode");
              }}
              title="iOS Standalone Home Screen Web App"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="3" rx="4" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>Standalone PWA</span>
            </button>

            <button
              type="button"
              className={`pill-btn ${displayMode === "safari" ? "active" : ""}`}
              onClick={() => {
                setDisplayMode("safari");
                showToast("Switched to Mobile Safari browser mode");
              }}
              title="Mobile Safari Browser with address bar and navigation"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              <span>Safari Browser</span>
            </button>
          </div>
        </div>

        {/* Device Finish Colorways */}
        <div className="toolbar-control-section" aria-label="Titanium Finish">
          <span className="control-section-label">Titanium:</span>
          <div className="finish-color-picker">
            <button
              type="button"
              className={`finish-dot natural ${finish === "natural" ? "active" : ""}`}
              onClick={() => setFinish("natural")}
              title="Natural Titanium"
              aria-label="Natural Titanium finish"
            />
            <button
              type="button"
              className={`finish-dot black ${finish === "black" ? "active" : ""}`}
              onClick={() => setFinish("black")}
              title="Black Titanium"
              aria-label="Black Titanium finish"
            />
            <button
              type="button"
              className={`finish-dot desert ${finish === "desert" ? "active" : ""}`}
              onClick={() => setFinish("desert")}
              title="Desert Titanium"
              aria-label="Desert Titanium finish"
            />
            <button
              type="button"
              className={`finish-dot white ${finish === "white" ? "active" : ""}`}
              onClick={() => setFinish("white")}
              title="White Titanium"
              aria-label="White Titanium finish"
            />
          </div>
        </div>

        {/* Orientation & Scale */}
        <div className="toolbar-control-section">
          <button
            type="button"
            className="tool-btn icon-only"
            onClick={() => setOrientation(orientation === "portrait" ? "landscape" : "portrait")}
            title={`Rotate to ${orientation === "portrait" ? "Landscape" : "Portrait"}`}
            aria-label="Rotate Orientation"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>

          <div className="scale-selector">
            {(["fit", "100", "85", "75"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`scale-btn ${scalePreset === preset ? "active" : ""}`}
                onClick={() => setScalePreset(preset)}
              >
                {preset === "fit" ? "Fit" : `${preset}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Developer Action Controls */}
        <div className="toolbar-control-section dev-actions">
          {/* Safe Area Visualizer Toggle */}
          <button
            type="button"
            className={`tool-btn ${showSafeAreas ? "active-accent" : ""}`}
            onClick={() => setShowSafeAreas(!showSafeAreas)}
            title="Inspect Safe-Area-Inset Top (59px) and Bottom (34px)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18v18H3z" />
              <path d="M3 9h18" />
              <path d="M3 15h18" />
            </svg>
            <span>Safe Areas</span>
          </button>

          {/* Seed Demo Data Button */}
          <button
            type="button"
            className="tool-btn highlight"
            onClick={handleSeedData}
            title="Seed rich demo state (Level 7, active quests, streaks, WHOOP health)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Seed Demo Data</span>
          </button>

          {/* Quick Level Up (+100 XP) */}
          <button
            type="button"
            className="tool-btn"
            onClick={handleQuickAddXp}
            title="Add +100 XP to verify leveling formulas and progression HUD"
          >
            <span>+100 XP</span>
          </button>

          {/* Reload Embedded App */}
          <button
            type="button"
            className="tool-btn icon-only"
            onClick={handleReload}
            title="Reload App"
            aria-label="Reload App"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>

          {/* Clear Storage */}
          <button
            type="button"
            className="tool-btn danger"
            onClick={handleClearStorage}
            title="Clear all localStorage data"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            </svg>
            <span>Clear</span>
          </button>

          {/* Computer / Desktop View Switcher */}
          {onExitToDirectView && (
            <button
              type="button"
              className="tool-btn exit-btn"
              onClick={onExitToDirectView}
              title="Switch to Computer / Desktop View (Press Esc or top bar to return anytime)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Computer View</span>
            </button>
          )}
        </div>
      </header>

      {/* Floating Status Toast */}
      {toastMessage && (
        <div className="emulator-toast-notice" role="status" aria-live="polite">
          <span className="toast-dot" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Device Emulation Stage / Viewport Container */}
      <main className="emulator-stage" ref={containerRef}>
        <div className="emulator-stage-background-glow" />

        <IPhoneFrame
          finish={finish}
          displayMode={displayMode}
          orientation={orientation}
          scale={calculatedScale}
          showSafeAreas={showSafeAreas}
          onReload={handleReload}
          activeStatusMessage={islandMessage ?? undefined}
        >
          {/* Embedded Web App with true 402 × 874 logical boundaries */}
          <iframe
            ref={iframeRef}
            src="/?view=app"
            title="Personal Progression App - iPhone 17 Pro Web App"
            className="emulator-app-iframe"
          />
        </IPhoneFrame>
      </main>

      {/* Footer Status Bar */}
      <footer className="emulator-footer">
        <div className="footer-item">
          <span className="footer-label">Device:</span>
          <span className="footer-val">iPhone 17 Pro (6.3″ Super Retina XDR)</span>
        </div>
        <div className="footer-item">
          <span className="footer-label">Viewport:</span>
          <span className="footer-val">
            {orientation === "portrait" ? "402 × 874 pt" : "874 × 402 pt"}
          </span>
        </div>
        <div className="footer-item">
          <span className="footer-label">Safe Areas:</span>
          <span className="footer-val">Top 59px • Bottom 34px</span>
        </div>
        <div className="footer-item">
          <span className="footer-label">Zoom Scale:</span>
          <span className="footer-val">{Math.round(calculatedScale * 100)}%</span>
        </div>
        <div className="footer-item push-right">
          <span className="footer-val text-dim">Pre-commit visual verification environment</span>
        </div>
      </footer>
    </div>
  );
}
