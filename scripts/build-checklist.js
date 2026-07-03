import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.resolve(root, "task-checklist");
const target = path.resolve(root, "public", "checklist");

const COPY_ITEMS = [
  "index.html",
  "auth.html",
  "app.js",
  "auth.js",
  "config.js",
  "firebase-init.js",
  "styles.css",
  "auth.css",
  "manifest.json",
  "sw.js",
  "dist",
  "assets",
  "icons",
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === "node_modules") continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

if (!fs.existsSync(source)) {
  console.warn(`[build-checklist] Pasta não encontrada: ${source}`);
  process.exit(0);
}

fs.mkdirSync(target, { recursive: true });

for (const item of COPY_ITEMS) {
  const src = path.join(source, item);
  if (!fs.existsSync(src)) {
    console.warn(`[build-checklist] Ignorando (ausente): ${item}`);
    continue;
  }
  const dest = path.join(target, item);
  copyRecursive(src, dest);
  console.log(`[build-checklist] Copiado: ${item}`);
}

console.log("[build-checklist] Checklist disponível em /checklist/");
