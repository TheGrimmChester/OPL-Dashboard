# Changelog

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
