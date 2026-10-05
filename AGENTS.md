# CubeApp — Project Instructions

## Project Goal

CubeApp is a simple, clean, modern web application for timing and storing speedcubing solves.

The project is intentionally limited in scope. It should provide the core features that are actually useful for everyday speedcubing while avoiding the clutter and excessive configuration found in many existing timer applications.

The application should run locally on the user's PC during development and should be designed so that it can later be hosted and shared with friends.

The user wants to understand the codebase and make manual changes, so prefer simple, explicit, readable implementations over overly abstract or highly automated solutions.

---

## Technology Stack

Frontend:
- HTML
- CSS
- Bootstrap 5
- Vanilla TypeScript
- Vite
- Chart.js for analytics visualizations

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

## Suggested Repository Structure

cubeapp/
├── AGENTS.md
├── README.md
├── .gitignore
├── frontend/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── main.ts
│       ├── timer/
│       │   ├── timer.ts
│       │   └── controls.ts
│       ├── api/
│       │   └── api.ts
│       ├── analytics/
│       │   ├── charts.ts
│       │   └── filters.ts
│       └── styles/
│           └── main.css
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models/
│   ├── routes/
│   └── services/
└── migrations/

The exact structure may evolve, but keep modules small and responsibilities clear.

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

### cubes

Represents physical cubes owned or used by a user.

Suggested fields:
- id
- user_id
- name
- brand
- model

Most fields except id, user_id, and name can remain optional.

### categories

Represents arbitrary user-defined classifications for solves.

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

Suggested fields:
- id
- user_id
- cube_id
- category_id
- duration_ms
- started_at
- penalty

Do NOT currently include:
- scramble
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

---

## Desktop Keyboard Behavior

When idle:

- Holding Space begins the preparation phase.
- After the configured hold threshold, the timer becomes READY.
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
- After a short configurable delay, the timer becomes READY.
- Releasing starts the timer.

When running:

- A pointer press stops the timer immediately.

The interaction target should be large, ideally the main central timer area.

Use appropriate CSS such as `touch-action` where necessary to prevent scrolling or gesture behavior from interfering with the timer.

The hold duration should eventually be configurable.

A reasonable initial default is around 400 ms.

---

## Hidden Timer Mode

The user must be able to hide the live timer while solving.

This is an important feature.

Possible modes:

1. Live time
2. Hidden time with only a neutral "SOLVING" indicator

The solve must still be timed normally using `performance.now()`.

This setting should eventually persist per user.

---

## Main Timer Interface

The timer page should remain intentionally sparse.

Primary information:
- timer
- current category
- current cube
- current averages such as ao5 and ao12
- recent solves

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

There is intentionally NO session concept in the current data model.

### Date filtering

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
- support for every WCA event
- complex competition management
- notifications
- PWA functionality

PWA support may be considered later after the normal responsive web app works well.

---

## Development Order

Prefer implementing features in this order.

### Phase 1 — Timer

Build the responsive frontend timer first.

Goals:
- correct timing
- keyboard controls
- mobile pointer controls
- hold-to-start
- any-key-to-stop
- hidden timer mode
- clean responsive interface

No backend is required initially.

### Phase 2 — Persistence

Add:
- FastAPI backend
- SQLite
- SQLModel
- solve storage
- basic API communication

### Phase 3 — Organization and Users

Add:
- authentication
- users
- cubes
- categories
- data ownership

### Phase 4 — Analytics

Add:
- solve history
- filtering
- ao5
- ao12
- mean
- median
- standard deviation
- line graph
- histogram
- date-range filtering

### Phase 5 — Flexible Metadata

Add:
- solve_fields UI
- editing metadata after solves
- filtering/analysis based on flexible fields

### Phase 6 — Deployment Improvements

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

## Current Project Path

Local development project path on Windows:

`C:\dev\cubeapp`

This path is informational only. Code should use relative paths inside the repository rather than hard-coded absolute paths.
