import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const configuredUrl = loadEnv(mode, process.cwd(), "VITE_")["VITE_PUBLIC_SITE_URL"];
  let siteOrigin: string | undefined;
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if (url.protocol === "https:" || url.protocol === "http:") siteOrigin = url.origin;
    } catch {
      // Keep local builds usable until a production origin is configured.
    }
  }

  return {
    cacheDir: "../node_modules/.vite-public",
    root: fileURLToPath(new URL("./public-site", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    plugins: [
      react(),
      {
        name: "public-site-seo-origin",
        transformIndexHtml(html: string) {
          if (!siteOrigin) return html;
          return html
            .replaceAll(
              'content="/social-preview.png"',
              `content="${siteOrigin}/social-preview.png"`,
            )
            .replace("</head>", `  <link rel="canonical" href="${siteOrigin}/" />\n  </head>`);
        },
      },
    ],
    build: { outDir: "../dist-public", emptyOutDir: true },
    server: { host: "127.0.0.1", port: 3010 },
  };
});
