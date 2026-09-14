#!/bin/sh
# Mirrors main.js's seedWritableDirs() for the Electron build: the bundled
# uploads/ folder (baked into the image at /app/uploads) only ever gets
# copied into the mounted volume once, on first run - after that the
# volume is the live copy and the image's own bundled files are never
# touched again.
set -e

mkdir -p "$SBC_DATA_DIR" "$SBC_LOGS_DIR" "$SBC_BACKUPS_DIR"

if [ -z "$(ls -A "$SBC_UPLOADS_DIR" 2>/dev/null)" ]; then
    mkdir -p "$SBC_UPLOADS_DIR"
    cp -n /app/uploads/. "$SBC_UPLOADS_DIR"/ 2>/dev/null || true
fi

exec node server.js
