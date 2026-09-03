FROM node:24.15.0-bookworm-slim@sha256:152aceace5c03e2597988763165ee33e3fd3633636db0fc983cd2e126b02cfde AS build

WORKDIR /app

COPY services/brain-ask/package.json services/brain-ask/pnpm-lock.yaml ./
RUN corepack pnpm@10.33.0 install --frozen-lockfile

COPY services/brain-ask/tsconfig.json services/brain-ask/tsconfig.build.json ./
COPY services/brain-ask/src ./src
RUN corepack pnpm@10.33.0 build \
  && corepack pnpm@10.33.0 prune --prod

FROM node:24.15.0-bookworm-slim@sha256:152aceace5c03e2597988763165ee33e3fd3633636db0fc983cd2e126b02cfde AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=1000:1000 /app/package.json ./package.json
COPY --from=build --chown=1000:1000 /app/node_modules ./node_modules
COPY --from=build --chown=1000:1000 /app/dist ./dist

USER 1000:1000
EXPOSE 8787

CMD ["node", "/app/dist/main.js"]
