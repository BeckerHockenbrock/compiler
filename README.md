# Personal Progression App

A personal study, to-do, lifestyle, and progression application built with Next.js, TypeScript, and local-first browser persistence.

## Architecture Highlights
- **Zero Server-Runtime Static Deployment**: Built as a purely static export (`output: 'export'`) hosted on Vercel without Node.js server dependencies or server-side state.
- **Privacy & Durability First**: All application state resides exclusively in client-side storage (`localStorage`) behind a clean storage abstraction.
- **Pure Domain Engine**: Leveling math, XP curves, habit streaks, and stat updates are decoupled from React and browser APIs for complete testability.
- **Robust Data Lifecycle**: Stable namespaced keys (`personal_app:state`), envelope schema versioning (`CURRENT_SCHEMA_VERSION = 2`), non-destructive corrupt-data handling, estimated storage metrics, and user-visible log compaction.
- **Safe Backup & Restore**: In-memory schema validation and migrations, accidental-corruption checksumming (FNV-1a), confirmation gates, and automatic pre-import safety snapshots (`personal_app:backup:pre_import`).

Detailed architectural specifications, layer contracts, and non-goals are documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Local Development

### Prerequisites
- Node.js `22.x` or `24.x`
- npm `10.x` or `11.x`

### Installation
```bash
npm install
```

### Development Server
Starts the Next.js local development server:
```bash
npm run dev
```

### Static Production Build
Compiles the static export into the `./out` directory:
```bash
npm run build
```
*(Note: There is no `next start` command because this application is deployed as static files without a Node runtime).*

### Typechecking & Linting
```bash
# Typecheck with TypeScript strict mode
npm run typecheck

# Lint using ESLint 9 flat configuration
npm run lint
```

---

## Application Features

- **⚔️ Quests & Tasks**:
  - Task creation with title, priority (`low`, `medium`, `high`, `urgent`), due date, and XP rewards.
  - Inline editing of pending quests (title, priority, due date, XP reward).
  - Deletion of pending quests with interactive confirmation.
  - Idempotent quest completion awarding XP, leveling up the character, and granting skill points without duplicate rewards.
- **🔥 Daily Rituals & Habits**:
  - Habit creation with customizable daily XP rewards.
  - Calendar-day check-in logic that respects the user's local timezone.
  - Prevention of duplicate check-ins on the same calendar day.
  - Streak tracking (current streak and best all-time streak) with automatic streak break detection.
- **📜 Status & Skill Trees**:
  - RPG-style character status HUD: Level, Current XP, Next Level Threshold, Progress Bar, and Available Skill Points.
  - Core Attributes: Discipline, Knowledge, Vitality, Focus, and Craft.
  - Interactive Skill Point Allocation: Allocate earned points to rank up skills and boost linked core attributes (+5 per rank).
- **🛡️ Vault & Data Ownership**:
  - Real-time estimated `localStorage` usage meter.
  - One-click JSON backup export with accidental-corruption checksumming.
  - Safe backup restore pipeline with in-memory validation, confirmation prompts, and automatic pre-import safety snapshots (`personal_app:backup:pre_import`).
  - Safe reset to factory defaults with confirmation gate.
- **📱 Mobile-First Game-HUD Design**:
  - Full support for mobile devices with minimum 44px touch targets.
  - iPhone safe-area inset accommodation.
  - Dark game/anime aesthetic with cybernetic borders, glowing accents, and reactive feedback.

---

## Testing Guide

The project uses [Vitest](https://vitest.dev/) for fast, isolated unit testing.

### Run All Tests
```bash
npm run test
```

### Run Targeted Tests
To target a specific test suite or file, use the `--` delimiter:
```bash
# Test quest / task lifecycle (creation, update, delete, completion, idempotency)
npm run test -- tests/domain/tasks.test.ts

# Test habit lifecycle and calendar-day streak tracking
npm run test -- tests/domain/habits.test.ts

# Test skill point allocation and linked attribute scaling
npm run test -- tests/domain/skills.test.ts

# Test progression formulas and leveling curves
npm run test -- tests/domain/progression.test.ts

# Test date-time and timezone rules
npm run test -- tests/domain/date-time.test.ts

# Test habit streak engine
npm run test -- tests/domain/streaks.test.ts

# Test end-to-end persistence flow across store reloads
npm run test -- tests/storage/persistence-flow.test.ts

# Test namespaced storage adapter
npm run test -- tests/storage/adapter.test.ts

# Test non-destructive corrupt-data handling
npm run test -- tests/storage/corrupt-data.test.ts

# Test backup export and import pipeline
npm run test -- tests/storage/backup.test.ts

# Test log retention and compaction
npm run test -- tests/storage/compaction.test.ts
```

---

## Backup & Restore Protocol

All user data is stored locally in the browser under the namespaced key `personal_app:state`.

### Exporting Backup
- Triggers generation of an envelope containing the app identifier, export timestamp, accidental-corruption checksum, and current state.
- The checksum ensures that truncated files or corrupted copy-pastes can be detected before restoration.

### Restoring Backup
The restoration process operates through a safe multi-stage pipeline:
1. **In-Memory Validation**: Parses the JSON, verifies the checksum, and validates schema conformance.
2. **In-Memory Migration**: If restoring data from an older schema version, migrations run in memory before touching storage.
3. **Explicit Confirmation**: Requires confirmation before applying changes.
4. **Pre-Import Safety Snapshot**: The current state is preserved to `personal_app:backup:pre_import` prior to applying the new data.
5. **Atomic Overwrite**: The validated state replaces `personal_app:state`.

---

## Storage Isolation Notice

Please note the two distinct dimensions of data isolation:

1. **Origin Isolation (Same Browser, Same Device)**:
   Web origin security strictly partitions local storage by protocol, domain, and port:
   - `http://localhost:3000` (Local Dev)
   - `https://<project>.vercel.app` (Production)
   - `https://<project>-git-<branch>.vercel.app` (Preview branches)
   
   Data saved in local development or preview branches does not appear in production.

2. **Device / Browser Separation**:
   Opening `https://<project>.vercel.app` on an iPhone (Safari) and on a laptop (Chrome) accesses separate physical storage databases. Data is not shared between devices until manual backup/restore or future cross-device sync is used.

---

## Deployment Workflow

The repository is configured for automatic static deployment to Vercel:
1. Pushes to any branch trigger CI checks; pushes to `main` automatically deploy to the **Production** environment.
2. Pull requests targeting `main` automatically run CI and generate Vercel **Preview** deployments.
3. The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) verifies typecheck, linting, tests, and static export on every push and PR.

---

## Technical Notes

- **Unavailable Browser Storage**: If `localStorage` is blocked or throws a `SecurityError` (e.g., restricted iframe or private browsing), the adapter returns a structured `STORAGE_UNAVAILABLE` error and does not silently fall back to ephemeral memory in production, ensuring stored user data is never overwritten, reset, or masked.
- **Framework Version Policy**: The application currently targets Next.js 15. A future, deliberate Next.js major-version upgrade should be evaluated separately once features, stability, and static export parity are benchmarked.
