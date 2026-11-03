// Rebuild native modules (better-sqlite3) against the installed Electron ABI.
// Non-fatal: unit tests run against the plain Node ABI build, and CI runners
// have full toolchains, so a failure here must not break `npm install`.
import { spawnSync } from "node:child_process";

const bin =
  process.platform === "win32"
    ? "node_modules/.bin/electron-builder.cmd"
    : "node_modules/.bin/electron-builder";

try {
  const r = spawnSync(bin, ["install-app-deps"], { stdio: "inherit" });
  if (r.status !== 0) {
    console.warn(`[postinstall] electron-builder install-app-deps exited with ${r.status} (non-fatal)`);
  }
} catch (e) {
  console.warn("[postinstall] skipped install-app-deps:", e?.message ?? e);
}
