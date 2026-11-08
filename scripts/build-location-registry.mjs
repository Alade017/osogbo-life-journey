// Builds src/data/location-registry.json from the location inserts in supabase/migrations.
// Later migrations win per slug, matching the `on conflict do update` upserts.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const outFile = join(root, "src", "data", "location-registry.json");

/** Splits a SQL values list into top-level tuples, honouring quotes and nesting. */
function tuples(body) {
  const rows = [];
  let depth = 0;
  let quoted = false;
  let start = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === "'" && body[i + 1] === "'") i++;
      else if (ch === "'") quoted = false;
      continue;
    }
    if (ch === "'") quoted = true;
    else if (ch === "(") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) rows.push(body.slice(start, i));
    }
  }
  return rows;
}

/** Splits one tuple into SQL values at top-level commas. */
function values(row) {
  const out = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (quoted) {
      current += ch;
      if (ch === "'" && row[i + 1] === "'") {
        current += row[++i];
      } else if (ch === "'") quoted = false;
      continue;
    }
    if (ch === "'") quoted = true;
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function literal(raw) {
  if (raw === undefined) return undefined;
  const text = raw.replace(/::[a-z]+(\[\])?$/i, "").trim();
  if (/^'.*'$/s.test(text)) return text.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true";
  if (/^null$/i.test(text)) return null;
  const array = text.match(/^array\[(.*)\]/is);
  if (array) {
    const inner = array[1].trim();
    if (!inner) return [];
    return values(inner).map((item) => literal(item.replace(/::text$/i, "")));
  }
  return undefined;
}

const registry = new Map();
for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  const pattern = /insert into public\.locations\s*\(([^)]*)\)\s*values\s*/gi;
  let match;
  while ((match = pattern.exec(sql))) {
    const columns = match[1].split(",").map((name) => name.trim().replace(/"/g, ""));
    const bodyStart = match.index + match[0].length;
    const end = sql.indexOf(";", bodyStart);
    for (const row of tuples(sql.slice(bodyStart, end))) {
      const cells = values(row);
      const record = Object.fromEntries(columns.map((column, index) => [column, literal(cells[index])]));
      if (typeof record.slug !== "string") continue;
      registry.set(record.slug, {
        slug: record.slug,
        name: record.name,
        category: record.map_category ?? null,
        canvas_x: record.canvas_x ?? null,
        canvas_y: record.canvas_y ?? null,
        neighbor_slugs: Array.isArray(record.neighbor_slugs) ? record.neighbor_slugs : [],
        is_active: record.is_active !== false,
        source: file,
      });
    }
  }
}

const locations = [...registry.values()].sort((a, b) => a.slug.localeCompare(b.slug));
writeFileSync(outFile, `${JSON.stringify({ locations }, null, 2)}\n`);
console.log(`Wrote ${locations.length} locations to ${outFile}`);
