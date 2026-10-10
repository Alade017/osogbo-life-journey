import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  cacheDir: "../node_modules/.vite-public",
  root: fileURLToPath(new URL("./public-site", import.meta.url)),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  build: { outDir: "../dist-public", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 3010 },
});
