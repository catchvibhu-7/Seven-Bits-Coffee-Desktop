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
- **Encrypted backup/restore**: Admin → Global Settings → Data Backup has an
  "ENCRYPTED BACKUP" section below the existing plain one - it bundles
  every setting/order/staff record PLUS the actual uploaded photos (the
  plain backup only includes their metadata, not the files themselves),
  gzips and AES-256-GCM-encrypts the result with a passphrase you set, and
  downloads it as a `.sbcbackup` file. **There is no recovery if you forget
  that passphrase** - store it somewhere safe, separately from the backup
  file itself. Restoring one (Global Admin only, same as the plain restore)
  puts back settings, orders, AND the photos. Not wired to auto-upload to
  Google Drive yet - see the next section.
- **Diagnostic event log**: server boot, login attempts, orders placed, and
  any crash get written to `logs/` (one plain-text file per day) -
  reachable via Help → Open Logs Folder. Separate from the in-app Admin
  Audit Log, which tracks staff actions, not troubleshooting events.
- **Automatic local backups**: runs unattended, no passphrase needed (see
  "Automatic vs. manual backups" below for why that's fine here). One
  snapshot per hour, saved to `backups/YYYY-MM-DD/backup-HHMM.json.gz` -
  each calendar day gets its own folder, and any folder older than 7 days
  is deleted automatically. Browse them via Help → Open Backups Folder.
  This is a rolling local safety net (undo a bad change from a few hours
  ago), not off-site disaster recovery - that's what the encrypted backup
  above is for.

### Automatic vs. manual backups

Two different problems, two different designs:

|  | Automatic (`backups/`) | Manual encrypted (`.sbcbackup`) |
|---|---|---|
| Runs | Every hour, unattended | Only when you click the button |
| Encrypted | No | Yes (AES-256-GCM, your passphrase) |
| Retention | 7 days, then auto-deleted | Forever, until you delete the file |
| Lives | On this same computer | Wherever you save/move it |
| Protects against | "I fat-fingered something an hour ago" | This computer being lost, stolen, or dying |

The automatic ones skip encryption because they never leave this machine -
they sit next to the live `data/` files they're backing up, with the exact
same exposure those already have. Encrypting them would just mean managing
a passphrase for a background job that can't ask you for one, for no real
security gain.

## Google Drive backup (not built yet - needs your input)

The encrypted backup above already produces a file you can manually drop in
Drive today. Making the app do that automatically needs a Google Cloud
project with OAuth credentials, which only the account owner can create (no
generic "just connect" exists for third-party apps):

1. Create a free project at console.cloud.google.com
2. Enable the Google Drive API on it
3. Create an OAuth 2.0 Client ID (type: **Desktop app**)
4. Provide the Client ID + Client Secret

Once available, the plan is: `drive.appdata` scope (a hidden per-app folder
regular Drive browsing can't see or touch, and it skips Google's stricter
verification process required for broader Drive access), loopback-flow
OAuth (opens your system browser, a local temporary HTTP server on this
machine catches the redirect - the modern replacement for the old
copy-paste-a-code flow Google has deprecated), refresh token encrypted at
rest via Electron's `safeStorage`. The backup content itself keeps using
the passphrase-based encryption above, not tied to the OAuth connection -
that's what keeps a backup restorable on a brand new computer.

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

`...\logs\` sits next to `data\` - a plain-text, one-file-per-day event log
(server start, login attempts, orders placed, and any crash) for
troubleshooting, since a packaged app has no visible console. Reach it
anytime via **Help → Open Logs Folder** in the app's menu (press Alt to
show the menu bar). This is separate from the in-app Admin Audit Log, which
tracks staff actions (config/menu changes etc.), not diagnostic events.

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

### App icon (customizable per shop)

This app is meant to be re-branded per install, so the icon isn't hardcoded
- `package.json`'s `build.icon` always points at the one fixed path
`build/icon.png` (committed to this repo, currently generated from Seven
Bits Coffee's own logo), and `main.js` uses that same file for the runtime
window/taskbar icon. electron-builder generates every platform-specific
format (`.ico`/`.icns`/PNGs) from it automatically at build time.

**To use a different shop's logo**, no code editing needed:

```bash
npm run icon -- path/to/your-logo.png
npm run dist:win
```

`scripts/generate-icon.js` fits whatever image you give it (any
size/aspect ratio) onto a square 1024x1024 canvas without cropping or
stretching it, and overwrites `build/icon.png` in place. Uses `jimp`
(pure JavaScript, no native build step) - the only devDependency this
added.

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
