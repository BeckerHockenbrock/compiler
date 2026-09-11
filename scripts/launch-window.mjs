#!/usr/bin/env node

/**
 * iPhone 17 Pro Standalone Window Launcher (macOS)
 *
 * Launches the app in a dedicated chromeless window (no browser tabs,
 * no address bar, no "localhost" URL) using macOS Application Mode.
 *
 * Usage:
 *   node scripts/launch-window.mjs [phone|studio]
 */

import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";

const mode = process.argv[2] || "studio";
const PORT = 3000;
const targetUrl =
  mode === "phone"
    ? `http://localhost:${PORT}/?phone_only=true`
    : `http://localhost:${PORT}`;

const windowSize = mode === "phone" ? "450,960" : "1220,980";

function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isServerRunning()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  let devProcess = null;
  const alreadyRunning = await isServerRunning();

  if (!alreadyRunning) {
    console.log("⚡ Starting local server on background...");
    devProcess = spawn("npx", ["next", "dev", "-p", String(PORT)], {
      stdio: "inherit",
      shell: true,
    });

    const ready = await waitForServer();
    if (!ready) {
      console.error("❌ Failed to start Next.js dev server.");
      process.exit(1);
    }
  } else {
    console.log("⚡ Dev server already running on port 3000.");
  }

  console.log(`\n📱 Launching ${mode === "phone" ? "iPhone 17 Pro Device" : "iPhone 17 Pro Studio"} in standalone window...`);

  const hasChrome = fs.existsSync("/Applications/Google Chrome.app");

  if (hasChrome) {
    spawn(
      "open",
      [
        "-na",
        "Google Chrome",
        "--args",
        `--app=${targetUrl}`,
        `--window-size=${windowSize}`,
      ],
      { stdio: "ignore" }
    );
    console.log("✅ Standalone window opened via Chrome App Mode (no URL bar, no localhost).");
  } else {
    spawn("open", [targetUrl], { stdio: "ignore" });
    console.log(`✅ Opened in browser: ${targetUrl}`);
  }

  console.log(`\n✨ Environment running. Press Ctrl+C in this terminal to exit.\n`);

  if (devProcess) {
    process.on("SIGINT", () => {
      devProcess.kill();
      process.exit(0);
    });
  }
}

main();
