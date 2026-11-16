# The store website (Next.js), built and run on our own server.
# Built by scripts/deploy-web.sh from a fresh clone of GitHub main:
#   docker build -f infra/server/web.Dockerfile -t store-web:<commit> .
# Settings: NEXT_PUBLIC_* are baked in at build time from .env.production (written by the deploy
# script, public values only); server secrets come at run time from /opt/store/web.env.

FROM node:22.12.0-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22.12.0-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/package.json /app/next.config.mjs ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=4 \
  CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
