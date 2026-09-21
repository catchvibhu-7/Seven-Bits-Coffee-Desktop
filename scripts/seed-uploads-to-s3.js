#!/usr/bin/env node
/**
 * SEVEN BITS COFFEE - SEED BUNDLED UPLOADS INTO S3
 * Location: /scripts/seed-uploads-to-s3.js
 *
 * Mirrors main.js's own first-run upload seeding for the Electron build -
 * this is the server-mode (Docker/systemd) equivalent, called from
 * deploy/docker-entrypoint.sh before the server starts. Pushes the bundled
 * /uploads folder's photos into S3 exactly once (tracked by a marker file
 * under SBC_DATA_DIR, since there's no local uploads folder to check for
 * "already seeded" the way local-disk storage used to let us do).
 *
 * Safe to run again - no-ops immediately if the marker file already exists.
 */
const fs = require("fs");
const path = require("path");
const s3 = require("../s3.js");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = process.env.SBC_DATA_DIR || path.join(ROOT_DIR, "data");
const MARKER_PATH = path.join(DATA_DIR, "uploads-seeded-to-s3");

const MIME_BY_EXT = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

(async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(MARKER_PATH)) {
    console.log("Uploads already seeded to S3 - nothing to do.");
    return;
  }
  await s3.ensureBucket();
  const bundledUploads = path.join(ROOT_DIR, "uploads");
  let seededCount = 0;
  if (fs.existsSync(bundledUploads)) {
    for (const file of fs.readdirSync(bundledUploads)) {
      const ext = path.extname(file).slice(1).toLowerCase();
      const mimeType = MIME_BY_EXT[ext];
      if (!mimeType) continue;
      try {
        await s3.putObject(file, fs.readFileSync(path.join(bundledUploads, file)), mimeType);
        seededCount++;
      } catch (e) {
        console.error(`Could not seed ${file} to S3:`, e.message);
      }
    }
  }
  fs.writeFileSync(MARKER_PATH, new Date().toISOString());
  console.log(`Seeded ${seededCount} bundled upload(s) to S3.`);
})().catch((e) => {
  console.error("seed-uploads-to-s3 failed:", e.message);
  // Don't block the server from starting over a seeding failure (e.g. S3
  // not reachable yet on a slow-starting LocalStack container) - a shop
  // can always upload photos by hand if the bundled defaults didn't land.
});
