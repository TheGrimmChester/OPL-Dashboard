# Build from the family repos root (sibling Open-UI-JS / Open-Client-JS required):
#   docker build -f OPL-Dashboard/Dockerfile -t opl-dashboard:smoke .
# Production / NAS: tag and run as opl-dashboard:nas only (never *:smoke on NAS).

FROM node:20-alpine AS build

WORKDIR /src
COPY Open-UI-JS ./Open-UI-JS
COPY Open-Client-JS ./Open-Client-JS
COPY OPL-Dashboard ./OPL-Dashboard

WORKDIR /src/OPL-Dashboard
RUN npm install

ARG VITE_API_URL=
ARG VITE_OPA_HUB_URL=
ARG VITE_OPA_DASHBOARD_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_OPA_HUB_URL=$VITE_OPA_HUB_URL
ENV VITE_OPA_DASHBOARD_URL=$VITE_OPA_DASHBOARD_URL
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /src/OPL-Dashboard/dist /usr/share/nginx/html
COPY OPL-Dashboard/nginx.conf /etc/nginx/conf.d/default.conf

# NAS/NFS docker storage can hang on the stock nginx IPv6 listen probe.
RUN rm -f /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
