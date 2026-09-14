#!/usr/bin/env node
/**
 * SEVEN BITS COFFEE - DESKTOP - ICON GENERATOR
 * Location: /scripts/generate-icon.js
 *
 * This app is meant to be re-brandable per shop, so the installer's icon
 * shouldn't be hardcoded to whoever's logo happened to exist when this
 * template was built. build/icon.png is the ONE fixed path package.json's
 * build.icon points at - this script's only job is turning an arbitrary
 * (often non-square) logo into a valid square PNG at that path, so anyone
 * customizing this app for their own shop just needs their own logo file
 * and this one command, no editing package.json or touching electron-
 * builder's config at all.
 *
 * Usage: node scripts/generate-icon.js path/to/your-logo.png
 *        npm run icon -- path/to/your-logo.png
 */
const path = require("path");
const { Jimp } = require("jimp");

const SIZE = 1024; // electron-builder generates every smaller size it needs (16/32/48/256...) from this one square source

async function main() {
    const sourcePath = process.argv[2];
    if (!sourcePath) {
        console.error("Usage: node scripts/generate-icon.js path/to/your-logo.png");
        process.exit(1);
    }

    const outPath = path.join(__dirname, "..", "build", "icon.png");
    const logo = await Jimp.read(sourcePath);

    // Fit the whole logo inside a square canvas (contain, not crop/stretch)
    // - a rectangular logo shouldn't lose part of itself or get squished
    // just because icons have to be square. Padding fills with the source
    // image's own background (transparent if it has an alpha channel,
    // whatever solid color it already had otherwise) - not something this
    // script invents.
    logo.contain({ w: SIZE, h: SIZE });

    await logo.write(outPath);
    console.log(`Wrote ${outPath} (${SIZE}x${SIZE}) from ${sourcePath}`);
    console.log("Run `npm run dist:win` (or dist:mac/dist:linux) to rebuild with it.");
}

main().catch((err) => {
    console.error("Could not generate icon:", err.message);
    process.exit(1);
});
