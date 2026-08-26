FROM node:24.15.0-bookworm-slim@sha256:152aceace5c03e2597988763165ee33e3fd3633636db0fc983cd2e126b02cfde

ENV HOME=/data \
    QMD_HOME=/data \
    XDG_CONFIG_HOME=/data/config \
    XDG_CACHE_HOME=/data/cache \
    npm_config_cache=/data/npm-cache \
    GGML_METAL_NO_RESIDENCY=1

RUN npm install --global @tobilu/qmd@2.8.3 \
  && npm cache clean --force \
  && mkdir -p /data /brain/public/wiki /brain/public/raw /brain/private/wiki \
  && chown -R 1000:1000 /data

COPY entrypoint.sh /usr/local/bin/brain-qmd-entrypoint

RUN chmod 0755 /usr/local/bin/brain-qmd-entrypoint

USER 1000:1000
WORKDIR /data
EXPOSE 8181

ENTRYPOINT ["/usr/local/bin/brain-qmd-entrypoint"]
CMD ["serve"]
