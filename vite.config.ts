import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  // Server credentials stay in the Node environment; only VITE_* values reach the browser.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      ...(command === "build"
        ? [nitro({ preset: process.env["NITRO_PRESET"] === "vercel" ? "vercel" : "node-server" })]
        : []),
      react(),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
    },
    server: { host: "127.0.0.1", port: 3000, strictPort: true },
  };
});
