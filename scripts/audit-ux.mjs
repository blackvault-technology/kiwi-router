import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "client/src/lib/uxEnhancementCatalog.ts");
const catalog = fs.readFileSync(catalogPath, "utf8");
const ids = [...catalog.matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]);
const unique = [...new Set(ids)];
const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (/\.(tsx?|css)$/.test(entry.name)) sourceFiles.push(absolute);
  }
}
walk(path.join(root, "client/src"));
const source = sourceFiles.filter((file) => file !== catalogPath).map((file) => fs.readFileSync(file, "utf8")).join("\n");
const rows = unique.map((id) => ({ id, referenced: source.includes(id) }));
console.log(JSON.stringify({ count: unique.length, ids: unique, referencedCount: rows.filter((row) => row.referenced).length, unreferenced: rows.filter((row) => !row.referenced).map((row) => row.id) }, null, 2));
