# Install

## Prerequisites

- Node.js 18+
- Sibling repos `Open-UI-JS` and `Open-Client-JS` built once (`npm run build` in each)

## Local

```bash
npm install
npm run build
npm run dev
```

## Container

From the parent directory that contains `OPL-Dashboard`, `Open-UI-JS`, and `Open-Client-JS`:

```bash
docker build -f OPL-Dashboard/Dockerfile -t opl-dashboard:smoke .
```

Image tags:

| Tag | Use |
|-----|-----|
| `opl-dashboard:smoke` | Laptop / local smoke stack only |
| `opl-dashboard:nas` | Production and NAS deployments |

Never deploy `*:smoke` images to NAS.
