import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Isolated renderer fixture: no authentication, database or TanStack server plugins.
export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  cacheDir: "node_modules/.vite-home-benchmark",
  publicDir: false,
  logLevel: "error",
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});
