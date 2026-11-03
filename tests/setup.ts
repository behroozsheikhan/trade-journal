import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";

// jsdom may not expose crypto.randomUUID — polyfill from Node.
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
