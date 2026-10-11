import { existsSync } from "node:fs";
import type { Config } from "drizzle-kit";

if (existsSync(".env")) process.loadEnvFile(".env");

export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  connectionString: process.env["DATABASE_URL"] ?? "",
} satisfies Config;
