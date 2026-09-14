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
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const PORT = 4173; // arbitrary fixed local port, unlikely to collide with anything else running on this machine

function seedWritableDirs() {
    const userDataDir = app.getPath("userData");
    const dataDir = path.join(userDataDir, "data");
    const uploadsDir = path.join(userDataDir, "uploads");
    fs.mkdirSync(dataDir, { recursive: true });

    // First run only: copy the bundled branding/menu photos (shipped
    // read-only inside the app) into the writable uploads folder, so the
    // shop looks fully set up out of the box instead of starting empty.
    // Later runs leave it alone - the admin panel's own uploads then live
    // only in the writable copy, never touching the bundled originals.
    if (!fs.existsSync(uploadsDir)) {
        const bundledUploads = path.join(__dirname, "uploads");
        fs.mkdirSync(uploadsDir, { recursive: true });
        if (fs.existsSync(bundledUploads)) {
            for (const file of fs.readdirSync(bundledUploads)) {
                fs.copyFileSync(path.join(bundledUploads, file), path.join(uploadsDir, file));
            }
        }
    }

    return { dataDir, uploadsDir };
}

function startServer() {
    const { dataDir, uploadsDir } = seedWritableDirs();
    process.env.PORT = String(PORT);
    process.env.SBC_DATA_DIR = dataDir;
    process.env.SBC_UPLOADS_DIR = uploadsDir;
    // Same default owner credentials the web version's start.bat ships on
    // first run (see server-settings.bat there) - not a new pattern, and
    // changing it is one login + a trip to Account Settings away. Only
    // applied if the user hasn't already set these themselves (e.g. by
    // launching with `OWNER_PASSWORD=... electron .` during development).
    process.env.OWNER_USERNAME = process.env.OWNER_USERNAME || "owner";
    process.env.OWNER_PASSWORD = process.env.OWNER_PASSWORD || "changeme123";
    require("./server.js");
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: "Seven Bits Coffee",
        autoHideMenuBar: true, // POS terminal look, not a browser chrome
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(() => {
    startServer();
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
