/**
 * Whale-pet plugin — DeepSeek Harness adapter.
 *
 * Cordis plugin for DeepSeek Harness: launches the always-on-top DESKTOP pet
 * (an Electron window running the app in desktop/) and the pet connects
 * directly to the harness /api/events.mux stream. This file only runs inside
 * the harness; the OpenCode adapter lives in ../opencode.
 *
 * Installing this plugin downloads NOTHING: package.json declares no
 * dependencies. Electron is installed globally by the user (npm i -g
 * electron), which on Windows puts it at %APPDATA%\npm\node_modules\electron
 * \dist\electron.exe - the standard place any Node machine puts a globally
 * installed package, unrelated to the harness. When it is missing the plugin
 * logs a hint and harness boot is not blocked.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL("../..", import.meta.url));
const EXE = process.platform === "win32" ? "electron.exe" : "electron";
let pet = null;

function log(ctx, msg) {
  try { ctx.logger?.info?.("whale-pet: " + msg); } catch {}
}

/**
 * Resolve the Electron executable from a global install (npm i -g electron).
 * Candidate directories, first match wins:
 *   1. WHALE_PET_ELECTRON_DIR (explicit override)
 *   2. %APPDATA%\npm\node_modules\electron\dist (Windows npm global default)
 *   3. `npm root -g` output + electron\dist (respects a custom npm prefix)
 */
function resolveElectron() {
  const dirs = [];
  if (process.env.WHALE_PET_ELECTRON_DIR) dirs.push(process.env.WHALE_PET_ELECTRON_DIR);
  if (process.env.APPDATA) dirs.push(join(process.env.APPDATA, "npm", "node_modules", "electron", "dist"));
  try {
    const res = spawnSync("npm", ["root", "-g"], { encoding: "utf-8", timeout: 10000, windowsHide: true });
    if (res.status === 0 && res.stdout) dirs.push(join(res.stdout.trim(), "electron", "dist"));
  } catch {}
  for (const dir of dirs) {
    const exe = join(dir, EXE);
    if (existsSync(exe)) return exe;
  }
  return null;
}

function launchDesktopPet(ctx) {
  const exe = resolveElectron();
  if (!exe) {
    log(ctx, "Electron not found - install it globally: npm i -g electron (see GitHub page); desktop pet not started");
    return;
  }
  try {
    pet = spawn(exe, [join(__dirname, "desktop")], { detached: true, stdio: "ignore", windowsHide: true });
    pet.unref();
    log(ctx, "desktop pet launched (" + exe + ")");
    pet.on("error", (error) => log(ctx, "desktop pet error: " + String(error)));
  } catch (error) {
    log(ctx, "desktop pet launch skipped: " + String(error));
  }
}

/** Host plugin body - launch the always-on-top desktop pet with the harness. */
export function apply(ctx) {
  ctx.effect(() => {
    launchDesktopPet(ctx);
    return () => {
      try { pet?.kill(); } catch {}
    };
  }, "whale-pet: desktop pet");
}
