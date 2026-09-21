#!/bin/sh
# Uploaded images live in S3 now (see s3.js) - the bundled uploads/ folder
# baked into this image gets pushed there once, on first run, by
# scripts/seed-uploads-to-s3.js (the server-mode equivalent of main.js's
# own seedWritableDirs() for the Electron build).
set -e

mkdir -p "$SBC_DATA_DIR" "$SBC_LOGS_DIR" "$SBC_BACKUPS_DIR"

node scripts/seed-uploads-to-s3.js || true

exec node server.js
