# Architecture

OPL-Dashboard is a static Vite/React app. The browser talks only to the product API (`VITE_API_URL`, default `http://127.0.0.1:8092` / compose service `opl-api`).

Cross-product correlation with **OPA** (traces by `load_run_id`) is optional and client-side: when `VITE_OPA_HUB_URL` or `VITE_OPA_DASHBOARD_URL` is set, the UI shows “Open in OPA” links. Empty values hide those actions — OPL never requires OPA at boot.

```
Browser → opl-dashboard (nginx)
            └─ /api/*  →  opl-api:8092
Browser → (optional) OPA hub/dashboard URL for deep-links only
```

Primary surface: Perf Lab studio at `/` and `/lab`.

Notification channels and delivery history are read-only views over `GET /api/health` (`run_notify.channels[]`) and `GET /api/perf/notifications`. The dashboard never holds a webhook URL, chat URL, SMTP credential or recipient list — those stay in the stack `.env` on `opl-api`, which returns hosts and counts only.

Report and trend templates are stored server-side (`/api/perf/report-templates`) and scoped by the `X-Organization-ID` / `X-Project-ID` headers the tenant context already attaches. The picker's selection is passed to exports as `?template=<id>` so a downloaded artifact matches the on-screen layout.

Shared modules: `@open-family/ui` (shell helpers/tokens) and `@open-family/client` (typed HTTP helpers), linked as local `file:` packages during development.
