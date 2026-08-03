# OPL-Dashboard

React/Vite UI for **Open Perf Lab** (OPL) — scenario designer, load runs, SLA gates, and optional deep-links into OPA for `load_run_id` correlation.

| Port (smoke) | Service |
|---|---|
| UI (nginx / Vite) | `opl-dashboard` |
| **8092** | `opl-api` |

## Develop

Requires sibling checkouts of `Open-UI-JS` and `Open-Client-JS` (linked via `file:` dependencies).

```bash
# from each module repo once
(cd ../Open-UI-JS && npm install && npm run build)
(cd ../Open-Client-JS && npm install && npm run build)

npm install
VITE_API_URL=http://127.0.0.1:8092 npm run dev
```

Optional OPA hub deep-links (“Open in OPA”):

```bash
VITE_OPA_HUB_URL=http://127.0.0.1:3000 npm run dev
# or
VITE_OPA_DASHBOARD_URL=http://127.0.0.1:3000 npm run dev
```

## Build

```bash
npm run build
```

## Docker

Build from the parent `repos/` directory so module packages are available:

```bash
docker build -f OPL-Dashboard/Dockerfile -t opl-dashboard:smoke .
```

Image tags: `opl-dashboard:smoke` for laptop smoke stacks; **`opl-dashboard:nas` for production / NAS only**.

Runtime nginx proxies `/api/` → `opl-api:8092`.

## Configuration

See [docs/configuration.md](docs/configuration.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Install](docs/install.md)
- [Configuration](docs/configuration.md)
- [Changelog](docs/changelog.md)

## License

EUPL-1.2 — see [LICENSE](LICENSE).
