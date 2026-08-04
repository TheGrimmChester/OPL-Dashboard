# Changelog

## 0.1.0

- Extract Perf Lab studio from OPA-Dashboard as the primary Open Perf Lab UI (`/` and `/lab`).
- Shell branded Open Perf Lab; nginx proxies `/api/` to `opl-api:8092`.
- Optional “Open in OPA” deep-links via `VITE_OPA_HUB_URL` / `VITE_OPA_DASHBOARD_URL`.
- Depend on `@open-family/ui` and `@open-family/client` via local `file:` packages.
- Design tab: JMeter visual test case editor with VU tree + inspector (nested HTTP / txn / extract / assert).
- Load policies labeled Smooth / Sustained / Stress for local Docker workers only.
