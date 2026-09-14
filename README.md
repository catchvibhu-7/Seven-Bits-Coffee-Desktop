# Seven Bits Coffee — Desktop

The Seven Bits Coffee POS, packaged as a native desktop app. This is a
**separate repository**, forked from the web app as a snapshot on
2026-09-14 — it does not auto-sync with the web version. See "Staying in
sync" below when you want to pull in later web-app changes.

## What this actually is

The web app's entire backend is one plain-Node `server.js` with zero
dependencies (`node server.js` is all it ever needed). This desktop wrapper
adds:

- **`main.js`** — an Electron main process that starts that same
  `server.js` in-process (no separate child process, no build step for the
  app itself) and opens a native window pointed at it, instead of asking
  you to open a browser to `localhost` yourself.
- Two small, backward-compatible lines in `server.js`: `DATA_DIR` and
  `UPLOADS_DIR` can now be overridden via `SBC_DATA_DIR`/`SBC_UPLOADS_DIR`
  env vars (defaulting to the exact same paths as before when unset). A
  packaged app's install directory is read-only, so `main.js` points these
  at `app.getPath("userData")` — a normal writable per-user folder — instead
  of trying to write next to the app's own files.
- Nothing else about the app changed. Same `index.html`/`css/`/`js/`,
  same admin panel, same everything.

## Run it in development

```bash
npm install
npm start
```

First launch creates its data folder and seeds it from `data-seed/` (same
menu-seed pattern the web app already uses) plus the bundled branding
photos from `uploads/`.

**Default login:** username `owner`, password `changeme123` (same default
the web app's own `start.bat` ships) — log in and change it from Account
Settings immediately, before you start taking real orders.

Where your data actually lives (not inside the app folder — see above):

- Windows: `%APPDATA%\seven-bits-coffee-desktop\data`
- macOS: `~/Library/Application Support/seven-bits-coffee-desktop/data`
- Linux: `~/.config/seven-bits-coffee-desktop/data`

## Build an installer

```bash
npm run dist        # current platform
npm run dist:win     # Windows (NSIS installer)
npm run dist:mac     # macOS (.dmg)
npm run dist:linux   # Linux (AppImage)
```

Output lands in `dist/`. Building for macOS/Linux from Windows (or vice
versa) generally needs that target OS or a CI runner for it — electron-
builder doesn't fully cross-compile signed installers from an unrelated OS.

## Staying in sync with the web app

This repo is a manual fork, not a subtree/submodule. To pull in a change
made on the web app side, copy the same files over:

```
server.js   (reapply the two DATA_DIR/UPLOADS_DIR env-var lines if you copy the whole file)
index.html
css/
js/
uploads/    (only if branding/menu photos changed)
data-seed/  (only if the seed menu changed)
```

`main.js`, `package.json`, `.gitignore`, and this README are desktop-only
and aren't part of that sync.

## Why Electron

The app is a server + a browser-rendered UI already — Electron just bundles
a Chromium window and Node runtime around exactly that, which is the
smallest step from "runs via `node server.js` + open a browser" to "a real
installable app with its own icon and window." No app code had to be
rewritten for a different UI toolkit.
