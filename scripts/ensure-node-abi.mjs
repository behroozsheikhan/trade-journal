// `pretest` hook: make sure better-sqlite3 is built for the CURRENT Node.js ABI
// (a previous `electron-builder install-app-deps` may have rebuilt it for
// Electron's ABI, which plain Node cannot load in Vitest).
import { spawnSync } from "node:child_process";
import fs from "node:fs";

// Fast path: if better-sqlite3 already loads under the current Node, do nothing.
function loadsUnderCurrentNode() {
  const r = spawnSync(
    process.execPath,
    ["-e", "require('better-sqlite3')"],
    { cwd: process.cwd(), stdio: "ignore" },
  );
  return r.status === 0;
}

if (loadsUnderCurrentNode()) {
  process.exit(0);
}

function rebuild(extraEnv = {}) {
  // use the global npm through the shell (node_modules/.bin does not contain npm)
  const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(cmd, ["rebuild", "better-sqlite3", "--no-audit", "--no-fund"], {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: true,
  });
}

let r = rebuild();
if (r.status !== 0) {
  // Offline/sandbox fallback: compile against the locally installed Node headers
  // (prebuild downloads and nodejs.org are unreachable there).
  const prefix = process.env.npm_config_nodedir || "/usr/local";
  if (fs.existsSync(`${prefix}/include/node/node_api.h`)) {
    console.warn(`[pretest] retrying better-sqlite3 rebuild with --nodedir=${prefix}`);
    r = rebuild({ npm_config_nodedir: prefix });
  }
}
if (r.status !== 0) {
  console.warn(`[pretest] better-sqlite3 rebuild failed (status ${r.status}); DB unit tests may fail to load the native module`);
}
