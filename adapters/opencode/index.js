/**
 * whale-pet OpenCode adapter.
 *
 * Runs inside OpenCode (https://opencode.ai). Two jobs:
 *   1. On load, spawns the desktop pet (global electron + ../desktop app).
 *   2. Subscribes to the OpenCode event bus and forwards session activity to
 *      the pet over HTTP (POST http://127.0.0.1:3199/event), translating to
 *      the same {type,data} event vocabulary the pet's state machine knows.
 *
 * Install: opencode plugin add <this directory or a git url to it>
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, join, dirname } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(HERE, "..", "..", "desktop");
const INLET = "http://127.0.0.1:" + (process.env.WHALE_PET_HTTP_PORT || "3199") + "/event";
const EXE = process.platform === "win32" ? "electron.exe" : "electron";
let lastStream = 0;

/** Resolve the globally installed Electron executable (same rules as the DSH host plugin). */
function resolveElectron() {
  const dirs = [];
  if (process.env.WHALE_PET_ELECTRON_DIR) dirs.push(process.env.WHALE_PET_ELECTRON_DIR);
  if (process.env.APPDATA) dirs.push(join(process.env.APPDATA, "npm", "node_modules", "electron", "dist"));
  try {
    const r = execSync("npm root -g", { encoding: "utf-8", timeout: 10000, windowsHide: true });
    if (r) dirs.push(join(r.trim(), "electron", "dist"));
  } catch {}
  for (const d of dirs) {
    const exe = join(d, EXE);
    if (existsSync(exe)) return exe;
  }
  return null;
}

function send(type, data) {
  try {
    fetch(INLET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data: data || {} }),
    }).catch(() => {});
  } catch {}
}

/** Spawn the desktop pet once (single-instance lock in the pet dedupes restarts). */
function ensurePet() {
  if (!existsSync(DESKTOP)) return;
  const exe = resolveElectron();
  if (!exe) return;
  try {
    const p = spawn(exe, [DESKTOP], { detached: true, stdio: "ignore", windowsHide: true });
    p.unref();
  } catch {}
}

// OpenCode plugin entry: load the pet and bridge the event bus.
export const whalePet = async (ctx) => {
  ensurePet();
  return {
    event: async ({ event }) => {
      const e = event;
      if (!e || !e.type) return;
      const now = Date.now();
      switch (e.type) {
        case "session.created":
          send("turn/start");
          break;
        case "session.updated":
          if (e.properties?.info?.time?.completed) send("turn/end");
          break;
        case "session.status":
          if (e.properties?.status?.time?.completed) send("turn/end");
          break;
        case "session.idle": // deprecated but still emitted
          send("turn/end");
          break;
        case "session.error":
          send("turn/end", { reason: { kind: "error" } });
          break;
        case "message.part.updated":
          // streaming text: throttle so the pet just swims, no spam
          if (now - lastStream > 400) {
            lastStream = now;
            send("assistant/chunk", { chunk: { type: "text-delta" } });
          }
          break;
        case "file.edited":
          send("tool/call", { name: "edit" });
          break;
        case "permission.updated":
          send("approval/asked");
          break;
        default:
          break;
      }
    },
  };
};
