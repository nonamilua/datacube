# CubeApp — Project Instructions

## Communication

Be professional, concise and impersonal. The project owner uses she/her pronouns and is fluent in English and Portuguese; use either language as appropriate.

## Project Goal

CubeApp is a simple, clean, modern web application for timing and storing speedcubing solves.

The project is intentionally limited in scope. It should provide the core features that are actually useful for everyday speedcubing while avoiding the clutter and excessive configuration found in many existing timer applications.

The application should run locally on the user's PC during development and should be designed so that it can later be hosted and shared with friends.

The user wants to understand the codebase and make manual changes, so prefer simple, explicit, readable implementations over overly abstract or highly automated solutions.

The app name is `datacube`, displayed as two stacked words; Portuguese uses `dados` and `cubos` with an ampersand centered to their right. CubeApp remains the repository/project name. Phases 1–4 are complete; phase 5 currently implements a simplified single custom field. Preserve the owner's manual visual edits. The preferences and implemented behavior documented below supersede earlier suggestions about configurable hold delays, light themes, recent solves on the timer page, and separate cube brand/model fields.

---

## Visual Identity and Interface Rules

- Keep the app minimalistic, modern and tech-like. Only retain necessary content and controls.
- Prioritize mobile layouts while keeping desktop equally polished.
- Use a dark theme exclusively. Do not add a light theme or theme switch.
- Use Roboto Mono from Google Fonts throughout, with a monospace fallback. The current scramble text on the timer, including localized loading and generation error/retry messages, uses Roboto Mono at weight 400 with normal style, -0.6px letter spacing and -0.7px word spacing. Preserve notation and actual spaces exactly; apply spacing only through CSS. Keep the Shuffle icon smaller than header icons while retaining its 44px interaction target.
- All interface text must be lowercase, brief and free of punctuation. Catalog cube model names and suggestions preserve their official uppercase spelling and punctuation as an explicit exception. Numeric time formatting and the explicitly requested animated dots are exceptions. This rule applies to site content, not documentation or code identifiers.
- Do not add a footer, slogan, decorative introductory text, or unnecessary permanent settings.
- Use the existing variables in `frontend/src/styles/main.css` under `:root` for colors and future elements. Keep palette changes centralized rather than introducing hard-coded colors in components.
- Current color roles are `--bs-body-bg`, `--bs-body-color`, `--muted`, `--accent`, `--ready`, `--holding`, `--panel-bg`, `--panel-border`, `--list-border`, and `--checkbox-bg`. Read the CSS for their current values.
- The header brand uses the nine-tiles logo to the left of a two-line wordmark in Roboto Mono and `--checkbox-bg`. Use responsive text sizing within a 44px brand height to preserve the header height and navigation spacing. Preserve existing namicubes storage keys and cookie names for compatibility.
- Use Lucide SVG icons from `frontend/src/icons.ts` for a consistent minimal style. Import only required icons.
- Navigation uses clock, graph and gear icons for timer, analysis and settings. Preserve accessible lowercase labels, keyboard behavior and at least 44px interaction targets.
- Active navigation uses `--accent`. The settings gear stays highlighted while its panel is open.
- Settings is a larger panel below the header, on the right on desktop, constrained to the available width on mobile. Outside clicks, including timer or analysis navigation, close it.
- Event selection, cube text, hidden timer preference and account controls belong in settings.
- A language dropdown below the account divider and above the username and sign out row supports English by default, Brazilian Portuguese displayed as portuguese, and Spanish. Apply translations immediately and persist the choice separately per account in this browser for future logins. Preferences do not synchronize across devices. Keep interface translations in `frontend/src/i18n.ts`; preserve user-entered labels, event identifiers and scramble notation. Sign out uses `--accent` on hover for mouse devices.
- Solve history opens from the history icon immediately to the left of settings. It is an expandable right sidebar on desktop and fills the viewport below the header on phones. It has its own scrollbar, includes every owned solve, and has no recent solves heading or total count. Do not display solve-number placeholders or empty columns.
- Recent solve rows show result and available labels, with a trash icon in `--muted` replacing the clock timestamp. Keep timestamps in the database for future analysis.
- Use `frontend/public/logo-concepts/03-nine-tiles.svg` for the header logo and SVG favicon. The old cube_logo3.png was removed. Public assets belong under `frontend/public`.

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
│   ├── public/logo-concepts/03-nine-tiles.svg
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

New accounts have `users.onboarding_acknowledged=false`. After successful login/account initialization, show the brief localized onboarding modal once. All dismissal routes persist acknowledgment through authenticated `POST /api/auth/onboarding` with `X-Namicubes-Account`; do not mark acknowledgment in local storage. Failed writes retain the modal and permit retry. Open settings acknowledges before opening settings. Keep modal focus contained and never show it alongside sign-out confirmation. Migration 0007 sets existing accounts to acknowledged while preserving records.

### login_sessions

Implemented server-side authentication sessions contain `token_hash`, `user_id` and `expires_at`. These are login sessions, not solve-grouping sessions. Never store raw session tokens in the database.

### cubes

Represents physical cubes owned or used by a user.

Suggested fields:
- id
- user_id
- name

Settings has an editable cube label field above a display-only model name field. Display selected model names as borderless text in `--checkbox-bg`, never as a text input. The handle searches full model names and aliases in the event's curated catalog under `cube-database/`. Explicit selection fills the full label and preferred alias and retains the model ID; typing after selection clears that ID. Unknown handles remain usable with a yellow warning and never modify the catalog. Owned cubes retain optional `catalog_event` and `catalog_model_id` references, validated independently on the backend. The same short handle can identify distinct catalog models or an unrecognized owned cube; never infer model identity from a handle or change existing cube associations automatically. Cube handles are trimmed and lowercased and reused within each account and catalog identity. New cube names and custom values are limited to 12 characters on the frontend; the backend caps submitted values to 12 characters after normalization. Prevent overlength typing and show a brief yellow message for rejected input. Settings commits preferences on close without an ok button, and changing the event clears the cube input. Preserve existing long names in other accounts rather than truncating stored records.

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
- custom (optional categorical text up to 12 characters)
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

The owner simplified phase 5 to one optional `solves.custom` text column. Edit it using the same pencil popup on the timer and history, alongside mutually exclusive +2 and dnf switches displayed side by side. Closing the editor saves changes and closes it after server confirmation; there is no ok button. Failed saves keep the editor open. Do not display custom values in solve rows or below the timer. Custom is available as an analytics filter and in the best custom card. Use ORM parameter binding for SQL safety and textContent or Option for UI rendering; never construct SQL or HTML from user input. Blank custom values become null; trim and lowercase categorical values, cap new submissions at 12 characters and reject control characters.

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

Show current notation in muted text near the top of the timer with a Shuffle replacement icon. Match the analytics content gap below the header using the shared --content-top-gap variable: 16px on desktop and zero additional spacing after the mobile header padding. Position scrambles outside the timer layout so notation never moves the number, hint or hidden dots. Long notation scrolls within its own area when needed. Preserve uppercase, primes, punctuation and whitespace as an explicit exception to interface text rules. Generation is asynchronous with account/event/request revision guards and retry feedback; never substitute random moves. A valid scramble is required before preparation and start while enabled. Keep the fixed 400ms hold. Capture an immutable scramble and event snapshot at actual timer start, immediately queue it on stop, then generate the next scramble. When disabled save null. Lock event/scramble controls during preparation and solving.

Migration 0004 adds nullable solves.scramble as SQL Text with a 4096-character validation/check limit, accommodating generated big-cube notation. Back up the local database before applying it; existing solves receive null and remain otherwise unchanged. Preserve notation exactly with parameterized ORM writes and textContent rendering. Older queued records without this field remain valid. Include scramble in duplicate-save consistency checks and reject scramble on the editing endpoint.

History adds Dice5 before pencil/trash only when a scramble exists. It opens a small read-only popup anchored to the actual clicked button. Outside click and Escape dismiss it. Coordinate it with settings/history/editor and preserve dirty editor save-on-close. Keep long notation wrapped and all icon targets at least 44px. Browser QA must use temporary databases and test generation, event changes, regeneration, timer snapshot saving, refresh and saved-scramble viewing on desktop/mobile. Verify the live backend schemas after restarting it.

## Hidden Timer Mode

The settings switch fixed tags appears on a separate row below hide timer and scrambles and defaults off. Persist only its enabled preference per account. When enabled, a confirmed custom-tag change in the timer/history editor for the active event seeds the next solves; clearing that tag clears the seed. Capture the seed at timer start and include custom in the immediate queued POST save. Never inherit penalties. Switching timer events, logout/account change or disabling the switch clears the in-memory seed, including stale asynchronous edit confirmations. Editing another event must not replace the active seed. Existing queued solves retain their captured tag and older requests without custom remain accepted. No schema migration is required because solves.custom already exists.

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

Overview remains the default. Compare shares its single event and date/range controls, including the anchored mobile custom-date popup, but keeps cube/custom multi-selections separate from overview. Both checkbox filters start with all available options selected. The all checkbox is checked for every option, indeterminate for a partial selection and unchecked for none; clicking an indeterminate checkbox selects everything. Empty selections mean no groups and show the existing empty chart. All-selected state includes newly available options automatically; partial selections retain only available matches, independently for each filter. Each checkbox popup matches its own filter control width and aligns directly below it, with the filters' 10px type, border and 4px radius. Use compact option/all rows (28px desktop and at least 44px mobile), internal scrolling, visually truncated full accessible labels, keyboard controls, outside-click and Escape dismissal; never overlap the adjacent filter. Cube selections apply only to the cube chart and custom selections only to the custom chart. Their options depend only on account/event/date scope, including DNF records; prune invalid selections independently on scope or solve changes. Neither list restricts event options or the other list. Reset comparison filters to all-selected and clear charts on account reset.

Compare has two horizontal boxplots and no number cards. Calculate from all matching solves using effective +2 times and excluding DNF from numerical distributions. Exclude missing labels only from the relevant chart. Retain DNF-only groups with no valid times. Sort comparison rows by ascending effective-time median, breaking ties alphabetically and placing groups without valid times last; option lists remain alphabetical. Quartiles use Hyndman-Fan type 7 linear interpolation at `(n - 1) p`; whiskers are extreme observations inside the inclusive `q1 - 1.5 IQR` and `q3 + 1.5 IQR` fences, with every outside observation rendered as an outlier. A single valid time has equal quartiles and whiskers. Each chart has its own shared time scale and vertical scrollbar with fixed title and time-axis numbers. Use 40px rows with names above on mobile and 44px rows with names to the left on desktop. Mobile compare alone uses 4px vertical panel insets, no title bottom margin and an 18px axis canvas with no reserved plot space above its ticks and 1px clearance from the scrolling rows; overview and desktop spacing remain unchanged. Truncate chart names visually only and retain full names in accessible canvas labels. Chart.js events stay disabled; native pointer hit testing opens a compact tooltip only over the filled q1–q3 box, with a minimum 8px horizontal hit area for tiny boxes. Tooltips show only median in seconds to two decimals and valid solve count excluding DNF. Desktop hover dismisses on leaving unless clicked to pin; touch taps toggle or replace. Only one tooltip is open across both charts. Outside pointer presses, Escape, chart scrolling, filters/data updates, resizing and view changes dismiss it. Keep tooltips anchored near the box and contained within its panel without changing chart spacing or adding selection highlights. Keep the category scrolling area keyboard accessible. Use the local Chart.js drawing plugin in `boxplot-chart.ts` without new dependencies; keep pure calculations in `boxplots.ts`. The overview hide-outliers preference does not remove comparison observations. Comparison colors are centralized as `--compare-cyan` (the existing `--accent` cyan), `--compare-violet` and `--compare-pink`. Each box has a solid fill; interpolate cyan #71DBDB through violet #A59BFA to pink #E58DBD across the displayed valid boxes independently for each median-sorted chart, using cyan for one box. DNF-only rows have no fill and consume no palette step. Compare uses equal desktop columns and equal-height stacked mobile panels, independent of overview proportions. Titles are cubes comparison and custom comparison, localized in all languages.

Overview/compare buttons keep independent filter state when switching views. Desktop keeps inline from/to fields; mobile replaces their slots with these buttons and uses an anchored calendar popup that remembers dates, supports reopening custom, preserves validation and closes once both dates form a valid range. Thin visible buttons retain a 44px mobile touch area.

The custom filter includes none (nenhuma in Portuguese) for solves with an empty tag, separate from all. The Portuguese solve-count card reads total while graph titles retain tempos. Mobile selected range labels must fit within 14 characters; keep the full names in the opened native dropdown. Above 100 valid times after filtering, display time and best as points without connecting lines and use point symbols for those legend entries. Keep ao5 and ao12 as lines and restore the connected time/best display when filters reduce the count to 100 or fewer.

Times-chart hover values use the timer's two-decimal formatting. Frame the y-axis with five-second boundaries where suitable (16–40.71 seconds gives bounds 15–45 and ticks 15, 25, 35, 45). All grid intervals must be equal: extend the upper bound to the next regular tick instead of appending a closer final tick. Smaller ranges may use finer intervals. Include finite visible times and rolling-average values when calculating bounds; DNF values must not affect them.

Choose times-axis bounds by comparing regular and half-step grids with at most five ticks. Prefer the smallest enclosing span, then the smallest maximum gap at either end; do not always anchor the lower edge before choosing the grid. The 17.60–35.24 example must use 10, 20, 30, 40 rather than 15, 25, 35, 45. Recalculate both bounds from current visible series immediately when hide outliers changes, preserving uniform intervals.

The hide outliers settings switch sits to the right of fixed tags, directly below scrambles. It defaults on and persists per account on settings close; preserve an explicitly saved off preference. For the times plot only, hide finite solve times above the current filtered mean plus three population standard deviations; retain lower outliers. Mask matching best points too, preserving original solve positions. Show the omitted count to the left of the DNF count using the existing outlier-count style. Statistics, rolling averages and saved data remain unchanged. The distribution always applies its existing two-sided outlier exclusion and is independent of this switch.

Distribution tooltips show interval percentages to one decimal place rather than absolute counts. The denominator includes every finite filtered time, including omitted outliers, and excludes DNF. The y-axis retains absolute counts, targets roughly four divisions and prefers multiples of ten when useful. Keep its ceiling within ten percent of the tallest bar; tight framing takes priority over round numbers.

The analytics interface should use the same underlying solve data rather than storing pre-grouped sessions.

There is intentionally NO solve-grouping session concept in the data model. Authentication login sessions are separate and already implemented.

### Date filtering

The analytics event selector always chooses one event and defaults to 3x3 after login or account change. Do not include an all-events option or mix event times in charts and basic statistics. The solve editor input is labeled custom tags; the dashboard filter and card continue to use custom.

Analytics cube/custom options are derived from solves in the selected event and date/hour range, including DNF. Each list applies the other selection but excludes its own selection. Validate current cube and custom independently within event/date scope, clearing only invalid selections to all; if both remain individually valid but their combination is empty, reset both to all. Never restrict the event dropdown by cube/custom or dates. Empty event/date scope yields only all for cube/custom and the existing empty dashboard. Offer none only when blank tags match the current cube and scope. Reconcile options and selections after save/edit/delete data updates, including while analytics is hidden and as rolling hour windows advance. Keep account-reset isolation, statistics rules and the existing layout.

Date filtering must be flexible.

Support:
- freely chosen start date
- freely chosen end date
- calendar/date picker UI
- optional convenience presets such as:
  - Today
  - Last 7 days
  - Last 30 days
  - Last 2 hours
  - Last 4 hours
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

Analytics now has 18 cards. Group 1: solves, mean, median, std dev, +2 count, ao5, ao12, ao50, ao100. Group 2: best, best ao5, best ao12, best ao50, best ao100, worst, fav event, best cube, best custom. Desktop shows two rows of nine; mobile shows one group of nine at a time with a right chevron that cycles without animation. Fit text labels inside their cards, reducing font size for longer names and retaining a full title. Date filters use inclusive local calendar days over UTC timestamps; presets include today, 7 and 30 days, all time, and rolling windows for the last 2 or 4 hours. Hour windows use exact timestamps and refresh every minute while analytics is visible. Event, cube and custom filters apply only to analytics; history remains the entire account. DNF count appears beside times in the same style as the distribution outlier count; there is no penalty filter.

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

## Cube catalog integration

`GET /api/cube-models?event=...` requires authentication and reads the separate curated JSON catalogs without writing to them. Follow `cube-database/EVENT_CATALOGS.md`. Events 3x3, 3bld, 3oh, 3mbld and fmc share the 3x3 catalog; 4bld and 5bld use 4x4 and 5x5. Clock has no catalog and must not receive unrelated suggestions. Search normalizes case, spaces and punctuation, ranks exact before prefix before contains, and displays at most eight full labels. Keep model selection in per-account settings and capture it with the handle at timer start so queued saves and retries preserve it. Migration 0006 adds optional references to owned cubes and preserves all existing solve links. Explicitly selecting a model links compatible same-label legacy records within the authenticated account and matching catalog event, preserving solve values. Ambiguous models and other events must not be merged. Older queued retries without a model ID remain valid after linking. Restore a model from an existing owned-cube association only when it is unique for the saved label and event. The local administrative command `python -m backend.reconcile_cubes username`, after a database backup, reconciles exact unambiguous legacy aliases for that account; it skips unknown and ambiguous labels. Browser checks must use an external computer browser, never the built-in browser, following the owner's crash-related request.
