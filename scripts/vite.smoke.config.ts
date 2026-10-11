import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  cacheDir: "node_modules/.vite-neighborhood-smoke",
  root: fileURLToPath(new URL("..", import.meta.url)),
  server: { host: "127.0.0.1", port: 3011, strictPort: true },
});
