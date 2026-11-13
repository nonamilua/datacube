# datacube

datacube is a clean, minimalistic, responsive web application for speedsolving and interactive analysis I built primarily for my own personal use and to share with friends. The frontend uses vanilla TypeScript, Vite and Bootstrap 5. The backend uses FastAPI, SQLModel, SQLite and Alembic. Accounts keep solve histories private, with event, cube and tag filters plus overview and comparison analytics. Node.js 20.19+ or 22.12+ and Python 3.12+ are required.

## Run locally

The language dropdown below the account divider in settings changes the interface immediately. English is the default; Brazilian Portuguese and Spanish are also available. Each account's choice is remembered for future logins in the same browser, without synchronizing across devices. Translations live in `frontend/src/i18n.ts`; user-entered names, event identifiers and scramble notation remain unchanged.

From the repository root, set up and start the backend:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
$env:DATACUBE_TURNSTILE_MODE = 'development'
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload --no-proxy-headers
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
- On desktop, closing Settings or History from the Timer page returns keyboard focus to the timer so Space is ready for the next solve.
- Open History from the header to browse recent solves. Scrolling the list loads older solves in batches of up to 50.
- The trash icon permanently deletes a saved solve. It replaces the displayed clock time; UTC timestamps remain stored for analysis. The row disappears after the server confirms deletion, and the list refills from older solves. Unsaved results cannot be deleted while their save is pending.

Solves are sent immediately to the backend and persist in `backend/solves.db`. Analytics uses the full account dataset. Durations use integer milliseconds and timestamps are normalized to UTC, then displayed in local time. Pending saves are kept in browser local storage separately for each account and retried every 15 seconds or when the connection returns. Stable UUIDs prevent duplicate records on retry. Avoid clearing browser storage while saves are pending. Event, cube and hidden-timer preferences persist in this browser separately for each account. They do not yet synchronize between devices.

## Accounts and labels

Event icons by Devin Corr-Robinett and the cubing/icons contributors, used under the MIT License. Source: [cubing/icons](https://github.com/cubing/icons). The settings event icon uses the reference assets mapped in `frontend/public/event-icons/manifest.json`; the original license and recorded source information remain in `reference/LICENSE` and `reference/SOURCE.json`.

New accounts receive a one-time onboarding prompt after successful account initialization. Later, Escape, backdrop dismissal and open settings acknowledge it through authenticated `POST /api/auth/onboarding`, with the stale-account guard header. The acknowledgment is stored on users and persists across browsers/devices; failed writes keep the prompt open for retry. Migration 0007 marks existing accounts as acknowledged without changing their data. The modal uses the sign-out confirmation styling and focus handling, and never opens alongside it.

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

Datacube defaults to **50,000 saved solves per account**. Set `DATACUBE_SOLVE_LIMIT` to a positive integer in the backend environment and restart the backend to change it. For example, in PowerShell run `$env:DATACUBE_SOLVE_LIMIT = '75000'` before starting Uvicorn. Use the same value across backend processes and when running the legacy import command.

Timer saves, csTimer imports, native restores, and legacy assignment all check capacity in the same transaction as the write. Only new additions count. An import that would exceed the limit is rejected as a whole. You can read, edit, export, or delete saved solves even if a reduced limit leaves an account over quota. Timer saves blocked by the limit stay queued on the device and retry automatically after you free space in history. After freeing enough space for a batch, confirm the import again.

### Signup and bulk request limits

Set positive integers in the backend environment before starting the server.

| Variable | Default | Applies to |
| --- | ---: | --- |
| `DATACUBE_BULK_ACCOUNT_PER_MINUTE` | 6 | Shared per-account requests for csTimer import, native restore preview and confirmation, and export |
| `DATACUBE_BULK_IP_PER_MINUTE` | 30 | Shared requests across those operations from one client IP |
| `DATACUBE_SIGNUP_IP_PER_MINUTE` | 5 | Signup attempts from one client IP |
| `DATACUBE_BULK_CONCURRENT` | 2 | Bulk operations in progress across the worker |

Each account can have one bulk operation in progress. Limits use a rolling 60-second window and count admitted requests, including ones that later fail validation. Rate and concurrency rejections return `429` with `Retry-After` in seconds. When the only restriction is a busy slot, the response suggests retrying in one second. Timer saves have their own storage quota and run independently of these bulk limits.

Datacube uses the connection IP by default. Set `DATACUBE_TRUSTED_PROXIES` to a comma-separated list of explicit proxy IP addresses or CIDRs to accept `X-Forwarded-For` from those peers. Use proxies that replace that header or append the actual upstream IP. Datacube walks the chain from the connection side to the nearest untrusted IP. Start Uvicorn with `--no-proxy-headers` so Datacube receives the original connection address for this check. With the default empty trust list, clients connecting through the same proxy share its IP limits.

Counters and in-progress slots live in memory **per server process** and reset on restart. A single worker enforces the listed limits across the server. Each additional worker has its own counters and slots, so use shared atomic counters and concurrency leases before running multiple workers or instances if these limits must apply across them.

### Turnstile registration

`DATACUBE_TURNSTILE_MODE=development` uses Cloudflare's visible test widget and test secret. Open the frontend on `localhost` or `127.0.0.1` to register locally. Development mode requires a loopback connection and a loopback hostname. For isolated offline tests, explicitly set `DATACUBE_TURNSTILE_MODE=off`.

For deployment, create a **Managed** Turnstile widget in Cloudflare and authorize the exact public hostname that serves the signup form. Set these environment variables on the backend and apply migration `0009` with `alembic upgrade head` before restarting the app.

| Variable | Value |
| --- | --- |
| `DATACUBE_TURNSTILE_MODE` | `production`, the default |
| `DATACUBE_TURNSTILE_SITE_KEY` | The widget's public site key |
| `DATACUBE_TURNSTILE_SECRET_KEY` | The same widget's secret, stored only in the backend environment |
| `DATACUBE_TURNSTILE_HOSTNAME` | The signup hostname, for example `datacube.example.com`, without scheme, port or path |

Datacube fetches the public site key at runtime. The backend verifies every registration token with Siteverify, checks the production hostname and `register` action, and records a temporary token hash so a challenge can create only one account even across workers. Missing or invalid configuration and verification outages block registration. Sign-in uses the existing credentials flow. When configuring a Content Security Policy, allow scripts and frames from `https://challenges.cloudflare.com` for the widget. [Local test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) · [Hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/) · [Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

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

Overview is the default and retains the existing cards and plots. Compare shares the event and date controls but has independent cube and custom checkbox selections. Both filters start with all available options checked. All is a tri-state select-all checkbox: checked for every option, indeterminate for some and unchecked for none. Clicking it selects everything or clears everything; an indeterminate click selects everything. No selections means no groups and displays the empty chart. All-selected filters include new options automatically; partial selections retain only available matches. Selections within one field use OR. Cube selections affect only the cube plot, custom selections only the custom plot. Both option lists use the selected account, event and date/hour range, including DNF records, without cross-filtering. Scope changes and solve save/edit/delete updates remove invalid selections independently. Switching views preserves each view's selections; account reset clears comparison state. The mobile custom-date popup opens over the filters, retains chosen dates and validation, and closes once both dates form a valid range.

Compare renders horizontal boxplots for cubes and custom tags, sorted by ascending effective-time median with alphabetical ties and groups without valid times last, without cards. All matching observations participate in calculations. +2 adds two seconds to the effective time while raw duration stays unchanged; DNF is excluded numerically. Missing labels are excluded only from the corresponding chart. DNF-only groups remain selectable and display no valid times. Each box spans q1–q3 with its median marked; whiskers reach the most extreme observations within inclusive 1.5 IQR fences and observations outside them remain visible as small points. The overview hide-outliers switch does not affect these plots.

Quartiles use **Hyndman-Fan type 7**: sort valid millisecond durations and linearly interpolate at `(n - 1) p` for p = 0.25, 0.5 and 0.75. One observation gives equal quartiles and whiskers; identical samples render a narrow mark. Calculations live in `frontend/src/analytics/boxplots.ts` and are tested independently. The existing Chart.js instance is extended by a small local drawing plugin in `boxplot-chart.ts`, using its [documented plugin hooks](https://www.chartjs.org/docs/latest/developers/plugins.html); no package or schema change is needed.

Each comparison plot uses a shared horizontal time scale across all its groups. Titles and time ticks stay outside its own scrolling rows. Phone rows are 40px with the name above; desktop rows are 44px with the name on the left. Mobile compare alone uses 4px vertical panel insets, no title bottom margin and an 18px axis canvas with no reserved plot space above its ticks and 1px clearance from the scrolling rows; overview and desktop spacing remain unchanged. Names are truncated only visually and retained in accessible chart labels. Only the filled q1–q3 box activates a small panel-contained tooltip showing median to two decimals and valid solve count excluding DNF. Whiskers, outliers, labels and empty space are inactive; tiny boxes get a limited 8px horizontal hit area. Desktop hover closes on leaving, clicking pins, and touch tapping toggles or replaces the tooltip. Only one is open across both charts; outside presses, Escape, scrolling, filters/data updates, resizing and view changes dismiss it. No selection effects are added; scrolling remains available, including from the keyboard. Checkbox popups match their filter control width and sit below it without overlapping the adjacent filter. They use 10px text, matching borders and 4px corners, compact option/all rows (28px desktop and at least 44px mobile), internal scrolling and visually truncated full accessible labels. The all checkbox selects or clears every option; outside-click and Escape dismiss the popup. Each box has a solid fill; the central cyan/violet/pink palette progresses across displayed valid boxes in median order independently for each chart, with cyan for one box. DNF-only rows consume no palette step. Compare has equal desktop columns and equal-height stacked panels on mobile. Titles are cubes comparison and custom comparison, translated in all supported languages.

Comparison checks cover 1, 3, 6 and 12 groups at 373 × 723 and 1366 × 900, long legacy labels, empty/DNF-only groups, box-only hover/click/touch tooltips, tiny-box tolerance and tooltip dismissal/containment, fixed axes during independent scrolling, view state, date validation, translations and account reset. Browser checks use Chrome and temporary fixture data without changing stored solves.

The event filter requires one event and defaults to 3x3; there is no all-events option. The solve editor labels the input custom tags, while the analytics filter remains custom. Its none option (nenhuma in Portuguese) selects empty tags. The Portuguese solve-count card reads total; chart copy still uses tempos. On mobile, selected range labels use abbreviations of at most 14 characters while the native dropdown retains full option names.

Cube/custom dropdowns offer only choices used by solves in the selected event and date/hour range, including DNF. They narrow each other; each dropdown ignores its own selection when finding options. Event choices remain complete and independent. Event/date changes and solve updates retain each still-valid selection, reset invalid selections independently to all, or reset both if each is individually valid but their combination has no results. With no scoped solves, both lists contain only all and the dashboard shows its existing empty state. None is offered only when blank tags match the current scope and cube. Saved, edited and deleted solves refresh these choices without altering statistics or account isolation.

The fixed tags switch below hide timer and scrambles reuses the last custom tag successfully changed in the editor for the currently selected timer event. It defaults off and remembers the switch preference per account. The tag itself stays in memory and clears on event change, logout/account change or disabling the switch. Clearing an edited tag also clears the remembered value; edits to other events do not affect it. Each solve captures its inherited tag at timer start and saves it through the normal persistent retry queue, without inheriting penalties. The existing custom column is used; no migration is needed. Initial solve requests accept the same normalized, lowercase, 12-character custom values as the editor.

Hide outliers sits to the right of fixed tags, directly below scrambles. It defaults on for accounts without a saved preference and retains an explicitly saved off preference. It hides only times above the filtered mean plus three population standard deviations in the times plot, including corresponding best markers, and shows their count to the left of the DNF count. Fast lower outliers stay visible. Statistics, rolling averages and saved solves are unchanged. The distribution retains its independent, always-enabled two-sided outlier exclusion. Times-plot grid lines use equal intervals, extending the upper bound to the next regular tick when needed.

The times y-axis compares regular and half-step grids and chooses the tightest enclosing range, breaking ties by balancing empty space at the two ends. For 17.60–35.24 seconds it uses 10, 20, 30, 40; for 16–40.71 it uses 15, 25, 35, 45. Toggling hide outliers immediately recalculates the displayed bounds using the visible times, best points and unchanged rolling averages.

The 18 Overview cards show solve count, mean, median, standard deviation, +2 count, current ao5/ao12/ao50/ao100, best time, best ao5/ao12/ao50/ao100, worst time, favorite event, best cube and best custom. Desktop shows two rows of nine. On mobile, the right chevron cycles through current statistics, best statistics, and the activity heatmap. The statistics, Times plot and Distribution plot use the local date, event, cube and tag filters. Date presets include today, 7 and 30 days, plus all time and rolling windows for the last 2 or 4 hours. Hour windows refresh every minute while analytics is visible and use exact timestamps rather than calendar-day boundaries. An end date includes the entire local day. Filters operate on raw UTC timestamps and do not create sessions.

The **activity · overall** heatmap appears above Distribution on desktop and on the third carousel page on mobile. It counts recorded solves, including DNFs, across all events by local calendar day and is independent of the Overview filters. Each column is a week, Monday through Sunday, with the newest week on the right. Days with zero solves use a neutral fill. The four activity bands are 1–4, 5–19, 20–49, and 50+ solves. Hover, tap, or use the arrow keys within the grid to see the date and exact solve count.

Raw duration is preserved. Calculations add 2000 milliseconds for +2. DNF results count toward solves and appear beside the times chart; they are excluded from basic statistics and the histogram. Averages trim five percent from each end rounded up: one fastest/slowest for ao5/ao12, three for ao50 and five for ao100. Any remaining DNF produces a DNF average. Missing statistics remain blank until enough results exist. Rolling averages use chronological solves within the selected filters. Favorite event uses the most filtered solves; best cube and best custom compare effective-time medians within the selected event or favorite event.

Pencil controls on completed times and history open a popup with side-by-side penalty switches and an optional custom value. Closing the popup saves the changes; failed saves keep it open. Settings also commits preferences on close, without an ok button; changing events clears the cube input. Both inputs prevent typing beyond 12 characters, and the backend trims and lowercases submitted values and caps them at 12 characters. Existing stored names are not shortened automatically. `PATCH /api/solves/{id}` accepts penalty and an optional custom value; omit custom to preserve it, or send null to clear it. Ownership always comes from the server session. ORM parameter binding treats quotes and SQL-like text as literal values rather than executable SQL. The custom value is not displayed in solve rows.

Favorite event ignores event selection while retaining the other filters. Best cube ignores cube selection, including when deriving its favorite-event fallback, and compares all eligible cubes in the selected event. Date and custom filters still apply. Best custom follows its existing filters.

The Times plot shows individual times, ao5, ao12, ao50, ao100 and personal bests in seconds. Above 100 valid plotted times, individual times and bests appear as dots and diamonds. The rolling averages remain lines. Use the legend to enable ao50 and ao100, or to show the individual times when they start hidden above 1,000 valid plotted times. Large charts retain the fastest and slowest individual times in each consecutive group and sample the rolling averages at evenly spaced solve positions. The target grows from about 600 positions on narrow charts to 1,200 on wide charts, with additional positions for any personal bests the sample missed. The tooltip looks up the time and averages at the same original solve position, even if one of those points was skipped in the drawing. Statistics still use every filtered solve.

The histogram excludes times more than three population standard deviations from the mean, then sizes contiguous intervals using the remaining mean, standard deviation and sample size. Sparse samples use fewer bins; seven bins are available only with at least 50 plotted times. The omitted count appears as a brief outlier label on desktop and mobile, with full context retained in the chart accessibility description. Charts use the existing palette and Roboto Mono. Chart.js is registered with only the line and bar components needed by the dashboard.

The history icon to the left of settings opens a paginated list for the current account. `GET /api/solves/history` returns up to 50 solves, ordered by UTC timestamp descending and ID descending, with a `next_cursor` containing `started_at` and `id`. Pass those values as `cursor_started_at` and `cursor_id` for the next page. Ownership always comes from the authenticated session. Account initialization warms a latest-50 in-memory cache; scrolling loads older pages without replacing existing action controls. Failed requests retain rows and offer retry.

History's fixed filter header selects a single local calendar day and sits above the scrolling solve list, so the scrollbar starts below its divider. Touch drags and wheel input over the header do not scroll the list or page. The browser sends its local midnight and next local midnight as the inclusive `started_from` and exclusive `started_before` UTC bounds, including DST changes. Closing history clears the date, scroll position and older pages and invalidates pending reads. Reopening shows the cached latest overall solves. Account changes clear the cache. Confirmed edits/deletes update affected rows and the cache, with at most a first-page refresh. Pending saves retain their existing account-specific queue and unavailable edit/delete behavior. History has its own scrollbar, appears as a right sidebar on desktop, and fills the viewport below the header on phones. Settings uses the same phone layout. Opening either panel closes the other; outside clicks and Escape close them. Edit, delete and history dates work independently of analytics filters.

Analytics still requests `GET /api/solves/all` during synchronization and calculates statistics from the complete account dataset. This remains a separate performance concern; paginated history never supplies a partial dataset to analytics.

Analytics keeps result invalidation separate from filter state. Confirmed data changes mark both views stale; while the timer is active, statistics, chart updates and option reconciliation are deferred. Reopening reconciles and updates only the active overview/compare view, retaining its event, dates and selections. The inactive view waits until selected. Relative ranges use the current time on return and retain visible minute refreshes. Account changes clear selections and cached results; stale account responses are ignored. Returning to analytics does not trigger another full-history request or recreate charts.

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

## Cube models and handles

Settings has a 12-character cube label input above the selected model name. Model names appear as borderless text in the checkbox color rather than as an editable input. Typing searches event-specific full names and aliases from the curated `cube-database/` catalogs. Select a suggestion using mouse, touch or arrow keys and Enter to fill the model and preferred handle. Editing the handle clears the model selection. A yellow warning identifies an unrecognized handle; custom handles remain usable and do not create catalog entries. Full catalog names preserve capitalization and wrap on narrow screens.

Selections persist per account in this browser. Model IDs are captured with each solve and retained in offline retries. The backend verifies the selected model against the solve event before storing optional `catalog_event` and `catalog_model_id` references on the owned cube. Owned cubes and the read-only shared catalogs remain separate. Different catalog models may share a handle without merging their solve histories. Existing cube records remain unassociated until explicitly selected.

The authenticated catalog endpoint is `GET /api/cube-models?event=3x3`. 3bld, 3oh, 3mbld and fmc share 3x3; 4bld and 5bld use their matching big-cube catalogs. Unsupported puzzle types show no unrelated suggestions. Restart the backend after editing catalog JSON because models are cached in memory. Apply migration 0006 after backing up the local database. It adds model references and preserves cube IDs and solve relationships. See `cube-database/EVENT_CATALOGS.md` for the catalog contract.

### Linking legacy cube records

Selecting a catalog model reuses or merges compatible legacy cubes with the same label in the authenticated account and matching puzzle catalog. Only cube references change; solve IDs, times, penalties, timestamps, custom tags and scrambles remain intact. Different catalog models and unrelated events stay separate. Retry requests from older browser queues remain valid after linking. Existing owned-cube model associations restore when unique for the saved label and event.

For an explicit local migration, back up the database and run `.venv/Scripts/python.exe -m backend.reconcile_cubes username`. This matches exact, unambiguous catalog aliases within that account and the solve event. It skips shared aliases, unknown names and records without a compatible event.

The header uses the nine-tiles logo and a two-line datacube wordmark in the existing violet and Roboto Mono. Portuguese displays dados and cubos with an ampersand beside the two lines. The same SVG is the favicon. Existing browser storage keys and session cookie names retain their namicubes identifiers for compatibility with saved preferences, pending solves and sessions.

### Native backup and restore

Use **settings → export → download** to save a versioned `datacube-backup-<username>.json` containing every saved solve for the signed-in account. The v1 format contains `events`, `cubes` and `solves`. A solve's `event_ref` and `cube_ref` are zero-based indexes into the file's lists or `null` for no association. Cubes retain their exact handles and catalog references. Solves retain integer milliseconds, UTC timestamps at stored precision, penalties, tags and exact scramble text, including empty values. Backups contain solve data and its associations only.

Choose a Datacube file using the existing import button. Import detects the format and takes it directly to review, with counts for solves to add and solves skipped because their IDs already exist. Restore validates the whole file and adds missing IDs in one transaction. Importing into the same account fills in missing solves. Existing solves and their associations stay as saved, even when the file changes or omits them. Importing an externally edited file into a fresh account creates a separate copy with the edited values and leaves the source account intact.

The same portable ID follows a solve between accounts and subsequent exports. Different IDs can share the same time and timestamp. New solves use the event and cube specified in the file, reusing exact matching associations when available. Native backups can be exported and restored as one file, including above 10 MiB. The byte and solve-count limits below apply to csTimer.

Migration `0008` adds portable solve IDs. Back up the local database before running `alembic upgrade head` on an existing installation. The migration retains row IDs and solve values. Older deterministic import row IDs receive independent portable IDs. CSV and export editing are outside the current scope.

### csTimer import

The csTimer compatibility path accepts JSON backup contents in `.txt` or `.json` files up to **10 MiB**, with at most **50,000 solves across all sessions**. The frontend parser and backend independently enforce these limits. Every nonempty `sessionN` is discovered dynamically; cached statistics and global preferences are ignored. A localized file button replaces the browser's language-dependent file control. Each step has one fixed heading above internally scrolling content; the filename appears only during file selection.

Choose a file, configure selected sessions, review, then explicitly import. Sessions start collapsed and included. Expand one or more with the plus buttons to change inclusion or assignments. Each session gets one required event and optional cube/catalog model and 12-character tag. The explicit scramble-setting mapping reads session `opt.scrType` or legacy `scr`; unknown settings require a choice. No event is inferred from notation. All assignments apply to every solve in that session; mixed events must be separated in csTimer first. Raw milliseconds, penalties (0, 2000, -1) and original Unix-second timestamps converted to UTC are retained; comments, scrambles and other record extensions are discarded. Invalid records reject the file without a partial import. Session metadata may be absent. Cube and tag assignments stay independent of timer preferences and fixed tags.

Authenticated `POST /api/solves/import` accepts normalized selected sessions with `X-Namicubes-Request` and the current `X-Namicubes-Account`. Ownership comes from the server session; caller-supplied user, category and solve IDs are rejected. Events, catalog references, penalties, plain-text labels, duration and aware timestamps are validated before saving. All selected sessions are committed together in one transaction; failures roll back cubes, events and solves together. No schema migration or stored solve-grouping sessions are needed.

Overlapping backups match existing owned solves by event, original UTC timestamp and raw duration, preserving existing IDs, cube assignments, penalties and tags. Repeated identical records retain their multiplicity across selected sessions. New import UUIDs are deterministic per account, event, timestamp, raw duration and occurrence; concurrent imports and lost-response retries cannot create extra copies. The result reports imported and skipped counts. Explicitly selected catalog models reuse an existing owned model association, preferring its matching label and then its oldest association. Compatible same-label legacy cubes use the existing reconciliation rules; unknown labels never infer a catalog identity. Dashboard filters therefore use the saved cube ID instead of creating an additional label for that selected model.

Drafts remain in memory and survive back/next navigation and failed saves. Escape/backdrop dismissal is deferred while saving; afterwards dismissal discards the draft and restores focus to settings. An account reset aborts the request and ignores stale responses. A confirmed import refreshes owned solves and organization data through the existing synchronization path, retaining analytics filters and deferred rendering. Parser, persistence, rollback, overlap, retry, concurrent import and ownership tests use synthetic data only. Format reference: [csTimer solve records and session metadata](https://github.com/cs0x7f/cstimer/blob/master/src/js/stats/stats.js) and [backup export](https://github.com/cs0x7f/cstimer/blob/master/src/js/export.js).
