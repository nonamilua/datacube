# namicubes

namicubes is a clean, minimalistic, responsive web application for speedsolving and interactive analysis I built primarily for my own personal use and to share with friends. The frontend uses vanilla TypeScript, Vite and Bootstrap 5. Phase 2 adds FastAPI, SQLModel, SQLite and Alembic. Node.js 20.19+ or 22.12+ and Python 3.12+ are required.

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

To test on a phone connected to the same Wi-Fi, keep the backend running and use `npm run dev:lan` for the frontend. Open the Network URL printed by Vite on the phone. Allow Node.js through Windows Firewall on private networks if prompted. Vite forwards API requests to the backend, so port 8000 stays bound to localhost. Devices using this development server share the same solve collection until phase 3 adds authentication.

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

Solves are sent immediately to the backend and persist in `backend/solves.db`. The analysis tab loads the latest ten results and the total solve count on refresh. Durations use integer milliseconds and timestamps are normalized to UTC, then displayed in local time. Pending saves are kept in browser local storage and retried every 15 seconds or when the connection returns. Stable UUIDs prevent duplicate records on retry. Avoid clearing browser storage while saves are pending. Settings still reset on refresh.

This phase is for local development with one shared solve collection. Authentication, users and cube/category ownership come in phase 3; the API does not accept a browser-supplied user id. User ownership columns will be added through migrations then. Keep both servers bound to localhost until authentication is implemented.

Vite forwards `/api` to port 8000. Restart Vite after changing its configuration. For hosting later, route `/api` to FastAPI on the same origin; the frontend build does not run the backend. Set `DATABASE_URL` to override the database connection; a future PostgreSQL deployment also needs a PostgreSQL driver. The default SQLite path is resolved relative to the backend source, independent of the terminal directory.

API endpoints: `POST /api/solves` saves duration, start timestamp and penalty with a client-generated UUID; `GET /api/solves?limit=10&offset=0` returns newest results and total count. Penalties support `OK`, `+2` and `DNF`; penalty editing is not yet exposed in the UI. Interactive API documentation is at http://127.0.0.1:8000/docs.

Run backend tests from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests
```

Tests use temporary databases and apply the real migration. For later schema changes, create an Alembic revision, review it, then run `alembic upgrade head` using the virtual environment. Back up the SQLite file before migrating existing data.

The interface prioritizes mobile, uses a dark theme only, and loads Roboto Mono from Google Fonts (with a monospace fallback when offline). Keep future screens minimal: omit decorative slogans and footers, keep solve history on analysis, and avoid unnecessary settings.

## Code layout

- `frontend/src/timer/timer.ts`: explicit timer states and monotonic duration measurement.
- `frontend/src/timer/controls.ts`: keyboard and Pointer Events, including cancellation and input ownership.
- `frontend/src/main.ts`: display, recent results and save synchronization. Animation frames update the display only.
- `frontend/src/api/api.ts`: API requests and the pending save queue.
- `backend/main.py`: FastAPI application.
- `backend/database.py`: database engine and per-request sessions.
- `backend/models/solve.py`: solve table and request/response validation.
- `backend/routes/solves.py`: save and list endpoints.
- `migrations/`: versioned database schema changes.
- `frontend/src/styles/main.css`: responsive visual styling layered over Bootstrap.

Keep interface text lowercase, brief and free of punctuation. Use the variables in CSS `:root` for future visual additions.
