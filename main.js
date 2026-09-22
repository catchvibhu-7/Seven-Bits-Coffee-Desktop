/**
 * SEVEN BITS COFFEE - DESKTOP (Electron main process)
 *
 * This app's whole backend is a single plain-Node server.js with no
 * framework - the desktop wrapper just runs that same server in-process
 * (require() executes it immediately; it calls server.listen() itself with
 * no module.exports guard) and points a BrowserWindow at it instead of
 * asking the user to open a browser to localhost themselves (the old
 * start.bat workflow this replaces).
 */
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const PORT = 4173; // arbitrary fixed local port, unlikely to collide with anything else running on this machine

/** Other devices on the same WiFi/LAN (a kitchen tablet, a second till, a
 *  customer's phone) can reach this same server at one of these addresses -
 *  server.js already binds to every interface, not just localhost, so this
 *  is purely about making that already-working address discoverable. A
 *  packaged app has no visible console (unlike `npm start` in a terminal),
 *  so this needs to be shown IN the app - see showNetworkAddress() below. */
function getLanIPs() {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
        for (const iface of nets[name]) {
            if (iface.family === "IPv4" && !iface.internal) ips.push(iface.address);
        }
    }
    return ips;
}

function showNetworkAddress() {
    const ips = getLanIPs();
    const message =
        ips.length > 0
            ? `Other devices on this same WiFi/network can open this shop at:\n\n${ips.map((ip) => `http://${ip}:${PORT}`).join("\n")}\n\nUse http:// - this local server has no https certificate.`
            : "No network connection was detected - connect this computer to WiFi or Ethernet, then check again from the menu (press Alt to show it).";
    dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Network Address",
        message,
        buttons: ["OK"]
    });
}

/** Which installer produced this build - see scripts/set-variant.js, run
 *  before electron-builder packages either the "regular" or "demo" variant.
 *  Missing entirely (e.g. running `electron .` straight from a checkout
 *  with no build step) is treated the same as "regular": no demo content,
 *  no auto-seed. */
function readVariant() {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, "build", "variant.json"), "utf8"));
    } catch (e) {
        return { demo: false };
    }
}

function seedWritableDirs() {
    const userDataDir = app.getPath("userData");
    const dataDir = path.join(userDataDir, "data");
    const uploadsDir = path.join(userDataDir, "uploads");
    const logsDir = path.join(userDataDir, "logs");
    const backupsDir = path.join(userDataDir, "backups");
    // Both the demo-content auto-seed below and the upload-seeding right
    // after it are genuinely first-run-only - an update/reinstall over an
    // existing install (or one where the uninstaller's "keep data?" prompt
    // was answered yes - see build/installer.nsh) reuses this same
    // %APPDATA% folder untouched, so this check is what keeps updates from
    // ever wiping a shop's real data back to blank or demo content.
    const isFreshInstall = !fs.existsSync(dataDir);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });
    fs.mkdirSync(backupsDir, { recursive: true });

    // First run only: copy the bundled branding/menu photos (shipped
    // read-only inside the app) into the real writable uploads folder, so
    // the shop looks fully set up out of the box instead of starting empty.
    // Local disk is the default storage for uploads (see s3.js/Global
    // Settings for the opt-in S3 alternative) - a technical owner who turns
    // S3 on later re-uploads these through the admin panel themselves,
    // same as any other image.
    if (isFreshInstall) {
        const bundledUploads = path.join(__dirname, "uploads");
        if (fs.existsSync(bundledUploads)) {
            for (const file of fs.readdirSync(bundledUploads)) {
                try {
                    fs.copyFileSync(path.join(bundledUploads, file), path.join(uploadsDir, file));
                } catch (e) {
                    // One bad bundled file shouldn't block the rest of boot -
                    // a shop can always re-upload a missing photo by hand.
                }
            }
        }
    }

    return { dataDir, uploadsDir, logsDir, backupsDir, isFreshInstall };
}

/** Demo-variant-only, and only on a genuinely fresh install (see
 *  isFreshInstall above) - writes data-seed/demo-backup.json's catalog
 *  straight into the freshly created data/uploads folders, before
 *  server.js's own first-boot defaults (blank config, data-seed/menu-
 *  seed.json) get a chance to run, so the demo content wins. Deliberately
 *  not routed through server.js's applyBackupPayload() - the server hasn't
 *  started yet at this point, and there's no restore-time edge case to
 *  handle (no existing users, no archives) on a folder that was empty a
 *  moment ago. */
function applyDemoDataIfNeeded(dataDir, uploadsDir, isFreshInstall) {
    if (!isFreshInstall || !readVariant().demo) return;
    const demoPath = path.join(__dirname, "data-seed", "demo-backup.json");
    if (!fs.existsSync(demoPath)) return;
    const payload = JSON.parse(fs.readFileSync(demoPath, "utf8"));
    for (const [name, content] of Object.entries(payload.files || {})) {
        fs.writeFileSync(path.join(dataDir, name), JSON.stringify(content, null, 2));
    }
    // Same filename shape check applyBackupPayload() uses server-side -
    // this file ships inside our own signed installer, but there's no
    // reason to skip a cheap sanity check just because the source is
    // trusted this time too.
    for (const [filename, base64] of Object.entries(payload.uploads || {})) {
        if (!/^[a-f0-9]{16}\.(png|jpg|jpeg|gif|webp)$/i.test(filename)) continue;
        try {
            fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(base64, "base64"));
        } catch (e) {
            // One bad demo image shouldn't block the rest of first boot.
        }
    }
}

function startServer() {
    process.env.PORT = String(PORT);
    process.env.SBC_DEMO_BUILD = readVariant().demo ? "1" : "";
    // Same default owner credentials the web version's start.bat ships on
    // first run (see server-settings.bat there) - not a new pattern, and
    // changing it is one login + a trip to Account Settings away. Only
    // applied if the user hasn't already set these themselves (e.g. by
    // launching with `OWNER_PASSWORD=... electron .` during development).
    process.env.OWNER_USERNAME = process.env.OWNER_USERNAME || "owner";
    process.env.OWNER_PASSWORD = process.env.OWNER_PASSWORD || "changeme123";
    const { dataDir, uploadsDir, logsDir, backupsDir, isFreshInstall } = seedWritableDirs();
    applyDemoDataIfNeeded(dataDir, uploadsDir, isFreshInstall);
    process.env.SBC_DATA_DIR = dataDir;
    process.env.SBC_UPLOADS_DIR = uploadsDir;
    process.env.SBC_LOGS_DIR = logsDir;
    process.env.SBC_BACKUPS_DIR = backupsDir;
    require("./server.js");
    return { logsDir, backupsDir };
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: "Seven Bits Coffee",
        // Same build/icon.png the installer uses (see scripts/generate-icon.js)
        // - the exe/installer icon and this runtime window/taskbar icon are
        // two separate things electron-builder doesn't wire together on its
        // own, so both need to point at the one customization file.
        icon: path.join(__dirname, "build", "icon.png"),
        autoHideMenuBar: true, // POS terminal look, not a browser chrome - still reachable with Alt, which is where "Network Address" lives
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(async () => {
    let logsDir, backupsDir;
    try {
        ({ logsDir, backupsDir } = await startServer());
    } catch (e) {
        // Without this, a boot-time failure (e.g. the native SQLite binding
        // failing to load, or a port already in use) used to fail the whole
        // app.whenReady() promise silently - no window, no error, nothing a
        // shop owner could act on or even report accurately.
        dialog.showErrorBox("Seven Bits Coffee failed to start", String((e && e.stack) || e));
        app.quit();
        return;
    }
    createWindow();
    Menu.setApplicationMenu(
        Menu.buildFromTemplate([
            {
                label: "Network",
                submenu: [{ label: "Show Network Address", click: () => showNetworkAddress() }]
            },
            {
                label: "Help",
                submenu: [
                    {
                        // Opens with the OS's own default text-file handler
                        // (Notepad, etc.) rather than a custom in-app viewer -
                        // the same shown-and-accepted-at-install-time file,
                        // just reachable again afterward without reinstalling.
                        label: "Terms & Privacy",
                        click: () => shell.openPath(path.join(__dirname, "TERMS_AND_PRIVACY.txt"))
                    },
                    {
                        // One place to find the diagnostic event log (see
                        // logEvent() in server.js) when something needs
                        // troubleshooting - this packaged app has no visible
                        // console to read it from otherwise.
                        label: "Open Logs Folder",
                        click: () => shell.openPath(logsDir)
                    },
                    {
                        // The automatic hourly/daily local backups (see
                        // runScheduledBackupIfDue() in server.js) - browsable
                        // here for anyone who wants to manually copy the
                        // whole folder to a USB drive now and then, on top
                        // of whatever this local rolling window already
                        // covers.
                        label: "Open Backups Folder",
                        click: () => shell.openPath(backupsDir)
                    }
                ]
            }
        ])
    );
    showNetworkAddress(); // once on launch, so it's seen without hunting for the hidden menu bar
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
