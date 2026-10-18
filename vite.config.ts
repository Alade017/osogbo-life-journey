import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// Apply the same compatibility export in production and Vite's dependency optimizer.
function threeTimerClock() {
  return {
    name: "osun-three-timer-clock",
    resolveId: {
      order: "pre" as const,
      handler(source: string, importer?: string) {
        const parent = importer?.replaceAll("\\", "/");
        if (
          (source === "./core/Clock.js" && parent?.endsWith("/three/src/Three.Core.js")) ||
          source.replaceAll("\\", "/").endsWith("/three/src/core/Clock.js")
        )
          return fileURLToPath(new URL("./src/lib/three-timer-clock.ts", import.meta.url));
        return null;
      },
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // Server credentials stay in the Node environment; only VITE_* values reach the browser.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  const nitroPreset =
    process.env["NITRO_PRESET"] ?? (process.env["VERCEL"] === "1" ? "vercel" : "node-server");
  return {
    cacheDir: "node_modules/.vite-game",
    plugins: [
      threeTimerClock(),
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      ...(command === "build" ? [nitro({ preset: nitroPreset })] : []),
      react(),
    ],
    resolve: {
      alias: [
        // Resolve the modular Three entry so its Clock export can use Timer.
        // Fiber 9 still requires the Clock interface; avoid an unrelated major upgrade.
        {
          find: /^three$/,
          replacement: fileURLToPath(new URL("./node_modules/three/src/Three.js", import.meta.url)),
        },
        {
          find: /^(?:\.\/core\/Clock\.js|.*\/three\/src\/core\/Clock\.js)$/,
          replacement: fileURLToPath(new URL("./src/lib/three-timer-clock.ts", import.meta.url)),
        },
        { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      ],
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
    },
    optimizeDeps: { rolldownOptions: { plugins: [threeTimerClock()] } },
    build: {
      // The map/house 3D runtime is route-split and currently ~912 kB raw (~242 kB gzip).
      // Keep a meaningful ceiling above it while still warning on future 3D bundle growth.
      chunkSizeWarningLimit: 1_000,
    },
    server: { host: "127.0.0.1", port: 3000, strictPort: true },
  };
});
