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
│   ├── domain/                # Pure domain layer (ZERO React/DOM/Storage dependencies)
│   │   ├── types.ts           # Core domain entity types & interfaces
│   │   ├── date-time.ts       # Strict ISO 8601 UTC & local calendar date logic
│   │   ├── progression.ts     # XP formulas, level curves, and reward state transitions
│   │   ├── streaks.ts         # Habit streak calculations evaluated on calendar days
│   │   ├── tasks.ts           # Pure task creation, update, deletion, and idempotent completion
│   │   ├── habits.ts          # Pure habit creation, deletion, and single daily check-in
│   │   ├── skills.ts          # Pure skill point allocation and linked attribute scaling
│   │   └── defaults.ts        # Initial seed state and default entities
│   ├── hooks/                 # React client integration
│   │   └── use-app-store.ts   # Client store linking StorageManager to UI with hydration safety
│   ├── storage/               # Persistence, validation, migration & backup layer
│   │   ├── types.ts           # StorageAdapter interface, StorageEnvelope, error types
│   │   ├── schema.ts          # Zod validation schemas & CURRENT_SCHEMA_VERSION = 1
│   │   ├── checksum.ts        # Fast FNV-1a checksum for accidental-corruption detection
│   │   ├── compaction.ts      # User-visible log retention & compaction (preserves aggregates)
│   │   ├── migrations/        # Sequential in-memory migration runner
│   │   │   └── index.ts       # Migration registry (transitions added only on version bumps)
│   │   ├── adapter.ts         # NamespacedLocalStorageAdapter (scoped keys, no localStorage.clear())
│   │   ├── backup.ts          # Safe in-memory backup export and import pipeline
│   │   └── storage-manager.ts # Storage coordinator, metric estimation, non-destructive recovery
│   └── lib/                   # Shared utility primitives
│       └── result.ts          # Type-safe Result<T, E> discriminated union
├── tests/                     # Vitest automated unit test suites
│   ├── domain/                # Tests for progression, date-time, streaks, tasks, habits, skills
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
- `CURRENT_SCHEMA_VERSION = 1` is defined in `src/storage/schema.ts`.
- No empty or dummy migration files exist. Migration files are introduced in `src/storage/migrations/` only when an actual version transition ($1 \to 2$) occurs.

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

