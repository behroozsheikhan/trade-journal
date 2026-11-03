// Runs the Playwright e2e suite in sandboxes where the Playwright browser CDN
// is unreachable: extracts the npm-shipped @sparticuz/chromium binary plus its
// AL2023 shared libraries, then launches `playwright test` with the right env.
//
// Usage: npm run test:e2e:sandbox [-- --grep ...]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const pkgDir = path.dirname(new URL(import.meta.url).pathname) + "/../node_modules/@sparticuz/chromium";
const al2023Dir = path.join(os.tmpdir(), "al2023");

if (!fs.existsSync(path.join(al2023Dir, "lib", "libnss3.so"))) {
  const tarBr = path.join(pkgDir, "bin", "al2023.tar.br");
  const tar = path.join(os.tmpdir(), "al2023.tar");
  fs.writeFileSync(tar, zlib.brotliDecompressSync(fs.readFileSync(tarBr)));
  fs.mkdirSync(al2023Dir, { recursive: true });
  execFileSync("tar", ["-xf", tar, "-C", al2023Dir]);
  console.log("[sandbox] extracted AL2023 libs to", al2023Dir);
}

process.env.LD_LIBRARY_PATH = [path.join(al2023Dir, "lib"), process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");

const mod = await import("@sparticuz/chromium");
const chromium = mod.default ?? mod;
process.env.PW_CHROMIUM_PATH = await chromium.executablePath();
console.log("[sandbox] chromium:", process.env.PW_CHROMIUM_PATH);

const r = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});
process.exit(r.status ?? 1);
