# Changelog

## Unreleased

### Scenario inspector and guided VU tree

- Step inspector: Basics always visible; Advanced disclosure for every supported JMeter
  prop (HTTP redirects/timeouts/think rand, extract match/template/default, assert type/field,
  transaction timers, If/While expression flags, ForEach separator). Headers and fragment
  inputs edit as add/remove rows; `enabled` on every type. OPA correlation headers stay separate.
- VU tree: Essentials palette by default; **Logic & reuse** expands controllers / fragments /
  burst. Empty state offers Blank HTTP, Capture, and JMX on-ramps. Filter, Disable/Enable, and
  Find/replace (url / headers / body / name) sit beside DnD.
- Validation triage: **Open in tree** (uses `path` when present), unbound-variable CTA to Users.
- Users: Advanced CSVDataSet fields (`stop_thread`, `share_mode`, `quoted`, `ignore_first_line`,
  `encoding`). Scenario / SLA forms expose optional `rps_min`.
- Capture: surfaces import warnings, skip tallies, and empty results; when private hosts are
  mentioned, hints to set `OPA_PERF_INTERNAL_HOSTS` on `opl-api` for validate/run against NAS.

### The family design system

- Adopted `@open-family/ui`: the shared shell, tokens and component set. Deleted the local
  token layer (`src/theme/{tokens,ui,light}.css`, ~440 lines), the hand-rolled shell
  (`AppShell`, `SideRail`, `TopBar`, `ThemeToggle`) and the local primitive set
  (`components/ui/*`). Product-specific styling is now one file, `src/perflab.css`, and every
  value in it comes from a kit token.
- **The nine in-page tabs became four routes plus two tab strips.** `PerfLab.jsx` was
  2,202 lines serving its whole navigation from `?tab=`; it is now `/overview`,
  `/scenarios` (4 tabs), `/run`, `/results` with a per-run detail at `/results/:runId`
  (4 tabs), `/trends`, `/compare`, `/sla` and `/settings/account`. **URLs changed and there
  are no aliases** — the mapping is in the pull request.
- New pages: **Overview**, a real landing page rather than a redirect into the studio;
  **Account**, which the product did not have; a **404**, where an unknown URL used to
  redirect to the studio and hide the mistake.
- A run's detail is now in the URL, so a result is linkable, bookmarkable and reloadable.
  Its Errors and Resources tabs are new views over data the poller already held.
- **Every table now has an explicit loading and error state.** Previously no error was
  passed anywhere, so a failed request rendered as an empty result set with a misleading
  hint — the table said "start a run" when the truth was "the request failed".
- Density: 15px/1.6 body, 14px tables on 52px rows, 40px nav rows and buttons, 24px card
  padding, 32px section gaps, 1440px **centred** content, 268px sidebar.
- Top bar gains the organisation and project switcher, a command menu (⌘K), the time range,
  a theme control and a user menu with sign-out. The switcher keeps sending
  `X-Organization-ID` / `X-Project-ID` and still defaults to the deployment's tenant.
- Both themes are fully correct, and the stored theme beats the operating-system preference
  in both directions.
- **Fixed 14 custom properties that were referenced and never defined** — `--fs-10`,
  `--shadow-lg` and `--danger`, plus eleven in `ErrorBoundary.css`, which means the crash
  screen was itself rendering with dropped declarations. Each one silently dropped its whole
  declaration.
- Charts read the family palette (`--chart-1` … `--chart-8`, `--chart-mono`) instead of local
  `--series-*` / `--p50` / `--p95` / `--p99` tokens. The error-rate bars mark a breach by
  shape rather than by hue: a green-versus-red column pair measures ΔE 5.2 under
  deuteranopia, so it was not readable for a red/green-deficient viewer.
- Added a test suite (`npm test`, vitest): the token contract, the route contract, and the
  table-state rules. It had none before.
- Screenshots of every route in both themes: `designs/family-design-system/`.

## 0.1.0

- Virtual users & datasets: **CSV delimiter** field next to recycle/columns/rows. The value drives both the data file the engine writes and the plan element that reads it (`,` default; `\t` or `tab` for tab-separated).
- Run & scale / Results: **Notification channels** panel — one card per channel (webhook / chat / email) showing configured state, redacted target and signing, plus the global delivery mode and status filter. An unconfigured channel is shown in a muted, dashed state with the plain reason, never hidden; `log` mode is visually distinct from `deliver`.
- **Notification history** panel: per-run, per-channel delivery attempts with `sent` / `failed` / `logged` / `skipped` badges (distinguished by shape as well as colour), channel + result filters, and a "Send test notification" action.
- Results / Trends: **report and trend templates** — picker, applied-layout summary (widgets / metrics / window / scope) and a manage-and-edit modal. Exports (`report` JSON/CSV/HTML/PDF and bench pack) pass `?template=<id>`; the Trends tab renders only the widgets and metric columns the selected template covers.
- Design prototype: `designs/notify-channels-report-templates/`.
- Results: PDF + HTML report download and ZIP **bench pack** (JSON/CSV/HTML/PDF).
- **Trends** tab: latency band (p50/p95/p99), error-rate bars, best/worst/SLA breach KPIs; uses `GET .../scenarios/{id}/trends`.
- Design prototype: `designs/opl-report-trends/`.
- Extract Perf Lab studio from OPA-Dashboard as the primary Open Perf Lab UI (`/` and `/lab`).
- Shell branded Open Perf Lab; nginx proxies `/api/` to `opl-api:8092`.
- Optional “Open in OPA” deep-links via `VITE_OPA_HUB_URL` / `VITE_OPA_DASHBOARD_URL`.
- Depend on `@open-family/ui` and `@open-family/client` via local `file:` packages.
- Design tab: JMeter visual test case editor with VU tree + inspector (nested HTTP / txn / If / While / Loop / extract / assert); HTML5 drag-and-drop reorder/nest.
- Run & scale: load policies from `GET /api/perf/load-policies`; custom point-curve editor (`schedule.curve`); scheduler UX (`enabled` / `every_minutes` / `daily_at` → `POST .../schedule`); multi-run history for the selected scenario.
- Load policies labeled Smooth / Sustained / Stress / Custom for local Docker workers only.
