import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function auditMigrationJournal(entries, files) {
  const issues = [];
  const tags = new Set();
  entries.forEach((entry, index) => {
    if (entry.idx !== index) issues.push(`Nonsequential journal index: ${entry.tag}`);
    if (tags.has(entry.tag)) issues.push(`Duplicate journal tag: ${entry.tag}`);
    tags.add(entry.tag);
    if (!files.includes(`${entry.tag}.sql`)) issues.push(`Missing SQL file: ${entry.tag}`);
    if (index && entry.when <= entries[index - 1].when)
      issues.push(`Nonincreasing journal timestamp: ${entry.tag}`);
  });
  for (const file of files.filter((name) => name.endsWith(".sql"))) {
    if (!tags.has(file.slice(0, -4))) issues.push(`Unregistered SQL file: ${file}`);
  }
  return issues;
}

export function safeEndpoint(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash)
    throw new Error("Use an endpoint without credentials, query parameters, or fragments.");
  if (url.protocol === "wss:") url.protocol = "https:";
  if (url.protocol === "ws:") url.protocol = "http:";
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use HTTP(S) or WS(S).");
  return url;
}

async function main() {
  const migrationDirectory = new URL("../drizzle/migrations/", import.meta.url);
  const journal = JSON.parse(
    await readFile(new URL("meta/_journal.json", migrationDirectory), "utf8"),
  );
  const issues = auditMigrationJournal(journal.entries, await readdir(migrationDirectory));
  const results = [
    {
      check: "Repository migration journal",
      passed: issues.length === 0,
      count: journal.entries.length,
      latest: journal.entries.at(-1)?.tag,
      issues,
    },
  ];
  const args = process.argv.slice(2);
  let site;
  let origin;
  const servers = [];
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i + 1]) throw new Error("Each option requires a value.");
    if (args[i] === "--site") site = safeEndpoint(args[i + 1]);
    else if (args[i] === "--multiplayer") servers.push(safeEndpoint(args[i + 1]));
    else if (args[i] === "--origin") origin = safeEndpoint(args[i + 1]).origin;
    else throw new Error("Supported options: --site, --multiplayer, --origin.");
  }
  async function probe(check, url, headers, validate) {
    try {
      const response = await fetch(url, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      const passed = await validate(response);
      results.push({ check, endpoint: url.origin, passed, status: response.status });
    } catch {
      // Do not print request details, response bodies, or environment values.
      results.push({ check, endpoint: url.origin, passed: false, error: "Request failed" });
    }
  }
  if (site)
    await probe("Frontend delivery", site, {}, async (response) => {
      return response.status === 200 && response.headers.get("content-type")?.includes("text/html");
    });
  for (const server of servers) {
    const health = new URL("/healthz", server);
    await probe("Colyseus health", health, {}, async (response) => {
      if (response.status !== 200) return false;
      return (await response.json()).status === "ok";
    });
    if (origin)
      await probe("Allowed origin", health, { Origin: origin }, async (response) => {
        return (
          response.status === 200 && response.headers.get("access-control-allow-origin") === origin
        );
      });
    await probe(
      "Rejected origin",
      health,
      { Origin: "https://release-check.invalid" },
      async (response) => {
        return response.status === 403 && !response.headers.get("access-control-allow-origin");
      },
    );
  }
  console.log(
    JSON.stringify(
      {
        results,
        unverified: [
          "Hosted migration ledger and RLS",
          "Authenticated multiplayer and Redis routing",
          "Travel, economy and cross-session persistence",
          "Responsive accessibility and device performance",
        ],
      },
      null,
      2,
    ),
  );
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error(
      "Readiness check failed. Check arguments and repository files; no changes were made.",
    );
    process.exitCode = 1;
  });
}
