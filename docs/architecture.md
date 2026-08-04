# Architecture

OPL-Dashboard is a static Vite/React app. The browser talks only to the product API (`VITE_API_URL`, default `http://127.0.0.1:8092` / compose service `opl-api`).

Cross-product correlation with **OPA** (traces by `load_run_id`) is optional and client-side: when `VITE_OPA_HUB_URL` or `VITE_OPA_DASHBOARD_URL` is set, the UI shows “Open in OPA” links. Empty values hide those actions — OPL never requires OPA at boot.

```
Browser → opl-dashboard (nginx)
            └─ /api/*  →  opl-api:8092
Browser → (optional) OPA hub/dashboard URL for deep-links only
```

Primary surface: Perf Lab studio at `/` and `/lab`.

**Virtual users & datasets tab.** The panel collects an inline CSV plus `variableNames`, `delimiter`, and
`recycle` and saves them as `datasets_json`. Those values now reach the executed test: `opl-api` writes
`data.csv` beside the plan and emits a matching CSV Data Set element, so `${column}` tokens bind at run time.
The dashboard is a thin editor over that contract — it does not itself validate columns; use
`POST .../scenarios/{id}/validate`, which cross-checks every `${…}` reference against the declared dataset
columns and reports `dataset_columns_unknown` rather than guessing when an external `filename` declares none.
See [OPL-API jmeter-perf.md](https://github.com/TheGrimmChester/OPL-API/blob/main/docs/jmeter-perf.md#honesty).

**Correction (2026-08-04).** An earlier revision of this file described the tab as a known gap whose values
"never bind". That was true of the `origin/main` of a few hours earlier and became wrong when the CSV dataset
binding merged; it is corrected rather than deleted.

Notification channels and delivery history are read-only views over `GET /api/health` (`run_notify.channels[]`) and `GET /api/perf/notifications`. The dashboard never holds a webhook URL, chat URL, SMTP credential or recipient list — those stay in the stack `.env` on `opl-api`, which returns hosts and counts only.

Report and trend templates are stored server-side (`/api/perf/report-templates`) and scoped by the `X-Organization-ID` / `X-Project-ID` headers the tenant context already attaches. The picker's selection is passed to exports as `?template=<id>` so a downloaded artifact matches the on-screen layout.

Shared modules: `@open-family/ui` (shell helpers/tokens) and `@open-family/client` (typed HTTP helpers), linked as local `file:` packages during development.
