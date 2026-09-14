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
- A **Network Address** card on the staff home page (and a "Network" menu
  item, reachable with Alt since the menu bar is auto-hidden) shows every
  LAN address this machine can be reached at, with a copy button — for
  setting up a second till or a kitchen tablet on the same WiFi. Plain
  `http://`, not `https://` — see "Connecting from other devices" below for
  why, and how to change that decision later if you need to.
- `TERMS_AND_PRIVACY.txt` is shown as the installer's license/EULA step and
  reachable afterward via Help → Terms & Privacy. **It's a generic
  unreviewed template** — have an actual lawyer look at it before relying on
  it commercially; see the file's own warning at the top.

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

Output lands in `dist/` — the file to actually share is the single
`Seven Bits Coffee Setup <version>.exe` (~80MB, bundles Electron, Node, and
the app; nothing else to install separately). Everything else in `dist/`
(`.blockmap`, `latest.yml`, `win-unpacked/`) is a build byproduct, not part
of the distributable — ignore or delete it.

Building for macOS/Linux from Windows (or vice versa) generally needs that
target OS or a CI runner for it — electron-builder doesn't fully
cross-compile signed installers from an unrelated OS.

The install itself is per-user (no admin rights needed): by default it
lands in `%LOCALAPPDATA%\Programs\seven-bits-coffee-desktop\`, separate
from the actual data (see above) so uninstalling never touches your orders/
menu/uploads.

### App icon

Not set yet — `electron-builder` falls back to a generic Electron icon
until one is provided. To add one: drop a square PNG (512x512 or 1024x1024
recommended) at `build/icon.png` and add `"icon": "build/icon.png"` under
both `build.win` and the top-level `build` key in `package.json` (electron-
builder generates the platform-specific `.ico`/`.icns` from it
automatically at build time) — then rebuild.

## Connecting from other devices on the same WiFi

The server already listens on every network interface, not just
`localhost` — the Network Address card (see above) shows the exact
addresses to use. Two things worth knowing:

- Use `http://`, not `https://` — this server has no TLS certificate.
  A self-signed one could be added, but every device would still see a
  one-time "connection not private" browser warning on first connect (this
  can't be avoided for a private IP address without a real domain name) —
  decided against it for now in favor of zero warnings. Ask if you want
  that added later; it's a bigger change than it sounds.
- If a phone/tablet can't reach it, the most common cause is the WiFi
  router's "client isolation" / "AP isolation" setting (common on guest
  networks, sometimes on by default) blocking devices from reaching each
  other even on the same network — check the router's settings if the
  address doesn't load.

## Staying in sync with the web app

This repo is a manual fork, not a subtree/submodule. To pull in a change
made on the web app side, copy the same files over:

```
server.js             (reapply the DATA_DIR/UPLOADS_DIR env-var lines and the
                        /api/network-info route if you copy the whole file)
index.html
css/
js/                    (EXCEPT js/ui/staff-home.js - see below)
uploads/               (only if branding/menu photos changed)
data-seed/             (only if the seed menu changed)
```

`js/ui/staff-home.js` has a desktop-only addition (the Network Address
card) on top of the web version's file - diff it rather than overwriting
wholesale, or you'll silently drop that card.

`main.js`, `package.json`, `.gitignore`, `TERMS_AND_PRIVACY.txt`, and this
README are desktop-only and aren't part of that sync.

## Why Electron

The app is a server + a browser-rendered UI already — Electron just bundles
a Chromium window and Node runtime around exactly that, which is the
smallest step from "runs via `node server.js` + open a browser" to "a real
installable app with its own icon and window." No app code had to be
rewritten for a different UI toolkit.
