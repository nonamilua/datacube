# namicubes

namicubes is a clean, minimalistic, responsive web application for speedsolving and interactive analysis I built primarily for my own personal use and to share with friends. The frontend uses vanilla TypeScript, Vite and Bootstrap 5. The backend uses FastAPI, SQLModel, SQLite and Alembic. Phase 3 adds accounts, private solve collections, event labels and free-text cube names. Node.js 20.19+ or 22.12+ and Python 3.12+ are required.

## Run locally

From the repository root, set up and start the backend:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

In another terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173).

To test on a phone connected to the same Wi-Fi, keep the backend running and use `npm run dev:lan` for the frontend. Open the Network URL printed by Vite on the phone. Allow Node.js through Windows Firewall on private networks if prompted. Vite forwards API requests to the backend, so port 8000 stays bound to localhost. Sign in with the same account on your phone and PC to access the same solves.

```powershell
npm run build
npm test
```

## Controls

- Hold Space for 400 ms, then release when green to start.
- Press an ordinary key to stop. Modifier keys and browser shortcuts are ignored.
- On a touchscreen or with a mouse, hold the central timer area, release to start, and press again to stop.
- Releasing too early cancels preparation. Losing focus cancels preparation; an active solve continues timing.
- Open settings to hide the live time. The preparation delay is fixed at 400 ms.
- Recent solves appear only on the analysis tab; the timer screen stays minimal.
- The trash icon permanently deletes a saved solve. It replaces the displayed clock time; UTC timestamps remain stored for analysis. The row disappears after the server confirms deletion, and the list refills from older solves. Unsaved results cannot be deleted while their save is pending.

Solves are sent immediately to the backend and persist in `backend/solves.db`. The analysis tab loads the latest ten results and the total solve count on refresh. Durations use integer milliseconds and timestamps are normalized to UTC, then displayed in local time. Pending saves are kept in browser local storage separately for each account and retried every 15 seconds or when the connection returns. Stable UUIDs prevent duplicate records on retry. Avoid clearing browser storage while saves are pending. Event, cube and hidden-timer preferences persist in this browser separately for each account. They do not yet synchronize between devices.

## Accounts and labels

Create an account from the sign-in screen. Usernames contain 3 to 32 letters, digits or underscores and are case insensitive. Passwords contain 8 to 128 characters and are hashed with Argon2id. Server-side sessions last seven days; cookies are HttpOnly and SameSite strict. Sign out invalidates the server session. The backend derives data ownership from that session and rejects another user's event IDs. The account header on solve writes only checks for stale browser sessions; it cannot select an owner.

Settings opens below the header as a wider panel on the right. Select one event and type any cube name; previously used names appear as suggestions. Cube records contain a name only, with no separate brand or model fields. Names are trimmed and lowercased. The chosen labels are saved with every solve. Controls cannot change during a solve.

All 17 official WCA events are available: 2x2 through 7x7, 3bld, 4bld, 5bld, 3oh, clock, megaminx, pyraminx, skewb, square 1, fmc and 3mbld. FTO is included as an extra requested label. The event list was checked against [WCA regulation 9b](https://www.worldcubeassociation.org/regulations/#9b). These are labels for timed practice; official FMC move-count scoring and multi-blind scoring are not implemented.

The phase 3 migration preserves older solves without assigning them to the first registrant. Register your intended account, then explicitly import unowned phase 2 solves from the repository root:

```powershell
.\.venv\Scripts\python.exe -m backend.import_legacy your_username
```

This local administrative command assigns only records that have no owner. Existing owned solves are unaffected. A pre-migration backup is stored locally as `backend/solves-phase2-backup.db`. Any phase 2 browser queue remains untouched under its old storage key and is not automatically assigned to an account.

For public deployment, use HTTPS and set `COOKIE_SECURE=true` before starting the backend. Plain HTTP remains supported for trusted local Wi-Fi development. Mutating API requests must include `X-Namicubes-Request: 1`; no cross-origin access is enabled.

Vite forwards `/api` to port 8000. Restart Vite after changing its configuration. For hosting later, route `/api` to FastAPI on the same origin; the frontend build does not run the backend. Set `DATABASE_URL` to override the database connection; a future PostgreSQL deployment also needs a PostgreSQL driver. The default SQLite path is resolved relative to the backend source, independent of the terminal directory.

API endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, and `GET /api/organization`. Authenticated `POST /api/solves` saves duration, timestamp, penalty, optional event ID and cube name with a client-generated UUID; also send `X-Namicubes-Account` matching the signed-in account ID to guard against account switches in other tabs. `GET /api/solves?limit=10&offset=0` returns only the signed-in user's newest results and total count. Penalties support `OK`, `+2` and `DNF`. `PATCH /api/solves/{id}` updates an owned solve penalty using the same request and account headers. Pencil controls are available below a completed timer and in history. Interactive API documentation is at http://127.0.0.1:8000/docs.

`DELETE /api/solves/{id}` permanently removes only a solve belonging to the authenticated user. It requires the same request and account headers as saving. Missing and other users' solves both return 404. Cube and event records remain available for reuse.

Run backend tests from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests
```

Tests use temporary databases and apply the real migration. For later schema changes, create an Alembic revision, review it, then run `alembic upgrade head` using the virtual environment. Back up the SQLite file before migrating existing data.

The interface prioritizes mobile, uses a dark theme only, and loads Roboto Mono from Google Fonts (with a monospace fallback when offline). Keep future screens minimal: omit decorative slogans and footers, keep solve history in its header panel, and avoid unnecessary settings.

## Optional scrambles

Enable scrambles beside hide timer in settings. This defaults off and saves per account in this browser when settings closes. The timer shows muted notation with a Shuffle button for replacement. Generation runs asynchronously using [cubing.js](https://js.cubing.net/cubing/scramble/) 0.63.8 and its scramble API for all 18 events, including dedicated blindfolded/FMC identifiers and FTO. Automatic prefetching is disabled; scrambles generate on enable, event change, manual replacement and after stopping a solve. A loading or failed scramble blocks preparation until generation succeeds; the Shuffle button retries failures. Controls lock during preparation and solving.

The 333mbf API takes no cube count and generates one oriented 3x3 scramble. This app records one scramble per timed practice solve; multi-cube batches and scoring are not implemented.

At start, capture the displayed scramble and event. Queue that snapshot immediately on stop, then prepare the next scramble. With scrambles off, save null. Migration 0004 adds a nullable SQL Text scramble column, limited to 4096 characters to accommodate long big-cube notation. Existing solves receive null; older pending queues remain compatible. Scramble notation retains case, punctuation and whitespace, and cannot be edited through PATCH. Duplicate-save retries must match their original scramble. The Dice5 history button appears only for solves with a saved scramble and opens a read-only popup; click outside or press Escape to close it.

Apply migrations with the virtual environment after backing up the local database. Confirm the running backend exposes scramble in SolveCreate and SolveRead, but not SolveUpdate, at /openapi.json. Source modules: frontend/src/scrambles.ts, timer/controls.ts, and main.ts. The cubing modules load only when scrambles are enabled; the build bundles their worker and puzzle resources for offline local generation after loading.

Vite emits ES module workers and keeps the preload helper separate from the application entry point so worker imports cannot execute DOM-dependent application code. Preserve these settings when changing the build configuration and check generation in the browser as well as Node.

## Analytics

The event filter requires one event and defaults to 3x3; there is no all-events option. The solve editor labels the input custom tags, while the analytics filter remains custom.

The analysis tab has 18 cards: solves, mean, median, standard deviation, +2 count, current ao5/ao12/ao50/ao100, best time, best ao5/ao12/ao50/ao100, worst time, favorite event, best cube and best custom. Desktop shows two rows of nine; mobile switches between groups of nine using the right chevron. Filter by local calendar dates, event, cube and custom. Date presets include today, 7, 30 and 90 days, plus all time. An end date includes the entire local day. Filters operate on raw UTC timestamps and do not create sessions.

Raw duration is preserved. Calculations add 2000 milliseconds for +2. DNF results count toward solves and appear beside the times chart; they are excluded from basic statistics and the histogram. Averages trim five percent from each end rounded up: one fastest/slowest for ao5/ao12, three for ao50 and five for ao100. Any remaining DNF produces a DNF average. Missing statistics remain blank until enough results exist. Rolling averages use chronological solves within the selected filters. Favorite event uses the most filtered solves; best cube and best custom compare effective-time medians within the selected event or favorite event.

Pencil controls on completed times and history open a popup with side-by-side penalty switches and an optional custom value. Closing the popup saves the changes; failed saves keep it open. Settings also commits preferences on close, without an ok button; changing events clears the cube input. Both inputs prevent typing beyond 10 characters, and the backend trims and lowercases submitted values and caps them at 10 characters. Existing stored names are not shortened automatically. `PATCH /api/solves/{id}` accepts penalty and an optional custom value; omit custom to preserve it, or send null to clear it. Ownership always comes from the server session. ORM parameter binding treats quotes and SQL-like text as literal values rather than executable SQL. The custom value is not displayed in solve rows.

Favorite event ignores event selection while retaining the other filters. Best cube ignores cube selection, including when deriving its favorite-event fallback, and compares all eligible cubes in the selected event. Date and custom filters still apply. Best custom follows its existing filters.

The line chart shows times, ao5, ao12 and best-time progression in seconds. Best points appear only when a new minimum is achieved within the current filters. Large line series are sampled to roughly 600 points, retaining every best point, while statistics use every solve. The histogram excludes times more than three population standard deviations from the mean, then sizes contiguous intervals using the remaining mean, standard deviation and sample size. Sparse samples use fewer bins; seven bins are available only with at least 50 plotted times. The omitted count appears as a brief outlier label on desktop and mobile, with full context retained in the chart accessibility description. Charts use the existing palette and Roboto Mono. Chart.js is registered with only the line and bar components needed by the dashboard.

The history icon to the left of settings opens every solve for the current account through `GET /api/solves/all`. The endpoint determines ownership from the authenticated session. History has its own scrollbar, appears as a right sidebar on desktop, and fills the viewport below the header on phones. Settings uses the same phone layout. Opening either panel closes the other; outside clicks and Escape close them. Edit and delete work independently of the analytics filters.

The dashboard fits a normal desktop viewport and a portrait phone viewport such as 375 by 812 without page scrolling. On shorter phone screens the dashboard itself can scroll to keep controls and charts readable. The browser page does not need to scroll through history.

## Code layout

- `frontend/src/timer/timer.ts`: explicit timer states and monotonic duration measurement.
- `frontend/src/timer/controls.ts`: keyboard and Pointer Events, including cancellation and input ownership.
- `frontend/src/main.ts`: display, recent results and save synchronization. Animation frames update the display only.
- `frontend/src/api/api.ts`: API requests and the pending save queue.
- `frontend/src/accounts.ts`: sign-in, registration and sign-out interface.
- `frontend/src/icons.ts`: the imported [Lucide](https://lucide.dev/guide/lucide) SVG icons. Add future icons here to maintain consistent strokes and sizing; unused icons are excluded from the production bundle. Navigation and trash controls retain accessible labels and 44px interaction targets.
- `backend/main.py`: FastAPI application.
- `backend/database.py`: database engine and per-request sessions.
- `backend/models/solve.py`: solve table and request/response validation.
- `backend/routes/solves.py`: save and list endpoints.
- `backend/models/account.py`: users, sessions, cubes and event categories.
- `backend/routes/auth.py`: account endpoints.
- `backend/services/auth.py`: password hashing and session validation.
- `backend/routes/organization.py`: per-user event and cube options.
- `migrations/`: versioned database schema changes.
- `frontend/src/styles/main.css`: responsive visual styling layered over Bootstrap.

Keep interface text lowercase, brief and free of punctuation. Use the variables in CSS `:root` for future visual additions.
