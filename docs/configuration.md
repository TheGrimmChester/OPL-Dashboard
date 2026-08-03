# Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://127.0.0.1:8092` (dev); empty in production images | OPL API base. Empty → same-origin nginx `/api/` proxy to `opl-api:8092`. |
| `VITE_OPA_HUB_URL` | unset | Optional OPA hub/dashboard origin for “Open in OPA” and login against the shared auth issuer. |
| `VITE_OPA_DASHBOARD_URL` | unset | Alias of `VITE_OPA_HUB_URL` if hub URL is unset. |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8092` | Vite dev-server proxy target for `/api`. |

Docker build args mirror the `VITE_*` variables above.
