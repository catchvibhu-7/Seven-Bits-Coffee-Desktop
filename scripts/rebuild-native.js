"use strict";
/**
 * Rebuilds better-sqlite3's native binding against the Electron ABI, run
 * directly (inherited stdio, no piping) instead of through @electron/
 * rebuild's own wrapper - that wrapper (at least in electron-builder
 * 25.1.8 / @electron/rebuild 3.6.1) hangs indefinitely partway through on
 * Windows, almost certainly because it doesn't drain node-gyp's verbose
 * child-process output fast enough and deadlocks on a full stdout pipe.
 * Running node-gyp ourselves with stdio inherited sidesteps that bug
 * entirely. package.json's "build.npmRebuild": false tells electron-
 * builder to skip its own (buggy) automatic rebuild, relying on this
 * script instead - every dist:* script runs this first.
 */
const { execFileSync } = require("child_process");
const path = require("path");

const electronVersion = require("electron/package.json").version;
const nodeGypBin = require.resolve("node-gyp/bin/node-gyp.js");
const cwd = path.join(__dirname, "..", "node_modules", "better-sqlite3");

console.log(`Rebuilding better-sqlite3 for Electron ${electronVersion} (${process.arch})...`);

execFileSync(
  process.execPath,
  [nodeGypBin, "rebuild", "--runtime=electron", `--target=${electronVersion}`, `--arch=${process.arch}`, "--dist-url=https://www.electronjs.org/headers", "--build-from-source"],
  { cwd, stdio: "inherit" }
);
