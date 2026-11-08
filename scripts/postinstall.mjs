// Rebuild native modules (better-sqlite3) against the installed Electron ABI.
// This is needed to RUN the Electron app (`npm run dev`), but it clobbers the
// Node-ABI build that Vitest needs. So:
//   - default: rebuild for Electron (local dev)
//   - TJ_ELECTRON_REBUILD=0: skip (used by the CI test job, which runs Vitest
//     under plain Node and lets better-sqlite3 install its own Node prebuild)
import { spawnSync } from "node:child_process";

if (process.env.TJ_ELECTRON_REBUILD === "0") {
  console.log("[postinstall] TJ_ELECTRON_REBUILD=0 -> skipping Electron ABI rebuild (Node ABI kept for tests)");
  process.exit(0);
}

const bin =
  process.platform === "win32"
    ? "node_modules/.bin/electron-builder.cmd"
    : "node_modules/.bin/electron-builder";

try {
  // .cmd files require shell:true on Windows, otherwise spawnSync throws EINVAL
  const r = spawnSync(bin, ["install-app-deps"], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.warn(`[postinstall] electron-builder install-app-deps exited with ${r.status} (non-fatal)`);
  }
} catch (e) {
  console.warn("[postinstall] skipped install-app-deps:", e?.message ?? e);
}
