"use client";

import React, { useState, useEffect } from "react";
import { SafariBottomBar } from "./safari-chrome";

export type TitaniumFinish = "natural" | "black" | "desert" | "white";
export type DisplayMode = "standalone" | "safari";
export type DeviceOrientation = "portrait" | "landscape";

export interface IPhoneFrameProps {
  readonly children: React.ReactNode;
  readonly finish?: TitaniumFinish;
  readonly displayMode?: DisplayMode;
  readonly orientation?: DeviceOrientation;
  readonly scale?: number;
  readonly showSafeAreas?: boolean;
  readonly onReload?: () => void;
  readonly activeStatusMessage?: string;
}

export function IPhoneFrame({
  children,
  finish = "natural",
  displayMode = "standalone",
  orientation = "portrait",
  scale = 1,
  showSafeAreas = false,
  onReload,
  activeStatusMessage,
}: IPhoneFrameProps) {
  // Live iOS Status Bar Clock
  const [currentTime, setCurrentTime] = useState("9:41");
  const [islandExpanded, setIslandExpanded] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      // Format as 12-hour or 24-hour style e.g. "11:22" or "9:41"
      const formatted = `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")}`;
      setCurrentTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const isLandscape = orientation === "landscape";

  return (
    <div
      className="iphone-frame-wrapper"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {/* Outer Titanium Chassis */}
      <div
        className={`iphone-chassis finish-${finish} ${isLandscape ? "orientation-landscape" : "orientation-portrait"}`}
      >
        {/* Hardware Buttons on Chassis */}
        <div className="btn-action-button" title="Action Button" />
        <div className="btn-volume-up" title="Volume Up" />
        <div className="btn-volume-down" title="Volume Down" />
        <div className="btn-side-power" title="Side / Power Button" />
        <div className="btn-camera-control" title="Camera Control" />

        {/* Ear Speaker Micro-Slit */}
        <div className="ear-speaker-slit" />

        {/* Screen Display Container (OLED Bezel) */}
        <div className="iphone-screen">
          {/* Dynamic Island */}
          <div
            className={`dynamic-island ${islandExpanded ? "expanded" : ""}`}
            onClick={() => setIslandExpanded(!islandExpanded)}
            title="Dynamic Island (Click to expand Live Activity)"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setIslandExpanded(!islandExpanded);
            }}
          >
            {islandExpanded ? (
              <div className="island-expanded-content">
                <div className="island-app-badge">
                  <span className="island-dot" />
                  <span>Personal Progression App</span>
                </div>
                <div className="island-status-pill">
                  {activeStatusMessage || "⚡ System Active • Level 7"}
                </div>
              </div>
            ) : (
              <div className="island-compact-content">
                <div className="island-camera-lens">
                  <div className="lens-reflection" />
                </div>
                <div className="island-truedepth-sensor" />
              </div>
            )}
          </div>

          {/* iOS 18/19 Status Bar */}
          <div className="ios-status-bar" aria-hidden="true">
            {/* Left: Current Time */}
            <div className="status-bar-left">
              <span className="status-time">{currentTime}</span>
            </div>

            {/* Right: Cellular, 5G, Wi-Fi, Battery */}
            <div className="status-bar-right">
              {/* Cellular 4-bars */}
              <svg width="17" height="12" viewBox="0 0 17 12" fill="none" className="status-icon">
                <rect x="0" y="8" width="2.5" height="4" rx="0.6" fill="currentColor" />
                <rect x="4.5" y="6" width="2.5" height="6" rx="0.6" fill="currentColor" />
                <rect x="9" y="3" width="2.5" height="9" rx="0.6" fill="currentColor" />
                <rect x="13.5" y="0" width="2.5" height="12" rx="0.6" fill="currentColor" />
              </svg>

              {/* 5G Badge */}
              <span className="status-5g-badge">5G</span>

              {/* Wi-Fi Icon */}
              <svg width="15" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="status-icon">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
              </svg>

              {/* Battery Meter */}
              <div className="status-battery-container">
                <span className="battery-pct-text">94</span>
                <div className="status-battery-shell">
                  <div className="battery-level-fill" style={{ width: "94%" }} />
                </div>
                <div className="battery-terminal-bump" />
              </div>
            </div>
          </div>

          {/* Safe Area Debug Inset Visualizer */}
          {showSafeAreas && (
            <div className="safe-area-overlay" aria-hidden="true">
              <div className="safe-area-top-guide">
                <span className="safe-area-tag">safe-area-top: 59px (Dynamic Island)</span>
              </div>
              <div className="safe-area-bottom-guide">
                <span className="safe-area-tag">safe-area-bottom: 34px (Home Indicator)</span>
              </div>
            </div>
          )}

          {/* Inner Content Viewport */}
          <div className={`iphone-viewport-content ${displayMode === "safari" ? "with-safari-chrome" : ""}`}>
            {children}
          </div>

          {/* Safari Bottom Bar (if Safari mode active) */}
          {displayMode === "safari" && <SafariBottomBar onReload={onReload} />}

          {/* iOS Home Indicator */}
          <div className="ios-home-indicator-container" aria-hidden="true">
            <div className="ios-home-indicator-bar" />
          </div>
        </div>
      </div>
    </div>
  );
}
