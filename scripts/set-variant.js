#!/usr/bin/env node
/**
 * SEVEN BITS COFFEE - DESKTOP - BUILD VARIANT SWITCH
 * Location: /scripts/set-variant.js
 *
 * Runs before electron-builder (see package.json's dist:* scripts) to pick
 * which of the two installers this build produces: "regular" (a blank shop,
 * no demo content, no LOAD DEMO DATA button anywhere - the install/update
 * distributable) or "demo" (auto-loads data-seed/demo-backup.json on first
 * launch, and keeps a RESET TO DEMO DATA button in Admin > Data & Backup).
 * Just copies the matching build/variant.<name>.json to build/variant.json,
 * the one fixed path main.js/server.js actually read at runtime.
 *
 * Usage: node scripts/set-variant.js regular|demo
 */
const fs = require("fs");
const path = require("path");

const variant = process.argv[2];
if (variant !== "regular" && variant !== "demo") {
    console.error("Usage: node scripts/set-variant.js regular|demo");
    process.exit(1);
}

const src = path.join(__dirname, "..", "build", `variant.${variant}.json`);
const dest = path.join(__dirname, "..", "build", "variant.json");
fs.copyFileSync(src, dest);
console.log(`build/variant.json set to "${variant}"`);
