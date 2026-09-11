"use client";

import React from "react";

export interface SafariChromeProps {
  readonly url?: string;
  readonly onReload?: () => void;
}

export function SafariBottomBar({
  url = "personal-progression.app",
  onReload,
}: SafariChromeProps) {
  return (
    <div className="safari-bottom-bar" role="region" aria-label="Safari Browser Controls">
      {/* Safari Address Bar Pill */}
      <div className="safari-address-pill">
        <button
          type="button"
          className="safari-btn-icon"
          aria-label="Font and Reader Controls"
          title="Reader View & Text Options"
        >
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "-0.5px" }}>AA</span>
        </button>

        <div className="safari-url-display">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ opacity: 0.75, flexShrink: 0 }}
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="safari-url-text">{url}</span>
        </div>

        <button
          type="button"
          className="safari-btn-icon"
          onClick={onReload}
          aria-label="Reload Page"
          title="Reload Page"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
        </button>
      </div>

      {/* Safari Bottom Navigation Icons */}
      <div className="safari-nav-row">
        {/* Back */}
        <button type="button" className="safari-toolbar-btn" aria-label="Back" disabled>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Forward */}
        <button type="button" className="safari-toolbar-btn" aria-label="Forward" disabled>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {/* Share */}
        <button type="button" className="safari-toolbar-btn" aria-label="Share">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>

        {/* Bookmarks */}
        <button type="button" className="safari-toolbar-btn" aria-label="Bookmarks">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
        </button>

        {/* Tabs */}
        <button type="button" className="safari-toolbar-btn" aria-label="Open Tabs">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="13" height="13" x="8" y="3" rx="2" />
            <path d="M5 8H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
