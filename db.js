/**
 * SEVEN BITS COFFEE - SQLITE DATA LAYER
 * Location: /db.js
 *
 * Replaces the old "read whole file, mutate in JS, write whole file back"
 * JSON-on-disk model with the same storage engine ~310 call sites across
 * server.js were already written against (readJson(SOME_FILE, fallback) /
 * writeJson(SOME_FILE, data)) - so this migration is a swap of what those
 * two functions DO, not a rewrite of the ~310 places that call them.
 *
 * Every one of the ~22 `*_FILE` constants in server.js becomes one SQLite
 * table, named after the file's own basename (data/orders.json -> table
 * "orders"), holding one row per record:
 *   rowKey TEXT PRIMARY KEY  -- the record's own id (or a composite key for
 *                                the few id-less files - favorites, stamp
 *                                cards, overtime approvals), stringified
 *   data   TEXT NOT NULL     -- the full record, JSON-serialized - exactly
 *                                what used to live as one array element
 * A handful of files (config.json, customization-options.json, branding-
 * profiles.json, user-preferences.json) are a single object rather than an
 * array of records - those get stored the same way, as one row under a
 * fixed key, auto-detected from whether writeJson() was handed an array or
 * a plain object. No caller needs to know or care which kind their file is.
 *
 * Deliberately NOT migrated here (stay on the original fs.readFileSync/
 * writeFileSync JSON helpers, now named readJsonFile/writeJsonFile): the
 * bundled read-only data-seed/ templates, and the yearly order-history
 * archive files under ARCHIVES_DIR - see the migration plan's Phase 1
 * scope note on why archives/compaction are handled in a later phase.
 *
 * SWITCHING ENGINES LATER (e.g. to Postgres): `better-sqlite3` is required
 * ONLY in this file - nowhere else in the app touches it directly, by
 * design. A future swap means writing a new backend behind this exact
 * same exported contract (readJson/writeJson/jsonExists/readJsonFile/
 * writeJsonFile/initDb/backupTo/restoreFromBuffer) - none of the ~310+
 * call sites in server.js, or anything else in the app, would need to
 * change. Keep it that way: never `require("better-sqlite3")` from
 * server.js or anywhere else.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

let db = null;
const SINGLETON_KEY = "__singleton__";

function tableNameFor(fileArg) {
  const base = path.basename(String(fileArg), ".json");
  return base.replace(/[^a-zA-Z0-9_]/g, "_") || "unnamed";
}

function ensureTable(name) {
  db.exec(`CREATE TABLE IF NOT EXISTS "${name}" (rowKey TEXT PRIMARY KEY, data TEXT NOT NULL)`);
}

/** Stringified key for one array element - id when there is one, otherwise
 *  a composite of whatever fields make a record unique in the handful of
 *  id-less files (favorites.json, overtime-approvals.json, stamp-cards.json).
 *  Falls back to the array index so an unrecognized future shape still
 *  round-trips correctly instead of throwing. */
function rowKeyFor(record, index) {
  if (record && typeof record === "object") {
    if (record.id !== undefined && record.id !== null) return String(record.id);
    if (record.phone) return String(record.phone);
    if (record.userId !== undefined && record.date !== undefined) return `${record.userId}:${record.date}`;
    if (record.ownerType !== undefined && record.ownerId !== undefined && record.itemId !== undefined) {
      return `${record.ownerType}:${record.ownerId}:${record.itemId}`;
    }
  }
  return String(index);
}

/** SQLite-backed replacement for the old whole-file JSON read - identical
 *  signature/contract (fallback when nothing's stored yet) to the fs-based
 *  original, so every existing call site needed zero changes. */
function readJson(fileArg, fallback) {
  const name = tableNameFor(fileArg);
  ensureTable(name);
  const rows = db.prepare(`SELECT rowKey, data FROM "${name}"`).all();
  if (rows.length === 0) return fallback;
  if (rows.length === 1 && rows[0].rowKey === SINGLETON_KEY) return JSON.parse(rows[0].data);
  return rows.map((r) => JSON.parse(r.data));
}

/** SQLite-backed replacement for the old whole-file JSON write - replaces
 *  the table's entire contents in one transaction (matching the old
 *  "here's the whole new array/object, save it" contract exactly). */
function writeJson(fileArg, data) {
  const name = tableNameFor(fileArg);
  ensureTable(name);
  const del = db.prepare(`DELETE FROM "${name}"`);
  const insert = db.prepare(`INSERT INTO "${name}" (rowKey, data) VALUES (?, ?)`);
  const tx = db.transaction(() => {
    del.run();
    if (Array.isArray(data)) {
      data.forEach((record, i) => insert.run(rowKeyFor(record, i), JSON.stringify(record)));
    } else {
      insert.run(SINGLETON_KEY, JSON.stringify(data ?? {}));
    }
  });
  tx();
}

/** Does this table already have at least one row? Replaces the
 *  fs.existsSync(SOME_FILE) checks that used to gate one-time seed/
 *  migration logic against the old JSON file's mere presence on disk. */
function jsonExists(fileArg) {
  const name = tableNameFor(fileArg);
  ensureTable(name);
  return !!db.prepare(`SELECT 1 FROM "${name}" LIMIT 1`).get();
}

/** Plain fs-backed JSON read/write - the ORIGINAL implementation,
 *  unchanged, kept under new names for the handful of call sites that
 *  read/write real files outside this SQLite migration's scope (bundled
 *  data-seed/ templates, ARCHIVES_DIR yearly order archives). */
function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return fallback;
  }
}
function writeJsonFile(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

/** One-time import of an existing install's data/*.json files into SQLite.
 *  Safe to call on an already-migrated data dir (each file is skipped if
 *  its table already has rows) - so this doubles as both the automatic
 *  first-boot migration (see initDb() below) and the standalone
 *  scripts/migrate-json-to-sqlite.js manual entry point. */
function migrateExistingJsonFiles(fileConstants) {
  let migratedCount = 0;
  for (const fileConst of fileConstants) {
    if (jsonExists(fileConst)) continue;
    if (!fs.existsSync(fileConst)) continue;
    const raw = readJsonFile(fileConst, undefined);
    if (raw === undefined) continue;
    writeJson(fileConst, raw);
    migratedCount++;
  }
  return migratedCount;
}

let dbPath = null;

/** Opens (creating if needed) data/app.db and, ONLY the very first time
 *  it's created, imports any pre-existing data/*.json files from an older
 *  install - so a real upgrade migrates automatically on next boot, but a
 *  server that's already on SQLite never re-reads/overwrites its own data
 *  from stale JSON files sitting next to it. */
function initDb(dataDir, fileConstants) {
  if (db) return { migratedCount: 0 };
  dbPath = path.join(dataDir, "app.db");
  const isFreshDb = !fs.existsSync(dbPath);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  const migratedCount = isFreshDb && fileConstants ? migrateExistingJsonFiles(fileConstants) : 0;
  return { migratedCount };
}

/** Hot online backup of the whole live database to a new file, using
 *  better-sqlite3's own .backup() (safe to run while the server keeps
 *  handling requests - unlike copying the raw file, which could catch a
 *  write mid-flight). Replaces the old "read every JSON file into one
 *  blob" approach both backup routes in server.js used, now that all data
 *  lives in this one file. */
async function backupTo(destPath) {
  await db.backup(destPath);
}

/** Overwrites the live database with a previously backed-up file - closes
 *  the current connection, swaps app.db, clears any stale -wal/-shm
 *  sidecar files (so they can't get replayed against the new file's
 *  different contents), then reopens. Validates the SQLite file header
 *  first so a corrupted/wrong file fails loudly before touching anything,
 *  rather than leaving the app half-restored. */
function restoreFromBuffer(buffer) {
  if (buffer.length < 16 || buffer.toString("utf8", 0, 15) !== "SQLite format 3") {
    throw new Error("That doesn't look like a valid database backup file");
  }
  if (db) {
    db.close();
    db = null;
  }
  fs.writeFileSync(dbPath, buffer);
  for (const ext of ["-wal", "-shm"]) {
    try {
      fs.unlinkSync(dbPath + ext);
    } catch (e) {
      // Fine if it never existed.
    }
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
}

module.exports = { initDb, readJson, writeJson, jsonExists, readJsonFile, writeJsonFile, migrateExistingJsonFiles, backupTo, restoreFromBuffer };
