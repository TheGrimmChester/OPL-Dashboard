# Changelog

## 0.1.0

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
