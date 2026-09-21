# Seven Bits Coffee - server mode (no Electron/GUI at all - just the plain
# Node backend, which is all this needs to run on a headless Linux host).
#
# No longer zero-dependency (see db.js/s3.js) - better-sqlite3 is a native
# module, so `npm install` here needs either a prebuilt binary for
# linux-x64 glibc (what better-sqlite3 ships for node:20-slim out of the
# box) or a C++ toolchain to compile it from source. If a build ever fails
# here with a node-gyp error, add `RUN apt-get update && apt-get install -y
# python3 build-essential` before the npm install step below.
FROM node:20-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY server.js db.js s3.js index.html ./
COPY css ./css
COPY js ./js
COPY uploads ./uploads
COPY data-seed ./data-seed
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# data/logs/backups are meant to be bind-mounted volumes (see
# docker-compose.yml) so they survive a container rebuild/redeploy - not
# baked into the image. Uploaded images no longer live on this container's
# own disk at all - see S3_* env vars below (docker-compose.yml points
# them at the localstack service for local dev/test; a production compose
# file/environment should point them at real AWS S3 instead).
ENV SBC_DATA_DIR=/data/data
ENV SBC_LOGS_DIR=/data/logs
ENV SBC_BACKUPS_DIR=/data/backups
ENV PORT=3000

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
