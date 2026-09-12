# Technical Architecture

This document specifies the technical architecture, domain modeling principles, persistence strategy, deployment model, and future evolutionary path for the Personal Progression Web Application.

---

## 1. Architectural Philosophy & Non-Goals

### Core Philosophy
- **Client-First & Zero Server Runtime**: The application compiles to a purely static set of HTML, JavaScript, and CSS assets. All business logic, computations, and persistence happen directly in the user's browser.
- **Privacy & Ownership by Default**: All user data resides strictly within the user's browser storage. No server-side databases, authentication services, tracking telemetry, or cloud accounts are used.
- **Durability & Recovery**: Storage operations are guarded with schema validation (Zod), sequential in-memory migrations, non-destructive corrupt-data handling, and pre-import safety snapshots.
- **Decoupled Domain**: The business logic (progression curves, leveling mathematics, habit streaks, stat updates) has zero dependencies on React, Next.js, or DOM APIs, ensuring 100% testability in pure TypeScript.

### Explicit Non-Goals
1. **No Runtime Server Dependencies**: No Node.js server in production, no Next.js Server Actions, no Route Handlers (`/api/*`), and no Server-Side Rendering (SSR) data fetching (`getServerSideProps`, dynamic server rendering).
2. **No Centralized Authentication or Multi-Tenancy**: The application is single-user per browser instance. There are no logins, passwords, session tokens, or JWTs.
3. **No External Database or Managed Cloud Storage**: No PostgreSQL, MongoDB, Firebase, Supabase, or AWS DynamoDB.
4. **No Server-Side Secrets**: Because all code is bundled into client-side static assets, no private API keys, secrets, or administrative tokens exist in the repository or runtime bundle.

---

## 2. Directory Structure & Layer Responsibilities

```text
.
├── .github/
│   └── workflows/
│       └── ci.yml             # Continuous integration (typecheck, lint, test, static build)
├── src/
│   ├── app/                   # Next.js App Router (Static export shell)
│   │   ├── globals.css        # Theme variables, mobile-first responsive layout, and game HUD
│   │   ├── layout.tsx         # Root layout (viewport, title, static shell)
│   │   └── page.tsx           # Mobile-first dashboard (Quests, Rituals, Character, Vault)
│   ├── components/            # Reusable UI components
│   │   ├── rank-badge.tsx     # Accessible SVG rank tier badges
│   │   └── study-timer.tsx    # Mobile-first local study timer card
│   ├── domain/                # Pure domain layer (ZERO React/DOM/Storage dependencies)
│   │   ├── types.ts           # Core domain entity types & interfaces
│   │   ├── date-time.ts       # Strict ISO 8601 UTC & local calendar date logic
│   │   ├── progression.ts     # XP formulas, level curves, and reward state transitions
│   │   ├── season-rank.ts     # Monthly Ranked ladder, promotion trials, daily SR caps
│   │   ├── study-timer.ts     # Pure study timer logic, timestamp derivation, focus rewards
│   │   ├── streaks.ts         # Habit streak calculations evaluated on calendar days
│   │   ├── tasks.ts           # Pure task creation, update, deletion, and idempotent completion
│   │   ├── habits.ts          # Pure habit creation, deletion, and single daily check-in
│   │   ├── skills.ts          # Pure skill point allocation and linked attribute scaling
│   │   └── defaults.ts        # Initial seed state and default entities
│   ├── hooks/                 # React client integration
│   │   └── use-app-store.ts   # Client store linking StorageManager to UI with hydration safety
│   ├── storage/               # Persistence, validation, migration & backup layer
│   │   ├── types.ts           # StorageAdapter interface, StorageEnvelope, error types
│   │   ├── schema.ts          # Zod validation schemas & CURRENT_SCHEMA_VERSION = 3
│   │   ├── checksum.ts        # Fast FNV-1a checksum for accidental-corruption detection
│   │   ├── compaction.ts      # User-visible log retention & compaction (preserves aggregates)
│   │   ├── migrations/        # Sequential in-memory migration runner
│   │   │   ├── index.ts       # Migration registry (transitions added only on version bumps)
│   │   │   ├── v1-to-v2.ts    # Migration: attach Season Rank state
│   │   │   └── v2-to-v3.ts    # Migration: attach Study Timer state
│   │   ├── adapter.ts         # NamespacedLocalStorageAdapter (scoped keys, no localStorage.clear())
│   │   ├── backup.ts          # Safe in-memory backup export and import pipeline
│   │   └── storage-manager.ts # Storage coordinator, metric estimation, non-destructive recovery
│   └── lib/                   # Shared utility primitives
│       └── result.ts          # Type-safe Result<T, E> discriminated union
├── tests/                     # Vitest automated unit test suites
│   ├── domain/                # Tests for progression, date-time, streaks, tasks, habits, skills, study timer
│   └── storage/               # Tests for adapter, migrations, corrupt data, backup, compaction, persistence flow
├── ARCHITECTURE.md            # Architectural blueprint and specifications
├── README.md                  # Developer manual, backup runbook, and deployment guide
├── next.config.ts             # Next.js static export configuration (output: 'export')
├── tsconfig.json              # Strict TypeScript configuration
├── eslint.config.mjs          # ESLint 9 flat configuration (eslint .)
├── vitest.config.ts           # Vitest configuration
└── package.json               # Scripts (no next start), dependencies, lockfile
```

### Layer Boundaries
1. **Domain Layer (`src/domain`)**:
   - Contains pure functions and immutable data structures.
   - May never import from `src/storage`, `src/app`, React, or browser globals (`window`, `localStorage`, `document`).
   - Responsible for progression math, level thresholds, stat distributions, streak evaluations, and date boundaries.
2. **Storage Layer (`src/storage`)**:
   - Depends only on `src/domain` and `src/lib`.
   - Isolates all browser I/O behind the `StorageAdapter` interface.
   - Responsible for schema validation, serialization, error recovery, accidental-corruption checksumming, and backups.
3. **App Shell Layer (`src/app`)**:
   - Next.js static HTML/JS harness.
   - Minimal client entry point. Future UI feature modules will mount here.

---

## 3. Date, Time & Timezone Specifications

To prevent off-by-one streak calculation errors and cross-timezone bugs, the system enforces a strict date/time contract:

### Timestamps (Points in Time)
- **Format**: Strict ISO 8601 UTC string: `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g. `2026-09-08T18:20:00.000Z`).
- **Usage**: Used for `createdAt`, `updatedAt`, `completedAt`, `ActivityLog.timestamp`, and backup envelope metadata.
- **Comparison**: Evaluated strictly via Unix epoch milliseconds (`Date.parse()`).

### Calendar Dates (Wall-Clock Days)
- **Format**: Strict ISO 8601 calendar date: `YYYY-MM-DD` (e.g. `2026-09-08`).
- **Usage**: Used for task due dates, habit completion records, and streak evaluation.
- **Timezone Resolution**: Calendar dates are computed against the user's active local timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone` or configurable `settings.timeZone`).

### Streak Calculation Rules
A habit completion compares the target completion calendar date ($D_{now}$) with the habit's last completed date ($D_{last}$):
1. $\Delta = 0$ (Same Day): Habit is already credited for today. Streak count remains unchanged; completion count may increment.
2. $\Delta = 1$ (Consecutive Day): Streak extends ($Streak_{next} = Streak_{current} + 1$). Best streak updates if current exceeds it.
3. $\Delta > 1$ (Missed Days): Streak resets to 1. Best streak record is permanently preserved.

---

## 4. Persistence & Data Versioning Strategy

### Storage Key Namespacing & Banned Calls
- All application keys use the strict prefix: `personal_app:`.
- **Primary Active Key**: `personal_app:state` (stores the current envelope).
- **Pre-Import Backup Key**: `personal_app:backup:pre_import` (automatic snapshot saved before any backup restore).
- **Safety Rule**: `localStorage.clear()` is **strictly prohibited**. The adapter implements `clearAppKeys()`, which scans for and deletes only keys matching `personal_app:`, leaving foreign keys on the same origin completely untouched.

### Payload Envelope & Versioning
The schema version is carried **exclusively inside the envelope**, never in the storage key name:
```typescript
interface StorageEnvelope<T> {
  version: number;     // Currently 1
  updatedAt: string;   // ISO 8601 UTC
  state: T;            // Validated AppState
}
```
- `CURRENT_SCHEMA_VERSION = 3` is defined in `src/storage/schema.ts`.
- Migration files are introduced in `src/storage/migrations/` when a version transition (such as $1 \to 2$ or $2 \to 3$) occurs.

### Non-Destructive Corrupt State Handling
If `personal_app:state` contains malformed JSON, fails Zod validation, or references an unsupported version:
1. **Zero Data Destruction**: The system **never** overwrites `personal_app:state` and **never** creates automatic archive keys in `localStorage`.
2. **Structured Error**: `StorageManager.loadState()` returns a recoverable `CORRUPT_DATA` error containing the raw payload string.
3. **Manual Rescue**: The system exposes `getRawState()`, enabling the user to download the unparsed string for manual JSON correction.
4. **Explicit Reset**: Overwriting with defaults requires calling `resetToDefaults({ confirmReset: true })`, which demands explicit confirmation.

### Storage-Size Monitoring (Estimates)
- String character counts across namespaced keys are multiplied by 2 ($\text{chars} \times 2$) to produce an **estimated byte usage** metric (`estimatedBytesUsed`).
- **Important**: These measurements are explicitly documented and treated as approximations, not exact browser quota calculations, due to browser-specific indexing and internal storage overhead.
- An alert is raised when estimated usage approaches 4MB of the typical 5MB limit.

### User-Visible Log Retention & Compaction (Preserving Aggregates)
- **Independence of Aggregates**: Core progression data (`totalXp`, `level`, `availableSkillPoints`, `stats`, `skillLevels`, `lifetimeCompletedTasks`, `lifetimeHabitCompletions`, and habit streaks) are stored directly on the top-level `AppState`. They do not depend on the detailed `activityLogs` array.
- **Compaction Policy**: When log count exceeds `settings.maxLogRetention` (default: 500 entries), the system surfaces a retention notice.
- **Compaction Operation**: Trims older granular log records while preserving recent history and leaving all progression aggregates completely intact. No silent, invisible deletions occur.

### Safe Failure for Unavailable Browser Storage
If browser storage is disabled, blocked in an iframe, or throws a `SecurityError` (e.g. in restricted private browsing modes):
1. **No Silent In-Memory Fallback**: The adapter does not silently switch to temporary in-memory storage in production browsers, which would risk misleading the user into believing data is saved or masking existing data.
2. **Structured Error**: All storage operations return a structured `STORAGE_UNAVAILABLE` error through the standard `Result` contract.
3. **Data Protection**: Existing data stored on disk is never overwritten, reset, or masked.
4. **Test Isolation**: In-memory storage is retained exclusively as an explicitly injected dependency (`InMemoryStorageFallback`) for unit tests and isolated environments.

---


## 5. Backup & Restore Pipeline

### Accidental-Corruption Checksum
- Every exported backup file contains an FNV-1a 32-bit checksum of the serialized envelope:
  ```json
  {
    "app": "personal_progression_app",
    "formatVersion": 1,
    "exportedAt": "2026-09-08T18:20:00.000Z",
    "checksum": "a1b2c3d4",
    "envelope": { ... }
  }
  ```
- **Integrity, Not Cryptography**: The checksum exists solely to detect accidental file truncation, download interruptions, or copy-paste omissions. It is not an anti-tamper or security mechanism; users are free to inspect and edit their own JSON backups.

### Safe Import Protocol
1. **In-Memory Parsing**: Parse raw JSON string.
2. **Checksum Verification**: Compute FNV-1a checksum and ensure it matches envelope content.
3. **In-Memory Migration & Validation**: If envelope version is older than `CURRENT_SCHEMA_VERSION`, run sequential migrations in memory; validate final output against current Zod schema.
4. **Confirmation Gate**: Verify `confirmOverwrite: true`.
5. **Pre-Import Safety Snapshot**: Copy active `personal_app:state` to `personal_app:backup:pre_import`.
6. **Atomic Overwrite**: Write migrated state to `personal_app:state`. If any prior step fails, storage remains completely unmodified.

---

## 6. Storage Isolation: Origins vs. Devices

It is critical to distinguish between the two separate dimensions of storage isolation:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Web Security Origin Isolation (Same Device, Same Browser)                │
│                                                                             │
│  http://localhost:3000   https://app.vercel.app   https://app-pr-4.vercel.app │
│  ┌────────────────────┐  ┌────────────────────┐   ┌─────────────────────────┐ │
│  │ localStorage (Dev) │  │ localStorage (Prod)│   │ localStorage (Preview)  │ │
│  └────────────────────┘  └────────────────────┘   └─────────────────────────┘ │
│                                                                             │
│  Isolated by browser security sandbox (protocol + host + port).             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Physical Device & Browser Separation (Same Origin: https://app.vercel.app)│
│                                                                             │
│  MacBook Pro (Chrome)       iPhone (Safari)          Windows PC (Firefox)   │
│  ┌────────────────────┐  ┌────────────────────┐   ┌─────────────────────────┐ │
│  │ Local Hardware DB  │  │ Local Hardware DB  │   │ Local Hardware DB       │ │
│  └────────────────────┘  └────────────────────┘   └─────────────────────────┘ │
│                                                                             │
│  Isolated by distinct physical hardware storage and browser profile silos.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Web Security Origin Isolation**:
   Within the same browser on the same device, `localStorage` is segregated by exact origin (`protocol://domain:port`).
   - `http://localhost:3000` cannot see data from `https://app.vercel.app`.
   - A Vercel preview deployment (`https://app-git-feature.vercel.app`) cannot see data from the production deployment (`https://app.vercel.app`).
2. **Physical Device & Profile Separation**:
   Even when navigating to the exact same production URL (`https://app.vercel.app`), iPhone Safari, desktop Chrome, and desktop Firefox each store data in their own distinct local storage database.
3. **Data Portability**:
   Moving data between origins or devices currently requires exporting a JSON backup from the source and importing it into the destination.

---

## 7. Zero Server-Runtime Static Deployment Strategy

### Vercel Deployment Model
- The application uses Next.js static export:
  ```typescript
  // next.config.ts
  const nextConfig: NextConfig = {
    output: "export",
    images: { unoptimized: true },
  };
  ```
- Running `npm run build` compiles static HTML, CSS, and JS into `./out`.
- There is no `next start` command because no Node.js server exists or is needed in production.
- **GitHub Integration**:
  - Pushes to `main` automatically deploy to the Vercel Production environment.
  - Pull requests or feature branches automatically generate Vercel Preview deployments.
  - Zero paid integrations, external databases, or serverless functions are required.

### Framework Versioning Policy
> [!NOTE]
> The project currently pins Next.js to major version 15 (`15.x`). A future, deliberate Next.js major-version upgrade should be evaluated separately once new features, API stability, and static export parity are benchmarked.

---

## 8. Evolutionary Path: Optional Future Cross-Device Sync

Because all storage operations are abstracted behind the `StorageAdapter` interface, adding synchronization in a future phase will **not require rewriting any domain logic or React components**.

Possible non-invasive sync paths:
1. **User-Owned Remote Storage (WebDAV / RemoteStorage)**:
   - Implement a `WebDavStorageAdapter` or `RemoteStorageAdapter` implementing `StorageAdapter`.
   - User provides their own Nextcloud, OwnCloud, or WebDAV endpoint credentials stored locally.
2. **Conflict-Free Replicated Data Types (CRDTs / Yjs)**:
   - Convert `AppState` updates into an event stream or CRDT document.
   - Synchronize peer-to-peer over WebRTC or an encrypted relay server where the server cannot decrypt user data.
3. **Encrypted Cloud Drive (Google Drive / iCloud / Dropbox)**:
   - Client-side OAuth to user's personal cloud storage.
   - App stores an encrypted `personal_app_backup.json` file in the user's private app folder.

---

## 9. Future Wearable & Health Integration Architecture (WHOOP)

The application includes a provider-agnostic domain layer (`src/domain/health.ts`) establishing normalized contracts for physiological data: recovery, sleep, cycle strain, and workouts.

### Strict Credential & Secret Isolation Policy
- **Zero Client Leakage**: WHOOP client secrets, authorization codes, access tokens, refresh tokens, and webhook signature secrets **must never be committed to repository code, exposed in public environment variables (`NEXT_PUBLIC_*`), or stored in browser `localStorage`**.
- **No Direct Browser-to-WHOOP OAuth**: The WHOOP OAuth 2.0 Authorization Code flow requires client secret exchange (`POST https://api.prod.whoop.com/oauth/oauth2/token`). Performing this in a static client would expose the client secret to anyone inspecting network traffic or application bundle scripts.

### Backend Evolution & Migration Paths
The current architecture remains a purely static export (`output: "export"`). When live wearable integration is ready to ship, the project will evaluate two secure architectural options:
1. **Full-Stack Next.js with Server Middleware**:
   - Migrate `next.config.ts` from static export to standard Vercel server runtime with Route Handlers (`/api/auth/whoop/callback`, `/api/health/sync`).
   - Pair with an encrypted server-side store (e.g. Vercel KV, Supabase, or PostgreSQL) storing user tokens encrypted with AES-256-GCM.
2. **Dedicated Micro-Service / Token Relay**:
   - Keep the static frontend export intact and deploy a lightweight, isolated authentication and token-refresh proxy (e.g. Cloudflare Worker or AWS Lambda) that mediates OAuth exchanges.
   - **No Token Transmission to Browser**: The relay must **never** return WHOOP bearer tokens (access or refresh) to the browser, even in encrypted form. All WHOOP tokens stay strictly server-side.
   - **App-Owned Session Cookies**: The server establishes authentication via an app-owned, `HttpOnly`, `Secure`, `SameSite=Strict` session cookie.
   - **Sanitized Data Only**: Client endpoints return only sanitized, normalized health data (`HealthSnapshot`), never third-party credentials.

### Minimum Required Scopes & Scope Discipline
The initial health domain contract is intentionally a focused, high-value core slice (`recovery`, `sleep`, `strain`, `workouts`). It does not yet represent all available WHOOP data resources, such as user profile/body measurements (`read:profile`), detailed sleep stage hypnograms, or journal records. In adherence to privacy-first engineering and the principle of least privilege, additional resources will be added only when specific product features require them.

Required initial consent scopes:
- `read:recovery`: Recovery score, resting heart rate, HRV.
- `read:cycles`: Daily physiological strain and energy expenditure.
- `read:sleep`: Sleep duration, performance, and sleep debt/need metrics.
- `read:workout`: Activity strain and workout sessions.

Official Developer References:
- [WHOOP OAuth Documentation](https://developer.whoop.com/docs/developing/oauth/)
- [WHOOP API Scopes Reference](https://developer.whoop.com/api/)

### API Realities & Rate Limits
- **No Continuous Live Streaming**: The WHOOP Developer API is a REST/Webhook interface providing discrete aggregated cycle records upon calculation completion. It **does not support continuous live heart-rate streaming**; assumptions of per-second live telemetry must not be built into domain or UI models.
- **Provider Agnosticism**: All progression and reward calculators interface exclusively with `HealthSnapshot`. Swapping WHOOP for Apple Health, Garmin, or manual logging requires only a new adapter implementing `HealthIntegrationProvider`, preserving complete core domain independence.
- **Strict Rank & Scoring Isolation**: Physiological health metrics (recovery score, sleep debt, cardiovascular strain, illness status) **must never award or deduct Season Rank points (SR), never gate promotion trials, and never lower or penalize a user's rank**. Health data serves solely to provide personal readiness context and suggested missions. Rest is for restorative recovery, not competitive pressure.

---

## 10. Seasonal Ranked System Architecture (Season Rank)

### Architectural Separation
The application strictly separates **Permanent Core Progression** from **Season Rank**:
1. **Permanent Core Progression (Never Resets)**:
   - Lifetime XP, character level, skill point allocations, stat attributes, tasks, habits, activity logs, and backup archives are perpetual.
   - Under no circumstances does a monthly rollover or season transition modify permanent progression totals.
2. **Season Rank (Monthly Cadence)**:
   - Evaluates monthly consistency, deliberate focus, and momentum.
   - Resets on the first day of every calendar month at 00:00 local time in the user's active timezone (`settings.timeZone`).
   - Operates without inactivity decay and without negative SR: missing a day never docks points or shames the user.

### Rank Ladder & Materials (20-Rung Ordered Ladder)
The competitive ladder consists of 20 discrete rungs across 8 tiers:
1. **Recruit** (III, II, I) — Slate (`#94a3b8`), outlined diamond badge.
2. **Bronze** (III, II, I) — Copper (`#cd7f32`), single-chevron shield badge.
3. **Silver** (III, II, I) — Steel (`#cbd5e1`), double-chevron shield badge.
4. **Gold** (III, II, I) — Muted Gold (`#eab308`), crowned hexagonal badge.
5. **Platinum** (III, II, I) — Cyan-Blue (`#38bdf8`), split crystal badge.
6. **Diamond** (III, II, I) — Violet-Blue (`#818cf8`), faceted diamond badge.
7. **Master** (Single high rank) — Magenta-Blue (`#c084fc`), winged diamond badge.
8. **Apex** (Single pinnacle rank) — White (`#ffffff`) with electric-blue halo (`#0090ff`), haloed star badge.

### Scoring Dynamics & Daily Caps
Points (Season Rank points, SR) are earned strictly through intentional daily effort:
- **Low-priority completed task**: 3 SR
- **Medium-priority completed task**: 6 SR
- **High-priority completed task**: 10 SR
- **Urgent completed task**: 15 SR
- **Daily habit check-in**: 5 SR
- **Daily task SR cap**: 25 SR per calendar day.
- **Daily habit SR cap**: 10 SR per calendar day.
- **Weekly Ranked Mission**: 25 SR (awarded upon completing 5 qualifying activities within the active ISO week `YYYY-Www`).
- **Focus sessions**: Timed focus blocks awarding 10 SR per completed 25-minute block, capped at 40 SR/day.

### Division Progression & Promotion Trials
- Each division requires 100 SR.
- Advancing within a tier (e.g. Recruit III $\to$ Recruit II) occurs automatically upon reaching 100 SR.
- Crossing a major tier boundary into Bronze, Silver, Gold, Platinum, Diamond, Master, or Apex is gated by a **Promotion Trial**:
  1. 100 SR in the current division.
  2. 3 qualifying productivity sessions in the last 7 calendar days.
  3. 4 active days in the last 7 calendar days (5 active days for Master and Apex).
  4. 1 completed weekly Ranked Mission.
- **Provisional Status Gate**: In a new month, the user remains "Provisional" until 3 qualifying activities are completed. SR continues accruing up to 100 during provisional placement, but promotions remain strictly gated until provisional status is cleared.

### Monthly Rollover & Soft Reset Math
On the first day of each calendar month:
1. **Archive Active Season**:
   - The completed season is permanently archived into `seasonRank.history` with final tier, final division, final SR, peak tier/division, and completion timestamp.
   - **Skipped-Month Protection**: If a user is inactive for multiple months (e.g. June to September), only the single last active season is archived. No duplicate or empty intermediate records are created.
2. **Soft Reset Seeding (2 Divisions Below)**:
   - Consistent 2-rung descent across the entire ladder ($\text{index} - 2$):
     - Apex (19) $\to$ Diamond I (17)
     - Master (18) $\to$ Diamond II (16)
     - Diamond I (17) $\to$ Diamond III (15)
     - Gold II (10) $\to$ Silver I (8)
     - Ranks at or below Bronze III (index $\le 3$) seed cleanly to Recruit III (0).
3. **Reset State**:
   - SR resets to 0. Seeded rank is assigned. Provisional counter resets to 0. Daily caps reset for today.

### Local Clock & Trust Boundary
As a zero-server, static web application running entirely in the browser:
- Storage and scheduling depend on the client machine's system clock.
- A fully local web application cannot cryptographically prevent a user from manually altering their device clock.
- This is an intentional, acceptable architectural reality: this application is a **private personal self-improvement workspace**, not a multi-tenant competitive public leaderboard with monetary stakes. Backward clock jumps are guarded gracefully in domain logic without data corruption or negative score generation.

---

## 11. Local Study Timer Architecture

### Timestamp-Derived State Transitions
To guarantee durability and precision in a zero-server static web application, the Study Timer deliberately avoids persisting per-second countdown counters to `localStorage`:
- **State Fields**:
  - `status`: `"idle" | "running" | "paused"`
  - `sessionId`: Unique identifier for the active session, or `null` if idle
  - `durationMinutes`: Selected preset (`25 | 50 | 75`)
  - `segmentStartedAt`: UTC ISO 8601 timestamp marking the start of the active running segment, or `null` if idle/paused
  - `accumulatedElapsedMs`: Total elapsed milliseconds accumulated across previously paused segments
  - `lastCompletedSessionId`: Last recorded completed session ID to ensure completion idempotency
- **Elapsed Time Derivation**: Elapsed and remaining time are derived purely from absolute wall-clock timestamps:
  $$\text{totalElapsed} = \text{accumulatedElapsedMs} + (\text{nowUtc}() - \text{segmentStartedAt})$$
- **Immunity to Drift and Throttling**: Tab switching, background tab throttling, OS sleep/wake, and page reloads have zero effect on countdown accuracy. When the user returns, the elapsed time is recomputed against the absolute device clock.
- **Persistence Boundary**: `localStorage` writes occur solely upon meaningful state transitions: start, pause, resume, cancel, and completion. Zero I/O operations occur on periodic UI display ticks.

### Idempotent Completion & Pre-Rollover Reconciliation
- **Idempotency**: Completion is strictly idempotent. Repeated execution, rapid double clicks, or simultaneous focus/visibility events cannot double-credit XP, stats, logs, SR, or mission progress.
- **Monthly Boundary Precedence**: Before completing an elapsed session, the system reconciles monthly rollover using the completion timestamp and configured timezone. A study session started at 23:45 on the final day of a month and finishing at 00:10 on the first day of the new month correctly attributes its Season Rank blocks to the new season, after the prior season has been safely archived.
- **Cancellation**: Cancelled or partial sessions receive zero XP, stats, SR, or activity logs, returning cleanly to idle.

### Rewards & Season Rank Scoring Boundary
- **Duration Presets**: 25, 50, and 75 minutes, mapping strictly to 1, 2, and 3 completed 25-minute focus blocks.
- **Permanent Rewards per 25-Minute Block**:
  - Permanent XP: +25 XP
  - Discipline: +2
  - Knowledge: +3
  - Focus: +3
- **Permanent Activity Log**: Exactly one `ActivityLog` entry is appended per completed session with type `"focus"`, titled `Completed study session · <N> min`.
- **Season Rank Integration**: Scored via the existing pure `applyActivityToSeasonRank(currentState, blockId, "focus", ...)` boundary once per 25-minute block with deterministic block IDs (`${sessionId}_block_${i}`). This enforces the existing +10 SR per block award and the 40 SR daily focus cap without duplication.

### Migration Strategy (Schema v2 to v3)
- Schema version is bumped from 2 to 3.
- `migrateV2ToV3` attaches default idle `StudyTimerState` to prior states/backups without mutating existing XP, stats, tasks, habits, or seasonal history.
- Upgrades execute in memory with automatic write-back on load.

### Local Clock Limitation & Trust Boundary
As with the seasonal rank system, the study timer relies on the client device's trusted system clock. While client-side clock alterations cannot be cryptographically prevented without a centralized server, backward clock jumps are guarded gracefully in domain logic (`Math.max(0, now - segmentStart)`), ensuring elapsed time never becomes negative or corrupts data.
