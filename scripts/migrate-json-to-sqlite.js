#!/usr/bin/env node
/**
 * SEVEN BITS COFFEE - DESKTOP - MANUAL JSON -> SQLITE MIGRATION
 * Location: /scripts/migrate-json-to-sqlite.js
 *
 * server.js already runs this automatically on first boot after an
 * upgrade (see db.js's initDb()) - this script exists only for running it
 * by hand ahead of time (e.g. to inspect data/app.db before ever starting
 * the new server), or against a data directory other than the current
 * checkout's own (via SBC_DATA_DIR). Safe to re-run - each file is skipped
 * if its table already has rows.
 *
 * Usage: node scripts/migrate-json-to-sqlite.js
 *        SBC_DATA_DIR=/path/to/data node scripts/migrate-json-to-sqlite.js
 */
const path = require("path");
const fs = require("fs");
const db = require("../db.js");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = process.env.SBC_DATA_DIR || path.join(ROOT_DIR, "data");

// Same 22 filenames server.js's own `*_FILE` constants point at - kept as a
// flat list here rather than requiring server.js itself, since requiring
// the whole server would also try to bind its HTTP port.
const DATA_FILES = [
  "menu.json",
  "config.json",
  "orders.json",
  "users.json",
  "audit-log.json",
  "branding-profiles.json",
  "stores.json",
  "timeclock.json",
  "payroll.json",
  "attendance.json",
  "overtime-approvals.json",
  "favorites.json",
  "addresses.json",
  "raw-materials.json",
  "combos.json",
  "table-sessions.json",
  "coupons.json",
  "arcade-scores.json",
  "stamp-cards.json",
  "user-preferences.json",
  "uploads.json",
  "customization-options.json"
].map((name) => path.join(DATA_DIR, name));

fs.mkdirSync(DATA_DIR, { recursive: true });
const { migratedCount } = db.initDb(DATA_DIR, DATA_FILES);
console.log(`Migrated ${migratedCount} file(s) from ${DATA_DIR} into ${path.join(DATA_DIR, "app.db")}`);
if (migratedCount === 0) {
  console.log("(0 means either no data/*.json files were found, or app.db already existed - nothing to do either way.)");
}
