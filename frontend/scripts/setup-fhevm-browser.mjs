import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 1. Ship tfhe_bg.wasm as a static asset (Next serves /tfhe_bg.wasm from `public`).
 * 2. Patch fhevmjs so __wbg_init fetches from that URL instead of bundling WASM
 *    (webpack cannot resolve wasm-bindgen "wbg" glue from raw .wasm imports).
 *
 * Runs on `npm install` via package.json → postinstall.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const wasm = "tfhe_bg.wasm";
const srcTfhe = path.join(root, "node_modules", "tfhe", wasm);
const pubDest = path.join(root, "public", wasm);
const webJsPath = path.join(root, "node_modules", "fhevmjs", "lib", "web.js");

if (!fs.existsSync(srcTfhe)) {
  console.warn("[setup-fhevm-browser] missing", srcTfhe);
  process.exit(0);
}

fs.mkdirSync(path.dirname(pubDest), { recursive: true });
fs.copyFileSync(srcTfhe, pubDest);
console.log("[setup-fhevm-browser] wasm → public/" + wasm);

if (!fs.existsSync(webJsPath)) {
  console.warn("[setup-fhevm-browser] missing", webJsPath);
  process.exit(0);
}

let web = fs.readFileSync(webJsPath, "utf8");
const needle = `    if (typeof input === 'undefined') {
        input = new URL('tfhe_bg.wasm', import.meta.url);
    }`;
const patched = `    if (typeof input === 'undefined') {
        input = '/tfhe_bg.wasm';
    }`;

if (!web.includes("new URL('tfhe_bg.wasm', import.meta.url)")) {
  console.warn("[setup-fhevm-browser] patch pattern not found in fhevmjs — skipping edit");
} else if (!web.includes(patched.trim())) {
  web = web.replace(needle, patched);
  fs.writeFileSync(webJsPath, web);
  console.log("[setup-fhevm-browser] patched fhevmjs/lib/web.js (__wbg_init → /tfhe_bg.wasm)");
} else {
  console.log("[setup-fhevm-browser] fhevm web.js already patched");
}
