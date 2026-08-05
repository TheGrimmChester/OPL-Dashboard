# Architecture

OPL-Dashboard is a static Vite/React app. The browser talks only to the product API (`VITE_API_URL`, default `http://127.0.0.1:8092` / compose service `opl-api`).

Cross-product correlation with **OPA** (traces by `load_run_id`) is optional and client-side: when `VITE_OPA_HUB_URL` or `VITE_OPA_DASHBOARD_URL` is set, the UI shows “Open in OPA” links. Empty values hide those actions — OPL never requires OPA at boot.

```
Browser → opl-dashboard (nginx)
            └─ /api/*  →  opl-api:8092
Browser → (optional) OPA hub/dashboard URL for deep-links only
```

## Routes

The product used to be one page — `/` and `/lab` both rendered a 2,202-line studio whose
real navigation was nine in-page tabs. It is now four routes plus a pinned Overview,
with tab strips where a page still holds several views. The full section grouping is in
[`Open-UI-JS/docs/ia.md`](https://github.com/TheGrimmChester/Open-UI-JS/blob/main/docs/ia.md).

| Section | Pages |
|---|---|
| *(pinned)* | Overview `/overview` |
| **Test design** | Scenarios `/scenarios` — tabs: Steps · Users and data · Capture · JMX |
| **Execution** | Run and scale `/run` · Results `/results`, detail at `/results/:runId` — tabs: Summary · Timeline · Errors · Resources |
| **Analysis** | Trends `/trends` · Comparison `/compare` · SLA gates `/sla` |
| **Administration** | Account `/settings/account` |

`/` redirects to `/overview`. `/lab` is gone, and an unknown URL renders a 404 page
instead of silently redirecting to the studio. There are no aliases for the old
`?tab=` and `?run=` parameters — the mapping is in the migration PR.

State that every route needs — the scenario being edited, the run controls, the
poller — lives in `src/perflab/PerfLabContext.jsx`, one store above the router. The
selected scenario's *identifier* is remembered in `localStorage`, so reloading
`/trends` or `/sla` does not land on a scenario-less page; its content is always
re-fetched.

## Virtual users and datasets

The Users-and-data tab collects an inline CSV plus `variableNames`, `delimiter` and `recycle`
and saves them as `datasets_json`. Those values now reach the executed test: `opl-api` writes
`data.csv` beside the plan and emits a matching CSV Data Set element, so `${column}` tokens
bind at run time. The dashboard is a thin editor over that contract — it does not itself
validate columns; use `POST .../scenarios/{id}/validate`, which cross-checks every `${…}`
reference against the declared dataset columns and reports `dataset_columns_unknown` rather
than guessing when an external `filename` declares none. See
[OPL-API jmeter-perf.md](https://github.com/TheGrimmChester/OPL-API/blob/main/docs/jmeter-perf.md#honesty).

**Correction (2026-08-04).** An earlier revision of this file described the tab as a known
gap whose values "never bind". That was true of the `origin/main` of a few hours earlier and
became wrong when the CSV dataset binding merged; it is corrected rather than deleted. The
tab's banner states the current contract and points at Validate.

Notification channels and delivery history are read-only views over `GET /api/health` (`run_notify.channels[]`) and `GET /api/perf/notifications`. The dashboard never holds a webhook URL, chat URL, SMTP credential or recipient list — those stay in the stack `.env` on `opl-api`, which returns hosts and counts only.

Report and trend templates are stored server-side (`/api/perf/report-templates`) and scoped by the `X-Organization-ID` / `X-Project-ID` headers the tenant context already attaches. The picker's selection is passed to exports as `?template=<id>` so a downloaded artifact matches the on-screen layout.

## Presentation

The whole interface is built from `@open-family/ui` — the family shell, tokens and
component set. There is no local token layer: `src/theme/{tokens,ui,light}.css` are gone,
and `src/perflab.css` holds only what is specific to this product (the virtual-user tree,
the load-curve editor, the notification channel cards, the template manager). Every value
in it comes from a kit token, which the test suite asserts.

The product accent is bound by `applyProduct('opl')` stamping `<html data-product="opl">`;
no accent hex appears anywhere in the source. Charts are hand-rolled SVG and read
`--chart-1` … `--chart-8` for categorical series and `--chart-mono` for a single one, so a
theme switch costs nothing and the palette matches every sibling dashboard.

Shared modules: `@open-family/ui` (shell, tokens, components) and `@open-family/client`
(typed HTTP helpers), linked as local `file:` packages during development. `file:` deps are
symlinked, so `vite.config.js` must dedupe `react` and `react-dom` or the kit resolves its
own copy and every hook call fails.

## Verifying a change

```bash
npm run build   # must be clean
npm test        # the token and route contract
```

The suite is a contract, not coverage. It asserts that every custom property the product
references resolves, that none of the retired local tokens came back, that no raw pixel
value appears in a spatial declaration, that all nine former in-page tabs are reachable,
and that no two rail items share a glyph. It walks the filesystem rather than the git
index, because `git grep` cannot see an untracked file and a scan built on it would come
back clean while missing every new page.

Screenshots of every route in both themes are in
[`designs/family-design-system/`](../designs/family-design-system/README.md).
