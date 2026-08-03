# Architecture

The dashboard is a static Vite/React app. Browsers call only the product API configured by `VITE_API_URL`. Cross-product calls are server-side between APIs — not from this UI.

Smoke API port for OPL is **8092** (`opl-api`).
