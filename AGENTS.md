# CubeApp — Project Instructions

## Communication

Be professional, concise and impersonal. The project owner uses she/her pronouns and is fluent in English and Portuguese; use either language as appropriate.

## Project Goal

CubeApp is a simple, clean, modern web application for timing and storing speedcubing solves.

The project is intentionally limited in scope. It should provide the core features that are actually useful for everyday speedcubing while avoiding the clutter and excessive configuration found in many existing timer applications.

The application should run locally on the user's PC during development and should be designed so that it can later be hosted and shared with friends.

The user wants to understand the codebase and make manual changes, so prefer simple, explicit, readable implementations over overly abstract or highly automated solutions.

The current placeholder app name is `namicubes`. CubeApp remains the repository/project name. Phases 1–4 are complete; phase 5 currently implements a simplified single custom field. Preserve the owner's manual visual edits. The preferences and implemented behavior documented below supersede earlier suggestions about configurable hold delays, light themes, recent solves on the timer page, and separate cube brand/model fields.

---

## Visual Identity and Interface Rules

- Keep the app minimalistic, modern and tech-like. Only retain necessary content and controls.
- Prioritize mobile layouts while keeping desktop equally polished.
- Use a dark theme exclusively. Do not add a light theme or theme switch.
- Use Roboto Mono from Google Fonts throughout, with a monospace fallback.
- All interface text must be lowercase, brief and free of punctuation. Numeric time formatting and the explicitly requested animated dots are exceptions. This rule applies to site content, not documentation or code identifiers.
- Do not add a footer, slogan, decorative introductory text, or unnecessary permanent settings.
- Use the existing variables in `frontend/src/styles/main.css` under `:root` for colors and future elements. Keep palette changes centralized rather than introducing hard-coded colors in components.
- Current color roles are `--bs-body-bg`, `--bs-body-color`, `--muted`, `--accent`, `--ready`, `--holding`, `--panel-bg`, `--panel-border`, `--list-border`, and `--checkbox-bg`. Read the CSS for their current values.
- The brand is currently 22px. Keep it relatively prominent on mobile; do not reintroduce the old 15px narrow-screen override. Maintain space between the brand, clock and graph icons.
- Use Lucide SVG icons from `frontend/src/icons.ts` for a consistent minimal style. Import only required icons.
- Navigation uses clock, graph and gear icons for timer, analysis and settings. Preserve accessible lowercase labels, keyboard behavior and at least 44px interaction targets.
- Active navigation uses `--accent`. The settings gear stays highlighted while its panel is open.
- Settings is a larger panel below the header, on the right on desktop, constrained to the available width on mobile. Outside clicks, including timer or analysis navigation, close it.
- Event selection, cube text, hidden timer preference and account controls belong in settings.
- Solve history opens from the history icon immediately to the left of settings. It is an expandable right sidebar on desktop and fills the viewport below the header on phones. It has its own scrollbar, includes every owned solve, and has no recent solves heading or total count. Do not display solve-number placeholders or empty columns.
- Recent solve rows show result and available labels, with a trash icon in `--muted` replacing the clock timestamp. Keep timestamps in the database for future analysis.
- Use `frontend/public/cube_logo3.png` as the placeholder favicon. Public assets belong under `frontend/public`.

---

## Technology Stack

Frontend:
- HTML
- CSS
- Bootstrap 5
- Vanilla TypeScript
- Vite
- Lucide for SVG icons
- Chart.js for analytics visualizations
- cubing.js for optional event-specific scramble generation

Backend:
- Python
- FastAPI
- SQLModel
- SQLAlchemy underneath SQLModel
- Alembic for database migrations

Database:
- SQLite during local development
- Keep the architecture compatible with a future migration to PostgreSQL

Authentication:
- Simple username/password authentication
- Passwords must be securely hashed
- Prefer Argon2id
- Use authenticated server-side sessions or secure session cookies
- Never trust a user_id supplied by the browser to determine data ownership

Testing:
- pytest for backend tests
- Add frontend tests only where they provide clear value
- Frontend tests currently use Node's built-in test runner with TypeScript stripping

---

## General Design Principles

1. Keep the application understandable.
2. Avoid unnecessary frameworks and dependencies.
3. Do not introduce React, Vue, Svelte, Redux, or similar frameworks unless there is a strong future reason.
4. Prefer explicit code over abstraction-heavy architecture.
5. Keep frontend and backend responsibilities clearly separated.
6. Keep the timer engine isolated from unrelated application logic.
7. Design mobile-first, but make the desktop version equally polished.
8. Preserve raw solve data and allow flexible filtering later instead of forcing users into rigid organizational structures.
9. Avoid adding features simply because other cube timers have them.
10. If a feature is not part of the current scope, do not implement it unless explicitly requested.

---

## Repository Structure

cubeapp/
├── AGENTS.md
├── README.md
├── .gitignore
├── .gitattributes
├── alembic.ini
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── public/cube_logo3.png
│   ├── tests/
│   └── src/
│       ├── main.ts
│       ├── accounts.ts
│       ├── icons.ts
│       ├── timer/
│       │   ├── timer.ts
│       │   └── controls.ts
│       ├── api/
│       │   └── api.ts
│       ├── analytics/       (planned for phase 4)
│       │   ├── charts.ts
│       │   └── filters.ts
│       └── styles/
│           └── main.css
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── requirements.txt
│   ├── import_legacy.py
│   ├── tests/
│   ├── models/
│   ├── routes/
│   └── services/
├── migrations/
└── scripts/

The exact structure may evolve, but keep modules small and responsibilities clear.

`frontend/index.html` is the editable source entry point. `frontend/dist/index.html` is generated by Vite and overwritten on build; never make manual changes in `dist`. Styles live in `frontend/src/styles/main.css`; display and interaction wiring live in `frontend/src/main.ts`.

---

## Core Data Model

Do NOT create different solve tables for different cubes, users, categories, or date ranges.

Use relational tables for distinct entities.

### users

Suggested fields:
- id
- username
- password_hash
- created_at

### login_sessions

Implemented server-side authentication sessions contain `token_hash`, `user_id` and `expires_at`. These are login sessions, not solve-grouping sessions. Never store raw session tokens in the database.

### cubes

Represents physical cubes owned or used by a user.

Suggested fields:
- id
- user_id
- name

The cube UI is a free-text field, with suggestions from the user's previously saved cubes. Do not introduce separate brand or model fields. Cube names are trimmed and lowercased, and names are unique within each user's collection. New cube names and custom values are limited to 10 characters on the frontend; the backend caps submitted values to 10 characters after normalization. Prevent overlength typing and show a brief yellow message for rejected input. Settings commits preferences on close without an ok button, and changing the event clears the cube input. Preserve existing long names in other accounts rather than truncating stored records.

### categories

Represents arbitrary user-defined classifications for solves.

The current UI labels this field `event` and uses a single-select dropdown. Event labels are stored as per-user category records; retain the `category_id` relationship rather than creating a separate solve table for each event. Custom practice categories remain a possible future extension, not an implemented UI feature.

All 17 official WCA event labels are available, plus the owner's requested FTO extra:

- `2x2`, `3x3`, `4x4`, `5x5`, `6x6`, `7x7`
- `3bld`, `4bld`, `5bld`
- `3oh`, `3mbld`, `fmc`
- `clock`, `megaminx`, `pyraminx`, `skewb`, `square 1`
- `fto` (additional unofficial label)

The official list was checked against WCA regulation 9b: https://www.worldcubeassociation.org/regulations/#9b. These are labels for timed practice; official FMC move-count scoring and multi-blind scoring are not implemented.

Examples:
- Normal 3x3
- PLL practice
- Slow solves
- Competition simulation
- Lookahead practice

Suggested fields:
- id
- user_id
- name

### solves

Core solve records.

Solve IDs are client-generated UUIDs, retained on retries to avoid duplicate inserts. Ownership comes from the server session. Optional cube and event labels are saved with each result. Phase 2 legacy records may have no owner until explicitly imported; newly saved records always belong to the authenticated user.

Suggested fields:
- id
- user_id
- cube_id
- category_id
- duration_ms
- started_at
- penalty
- custom (optional categorical text up to 10 characters)
- scramble (optional immutable text up to 4096 characters)

Do NOT currently include:
- notes
- session_id

Store solve duration as integer milliseconds.

Store real-world timestamps separately from solve duration.

Use UTC internally for stored timestamps and convert to local time for display.

Penalty should support at least:
- OK
- +2
- DNF

### solve_fields

The owner simplified phase 5 to one optional `solves.custom` text column. Edit it using the same pencil popup on the timer and history, alongside mutually exclusive +2 and dnf switches displayed side by side. Closing the editor saves changes and closes it after server confirmation; there is no ok button. Failed saves keep the editor open. Do not display custom values in solve rows or below the timer. Custom is available as an analytics filter and in the best custom card. Use ORM parameter binding for SQL safety and textContent or Option for UI rendering; never construct SQL or HTML from user input. Blank custom values become null; trim and lowercase categorical values, cap new submissions at 10 characters and reject control characters.

The generic solve_fields table below is still a future extension and does not exist yet. Do not add it unless requested.

Flexible optional metadata attached to individual solves.

This table is intentionally generic so experimental variables can be added without changing the database schema.

Fields:
- id
- solve_id
- name
- value
- value_type

Supported value types should initially include:
- text
- number
- boolean

Examples:

| solve_id | name       | value | value_type |
|----------|------------|-------|------------|
| 482      | PLL        | T     | text       |
| 482      | Move count | 57    | number     |
| 482      | TPS        | 6.84  | number     |

The backend should not impose an arbitrary limit of three fields.

The UI may initially present approximately three optional slots, but should allow additional fields later without requiring a schema change.

---

## Solve Saving Workflow

When the timer stops:

1. Immediately save the basic solve record.
2. Store duration and timestamp first.
3. Display the result to the user.
4. Allow the user to optionally add or edit solve_fields afterward.
5. Updating advanced metadata should update the already-created solve.

Do not wait for optional metadata before saving the solve.

This prevents losing a solve if the page is refreshed or closed.

Current implementation queues saves immediately in browser local storage separately for each account, sends them to FastAPI, and retries pending saves every 15 seconds or when connectivity returns. Do not submit one account's queued results under another account's session. The optional custom value is edited after the initial save through an owned PATCH request.

The history panel loads every owned solve through GET /api/solves/all. Analytics uses the same data with local date, event, cube and custom filters. A trash action permanently deletes an owned solve in the database and removes it from the UI only after server confirmation. Refresh the list to bring in older results. Pending/unsaved results cannot be deleted; failed deletion requests retain the row. A user must never be able to delete another user's solves. Preserve reusable cube and event records when deleting a solve.

---

## Timer Requirements

The timer runs entirely in the browser.

The backend must not measure solve duration.

Use:
- `performance.now()` for elapsed time measurement
- `requestAnimationFrame()` only for visual updates

Never calculate elapsed time by counting animation frames.

### Timer state model

A simple internal state machine is preferred:

- IDLE
- HOLDING
- READY
- RUNNING
- STOPPED

Do not add a state-machine library.

The hold duration is fixed at exactly 400ms. Do not add a setting or make it configurable.

Every stop flashes the timer in `--ready` for 300ms before restoring its usual white color. Reset the timer engine and displayed value to `0.00` on logout, login or account change, clearing any prior stop animation; saved solve records remain intact.

---

## Desktop Keyboard Behavior

When idle:

- Holding Space begins the preparation phase.
- After the fixed 400ms hold threshold, the timer becomes READY.
- Releasing Space while READY starts the timer.

When running:

- Pressing almost any ordinary keyboard key should immediately stop the timer.
- Do not require Space specifically.
- Ignore repeated keydown events where appropriate.
- Browser and OS shortcuts do not need to be intercepted.

Only Space should initiate the timer by default.

---

## Mobile / Pointer Behavior

Use Pointer Events rather than maintaining separate mouse and touch implementations.

When idle:

- User presses and holds the main timer interaction area.
- After the fixed 400ms hold delay, the timer becomes READY.
- Releasing starts the timer.

When running:

- A pointer press stops the timer immediately.

The interaction target should be large, ideally the main central timer area.

Use appropriate CSS such as `touch-action` where necessary to prevent scrolling or gesture behavior from interfering with the timer.

Keep the same unchangeable 400ms hold duration on desktop and mobile.

---

## Optional Scrambles

Scrambles explicitly expand the original scope. The settings switch beside hide timer defaults off and persists separately per account on settings close. Use cubing.js 0.63.8 with an explicit mapping in frontend/src/scrambles.ts for all 18 app events. Blindfolded and fewest-moves events retain their dedicated identifiers. The 333mbf API does not take a cube count and returns one oriented 3x3 scramble per timed practice solve; multi-cube attempt scoring and batches remain deferred. Disable cubing.js automatic prefetching so generation is requested only on enable, event change, manual replacement or after a solve stops.

Show current notation in muted text near the top of the timer with a Shuffle replacement icon. Preserve uppercase, primes, punctuation and whitespace as an explicit exception to interface text rules. Generation is asynchronous with account/event/request revision guards and retry feedback; never substitute random moves. A valid scramble is required before preparation and start while enabled. Keep the fixed 400ms hold. Capture an immutable scramble and event snapshot at actual timer start, immediately queue it on stop, then generate the next scramble. When disabled save null. Lock event/scramble controls during preparation and solving.

Migration 0004 adds nullable solves.scramble as SQL Text with a 4096-character validation/check limit, accommodating generated big-cube notation. Back up the local database before applying it; existing solves receive null and remain otherwise unchanged. Preserve notation exactly with parameterized ORM writes and textContent rendering. Older queued records without this field remain valid. Include scramble in duplicate-save consistency checks and reject scramble on the editing endpoint.

History adds Dice5 before pencil/trash only when a scramble exists. It opens a small read-only popup anchored to the actual clicked button. Outside click and Escape dismiss it. Coordinate it with settings/history/editor and preserve dirty editor save-on-close. Keep long notation wrapped and all icon targets at least 44px. Browser QA must use temporary databases and test generation, event changes, regeneration, timer snapshot saving, refresh and saved-scramble viewing on desktop/mobile. Verify the live backend schemas after restarting it.

## Hidden Timer Mode

The user must be able to hide the live timer while solving.

This is an important feature.

Implemented modes:

1. Live time
2. Hidden time with centered animated dots only; do not show the word `solving`

Dots cycle from one through five and then directly back to one. Each step lasts 300ms, for a 1.5-second loop. Keep them centered and reserve enough space to prevent layout jumps. The hidden display currently uses `clamp(32px, 10vw, 106px)`; preserve the responsive sizing unless asked to change it.

The solve must still be timed normally using `performance.now()`.

This setting, event selection and cube text persist in browser local storage separately for each user. Preferences do not yet synchronize between devices.

---

## Main Timer Interface

The timer page should remain intentionally sparse.

Primary information:
- timer
- brief timer interaction hint

Current event and cube are selected in settings. Solve history lives in its header panel. The timer has pencil and trash controls only after a completed solve. Its interaction target covers the viewport below the header; panels and action buttons take priority. Pointer presses clear the timer focus outline; Tab navigation retains a keyboard focus indicator. Analytics contains ao5 and ao12.

Avoid filling the page with permanent configuration controls.

Less frequently used options should live in:
- expandable panels
- offcanvas menus
- bottom sheets
- settings dialogs

The app should look modern and clean on both desktop and mobile.

---

## Analytics

Create a separate analytics tab.

The analytics interface should use the same underlying solve data rather than storing pre-grouped sessions.

There is intentionally NO solve-grouping session concept in the data model. Authentication login sessions are separate and already implemented.

### Date filtering

The analytics event selector always chooses one event and defaults to 3x3 after login or account change. Do not include an all-events option or mix event times in charts and basic statistics. The solve editor input is labeled custom tags; the dashboard filter and card continue to use custom.

Date filtering must be flexible.

Support:
- freely chosen start date
- freely chosen end date
- calendar/date picker UI
- optional convenience presets such as:
  - Today
  - Last 7 days
  - Last 30 days
  - Last 90 days
  - All time

The architecture should allow time-of-day filtering later.

Date filters are query conditions over `started_at`, not stored session objects.

### Other filters

Analytics should eventually support filtering by:
- cube
- category
- penalty state
- user-defined solve_fields where practical

### Initial statistics

Useful statistics include:
- solve count
- mean
- median
- best
- standard deviation
- current ao5
- current ao12
- best ao5
- best ao12

### Initial charts

Start with:
- solve-time line graph
- rolling averages where useful
- solve-time histogram

Later comparisons should support things such as:
- Cube A vs Cube B
- category comparisons
- arbitrary date-range comparisons

---

## Authentication and Data Ownership

The application must support multiple users.

Each user's cubes, categories, solves, and related metadata belong to that user.

Backend endpoints must determine the authenticated user from the session.

Do not design endpoints where the browser can choose an arbitrary `user_id` to access someone else's data.

Passwords must never be stored in plaintext.

Implemented authentication uses Argon2id via pwdlib and server-side sessions. Session tokens are random, stored only as hashes in the database, and expire after seven days. Cookies are HttpOnly and SameSite strict. Logout invalidates the session.

Mutation endpoints require `X-Namicubes-Request: 1`; cross-origin access is not enabled. Solve save/delete requests also carry `X-Namicubes-Account` as a stale-account guard. This header must match the authenticated session; it does not determine ownership or grant access to another user's data.

For HTTPS deployment set `COOKIE_SECURE=true`. Plain HTTP is supported for trusted local Wi-Fi development. Keep authentication secrets, password hashes, session data and user solve data out of Git.

Phase 2 solves were preserved without automatically assigning them to the first registrant. After registering the intended account, use the local administrative command `python -m backend.import_legacy username` with the project's virtual environment to assign unowned records. Do not automatically claim these records through the browser. The old phase 2 browser queue remains untouched under its previous key.

---

## Features Explicitly Deferred

Do not implement these unless explicitly requested later:

- smart cube integration
- StackMat integration
- Bluetooth
- social features
- leaderboards
- public profiles
- chat
- cloud sync
- Google login
- automatic CFOP recognition
- algorithm trainer
- reconstruction tools
- advanced scramble visualization
- official scoring formats for FMC and multi-blind (all WCA event labels are already implemented)
- complex competition management
- notifications
- PWA functionality

PWA support may be considered later after the normal responsive web app works well.

---

## Development Order

Prefer implementing features in this order.

### Phase 1 — Timer — done

Completed responsive frontend timer.

Goals:
- correct timing
- keyboard controls
- mobile pointer controls
- hold-to-start
- any-key-to-stop
- hidden timer mode
- clean responsive interface

Includes fixed 400ms preparation, ready/holding colors, 300ms stop feedback, dots-only hidden mode and account-change reset.

### Phase 2 — Persistence — done

Implemented:
- FastAPI backend
- SQLite
- SQLModel
- solve storage
- basic API communication
- Alembic migrations and failed-save retry queue
- recent solve loading and persistence across refreshes

### Phase 3 — Organization and Users — done

Implemented:
- authentication
- users
- cubes
- categories
- data ownership
- all WCA event labels plus FTO in a single-select event dropdown
- free-text cube names without brand/model fields
- expanded settings panel and per-user browser preferences
- permanent solve deletion with ownership checks
- Lucide icon navigation and trash controls

### Phase 4 — Analytics — done

Add:
- complete account history in a separately scrollable header panel
- filtering
- ao5
- ao12
- mean
- median
- standard deviation
- line graph
- histogram
- date-range filtering

Analytics now has 18 cards. Group 1: solves, mean, median, std dev, +2 count, ao5, ao12, ao50, ao100. Group 2: best, best ao5, best ao12, best ao50, best ao100, worst, fav event, best cube, best custom. Desktop shows two rows of nine; mobile shows one group of nine at a time with a right chevron that cycles without animation. Fit text labels inside their cards, reducing font size for longer names and retaining a full title. Date filters use inclusive local calendar days over UTC timestamps; presets include today, 7, 30, 90 days and all time. Event, cube and custom filters apply only to analytics; history remains the entire account. DNF count appears beside times in the same style as the distribution outlier count; there is no penalty filter.

Favorite event is the event with the most solves, including DNF, ignoring the event filter while retaining other filters. Best cube ignores the cube filter and compares medians within the selected event. If no event is selected, derive its favorite-event fallback without the cube filter too. Best custom retains its filters and uses the selected event or favorite event. Exclude unlabeled groups and DNF from median comparisons, include +2 in effective times, and leave missing results blank. Ties use event list order for favorite event and alphabetic label order for best cube/custom.

Preserve raw duration when applying penalties. Add 2000ms for +2. DNF contributes to count but is excluded from basic statistics, worst time and the histogram. Trim five percent from each end rounded up: one result for ao5/ao12, three for ao50, five for ao100. DNF sorts as the worst result; a remaining DNF makes the average DNF. Compute averages within chronological filtered results. Missing statistics remain blank. Statistics always use every solve, even when large chart series are sampled for rendering. The times axis uses round solve-count ticks and numeric solve positions. Histogram boundaries are nonnegative, have one decimal place, and appear horizontally at every bar edge including the final upper edge. Tooltips show the full interval using the requested boundary symbol. The outlier count is visible on desktop and mobile without the word hidden.

Keep the whole analytics dashboard within normal desktop and portrait phone viewports without page scrolling. Use stacked charts on mobile. Short phone screens may scroll the dashboard internally so charts remain readable. History and settings fill the phone viewport below the header and close each other when opened. Background synchronization must not rebuild unchanged icon controls or cause flashing. New checks cover averages, penalties, histogram boundaries, local date filters and complete history ownership.

### Phase 5 — Simplified Custom Metadata — implemented

Implemented one optional custom categorical value per solve, editing after solves with save on close, ownership and input length handling, custom filtering, expanded analytics and median comparisons. Generic solve_fields remains deferred.

### Phase 6 — Deployment Improvements — not started

Consider:
- PostgreSQL
- hosting
- PWA
- additional quality-of-life features

---

## Guidance for Coding Agents

When making changes:

1. Read this file first.
2. Keep modifications narrowly scoped to the requested task.
3. Do not silently change architecture.
4. Do not add large dependencies without explaining why they are necessary.
5. Do not replace existing technology choices without explicit approval.
6. Avoid premature abstractions.
7. Prefer readable code that a developer familiar with Python, JavaScript, HTML, CSS, Bootstrap, SQL, and basic web development can understand.
8. Keep functions and modules focused.
9. Preserve existing behavior unless the task explicitly changes it.
10. When introducing unfamiliar syntax or tools, keep the implementation straightforward.
11. Do not generate large amounts of unrelated boilerplate.
12. If a task can be solved cleanly with the existing stack, use the existing stack.

The project owner intends to learn from and manually edit this codebase, not merely operate generated software.

---

## Development, Validation and Git

- Follow `README.md` for virtual environment setup, dependency installation, migrations and server commands. Do not install globally when the project environment suffices.
- Run the backend from the repository root using `.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload` on Windows.
- Run `npm run dev` in `frontend` for localhost, or `npm run dev:lan` for phone testing on the same network. Vite proxies `/api` to the local backend; do not expose FastAPI separately just to support mobile.
- Discover the current LAN URL from Vite rather than hard-coding the PC's address. Windows Firewall has been configured to allow Node.js on private networks within the local subnet; do not broaden that rule unnecessarily.
- Keep the PC and both servers running for phone access. Sign into the same account on PC and phone to share saved solves.
- The default database is `backend/solves.db`; `DATABASE_URL` can override it. Use Alembic for schema changes and back up local data before migration. Never silently reset the database.
- Frontend validation: `npm run build` and `npm test` in `frontend`. Backend validation: `.venv/Scripts/python.exe -m pytest backend/tests` from the root. Tests use temporary databases; never delete real user solves while testing.
- Meaningful current checks cover timer timing/reset, save retries, account isolation, authentication, migration preservation and permanent deletion. The phase 3 checkpoint passed 15 backend tests, seven frontend tests and the production build.
- The local Git repository uses `main` and tracks `origin/main` at `https://github.com/nonamilua/datacube.git`. The completed checkpoint was committed and pushed as `phase 3 complete` (`596dfe7`). Commit or push later changes only when requested.
- `.gitignore` excludes dependencies, Vite builds, virtual environments, caches, local SQLite databases/backups/sidecars, logs and environment secrets. `.env.example` may be tracked only with placeholders. Verify staged contents before publication.
- `.gitattributes` uses `* text=auto` and enforces LF for JavaScript, TypeScript, CSS, HTML, JSON, Python and Markdown source files.

---

## Current Project Path

Local development project path on Windows:

`C:\dev\cubeapp`

This path is informational only. Code should use relative paths inside the repository rather than hard-coded absolute paths.
