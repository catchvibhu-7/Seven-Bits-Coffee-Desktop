# Seven Bits Coffee - server mode (no Electron/GUI at all - just the plain
# Node backend, which is all this needs to run on a headless Linux host).
# server.js has zero npm dependencies of its own (electron/electron-builder/
# jimp in package.json are devDependencies for the DESKTOP build only), so
# this image never runs `npm install` - there's nothing to install.
FROM node:20-slim

WORKDIR /app
COPY server.js index.html ./
COPY css ./css
COPY js ./js
COPY uploads ./uploads
COPY data-seed ./data-seed
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# data/uploads/logs/backups are meant to be bind-mounted volumes (see
# docker-compose.yml) so they survive a container rebuild/redeploy - not
# baked into the image.
ENV SBC_DATA_DIR=/data/data
ENV SBC_UPLOADS_DIR=/data/uploads
ENV SBC_LOGS_DIR=/data/logs
ENV SBC_BACKUPS_DIR=/data/backups
ENV PORT=3000

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
