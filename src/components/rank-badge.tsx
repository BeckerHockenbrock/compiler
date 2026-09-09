"use client";

import React from "react";
import type { RankTier, RankDivision } from "@/domain/types";
import { RANK_MATERIALS } from "@/domain/season-rank";

export interface RankBadgeProps {
  readonly tier: RankTier;
  readonly division?: RankDivision | null;
  readonly size?: number;
  readonly showDivision?: boolean;
  readonly glow?: boolean;
  readonly className?: string;
}

/* ------------------------------------------------------------------ */
/* Tier-Specific Vector Geometry                                      */
/* ------------------------------------------------------------------ */

function RecruitIcon({ color }: { color: string }) {
  return (
    <g>
      {/* Outer Diamond */}
      <polygon
        points="50,10 88,50 50,90 12,50"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Inner Accent Diamond */}
      <polygon
        points="50,26 74,50 50,74 26,50"
        fill="rgba(148, 163, 184, 0.12)"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeDasharray="4 2"
      />
      {/* Center Core Dot */}
      <circle cx="50" cy="50" r="3" fill={color} />
    </g>
  );
}

function BronzeIcon({ color }: { color: string }) {
  return (
    <g>
      {/* Shield Outline */}
      <path
        d="M22 18 L78 18 L78 48 C78 70 50 88 50 88 C50 88 22 70 22 48 Z"
        fill="rgba(205, 127, 50, 0.12)"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Single Chevron */}
      <polyline
        points="34,42 50,56 66,42"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="30" r="3" fill={color} />
    </g>
  );
}

function SilverIcon({ color }: { color: string }) {
  return (
    <g>
      {/* Shield Outline */}
      <path
        d="M22 18 L78 18 L78 48 C78 70 50 88 50 88 C50 88 22 70 22 48 Z"
        fill="rgba(203, 213, 225, 0.12)"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Top Chevron */}
      <polyline
        points="34,36 50,48 66,36"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom Chevron */}
      <polyline
        points="34,50 50,62 66,50"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function GoldIcon({ color }: { color: string }) {
  return (
    <g>
      {/* Hexagonal Base */}
      <polygon
        points="50,22 82,38 82,72 50,88 18,72 18,38"
        fill="rgba(234, 179, 8, 0.12)"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Crown */}
      <path
        d="M32 64 L32 44 L41 52 L50 36 L59 52 L68 44 L68 64 Z"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="36" r="2.5" fill={color} />
      <circle cx="32" cy="44" r="2" fill={color} />
      <circle cx="68" cy="44" r="2" fill={color} />
    </g>
  );
}

function PlatinumIcon({ color }: { color: string }) {
  return (
    <g>
      {/* Split Crystal Left */}
      <polygon
        points="48,12 24,46 48,88 48,12"
        fill="rgba(56, 189, 248, 0.14)"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Split Crystal Right */}
      <polygon
        points="52,12 76,46 52,88 52,12"
        fill="rgba(56, 189, 248, 0.22)"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Internal Facet Accent */}
      <polyline
        points="24,46 48,50 76,46"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
    </g>
  );
}

function DiamondIcon({ color }: { color: string }) {
  return (
    <g>
      {/* Outer Faceted Diamond */}
      <polygon
        points="50,14 84,36 68,86 32,86 16,36"
        fill="rgba(129, 140, 248, 0.15)"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Table & Star Facets */}
      <polygon
        points="34,36 66,36 50,60"
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Upper Girdle Lines */}
      <line x1="50" y1="14" x2="34" y2="36" stroke={color} strokeWidth="1.5" />
      <line x1="50" y1="14" x2="66" y2="36" stroke={color} strokeWidth="1.5" />
      {/* Lower Pavilion Lines */}
      <line x1="34" y1="36" x2="32" y2="86" stroke={color} strokeWidth="1.5" />
      <line x1="66" y1="36" x2="68" y2="86" stroke={color} strokeWidth="1.5" />
      <line x1="50" y1="60" x2="50" y2="86" stroke={color} strokeWidth="2" />
    </g>
  );
}

function MasterIcon({ color }: { color: string }) {
  return (
    <g>
      {/* Left Wing */}
      <path
        d="M32 50 L10 32 L16 54 L8 44 L16 66 L34 60"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Wing */}
      <path
        d="M68 50 L90 32 L84 54 L92 44 L84 66 L66 60"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central Diamond */}
      <polygon
        points="50,22 66,50 50,78 34,50"
        fill="rgba(192, 132, 252, 0.22)"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Inner Diamond Core */}
      <polygon
        points="50,34 58,50 50,66 42,50"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <circle cx="50" cy="50" r="2.5" fill={color} />
    </g>
  );
}

function ApexIcon({ color }: { color: string }) {
  return (
    <g>
      {/* Atmospheric Electric Halo */}
      <ellipse
        cx="50"
        cy="26"
        rx="28"
        ry="8"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2.5"
        strokeDasharray="6 2"
        style={{ filter: "drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))" }}
      />
      {/* Five-Point Geometric Star */}
      <polygon
        points="50,22 57,40 76,40 61,52 66,70 50,58 34,70 39,52 24,40 43,40"
        fill="rgba(255, 255, 255, 0.2)"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 8px rgba(0, 144, 255, 0.6))" }}
      />
      {/* Radiant Star Core */}
      <circle cx="50" cy="48" r="4" fill="#ffffff" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Main Accessible Badge Component                                    */
/* ------------------------------------------------------------------ */

export function RankBadge({
  tier,
  division,
  size = 48,
  showDivision = true,
  glow = true,
  className = "",
}: RankBadgeProps) {
  const material = RANK_MATERIALS[tier] ?? RANK_MATERIALS.recruit;
  const isHighRank = tier === "master" || tier === "apex";
  const displayDivision = isHighRank ? null : division;

  const accessibleLabel = displayDivision
    ? `${material.name} ${tier.toUpperCase()} Division ${displayDivision}`
    : `${material.name} ${tier.toUpperCase()}`;

  const glowStyle = glow
    ? { filter: `drop-shadow(0 0 8px ${material.glowColor})` }
    : undefined;

  return (
    <div
      className={`rank-badge-wrapper ${className}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
      role="img"
      aria-label={accessibleLabel}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={glowStyle}
      >
        <title>{accessibleLabel}</title>
        {tier === "recruit" && <RecruitIcon color={material.primaryColor} />}
        {tier === "bronze" && <BronzeIcon color={material.primaryColor} />}
        {tier === "silver" && <SilverIcon color={material.primaryColor} />}
        {tier === "gold" && <GoldIcon color={material.primaryColor} />}
        {tier === "platinum" && <PlatinumIcon color={material.primaryColor} />}
        {tier === "diamond" && <DiamondIcon color={material.primaryColor} />}
        {tier === "master" && <MasterIcon color={material.primaryColor} />}
        {tier === "apex" && <ApexIcon color={material.primaryColor} />}
      </svg>

      {showDivision && displayDivision && (
        <span
          className="rank-badge-division-pill"
          style={{
            fontSize: `${Math.max(9, Math.round(size * 0.18))}px`,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: material.primaryColor,
            textShadow: `0 0 6px ${material.glowColor}`,
            marginTop: "-2px",
            lineHeight: 1,
          }}
        >
          {displayDivision}
        </span>
      )}
    </div>
  );
}
