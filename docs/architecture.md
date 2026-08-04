# Architecture

OPL-Dashboard is a static Vite/React app. The browser talks only to the product API (`VITE_API_URL`, default `http://127.0.0.1:8092` / compose service `opl-api`).

Cross-product correlation with **OPA** (traces by `load_run_id`) is optional and client-side: when `VITE_OPA_HUB_URL` or `VITE_OPA_DASHBOARD_URL` is set, the UI shows “Open in OPA” links. Empty values hide those actions — OPL never requires OPA at boot.

```
Browser → opl-dashboard (nginx)
            └─ /api/*  →  opl-api:8092
Browser → (optional) OPA hub/dashboard URL for deep-links only
```

Primary surface: Perf Lab studio at `/` and `/lab`.

**Known gap — Virtual users & datasets tab.** The panel collects an inline CSV plus `variableNames`,
`delimiter`, and `recycle` (`src/pages/PerfLab.jsx:1326-1387`) and saves them as `datasets_json`, but on
`origin/main` the API never binds them to the executed plan: only `csv.inline` is read, and it is written to a
`data.csv` that no generated plan references. A scenario using `${var}` therefore runs with the placeholder
unsubstituted and no warning appears anywhere in the UI. Do not present this tab as working parameterisation
until the API emits a CSV Data Set element — see
[OPL-API jmeter-perf.md](https://github.com/TheGrimmChester/OPL-API/blob/main/docs/jmeter-perf.md#honesty).

Shared modules: `@open-family/ui` (shell helpers/tokens) and `@open-family/client` (typed HTTP helpers), linked as local `file:` packages during development.
