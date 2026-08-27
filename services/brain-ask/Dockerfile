FROM node:24.15.0-bookworm-slim@sha256:152aceace5c03e2597988763165ee33e3fd3633636db0fc983cd2e126b02cfde

ENV NODE_ENV=production

RUN mkdir -p /app \
  && chown -R 1000:1000 /app

WORKDIR /app

COPY services/brain-ask/brainAsk.mjs ./brainAsk.mjs
COPY services/brain-ask/server.mjs ./server.mjs
COPY .agents/plugin/fos-brain/scripts/brain-search-http.cjs ./brain-search-http.cjs

USER 1000:1000
EXPOSE 8787

CMD ["node", "/app/server.mjs"]
