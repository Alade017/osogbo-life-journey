import { Server } from "colyseus";
import { NeighborhoodRoom } from "./neighborhood-room.ts";

const configuredOrigins = process.env["MULTIPLAYER_ALLOWED_ORIGINS"]
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const allowedOrigins = new Set(
  configuredOrigins?.length
    ? configuredOrigins
    : [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3010",
        "http://localhost:3010",
      ],
);

const server = new Server({
  express: (app) => {
    app.use((request, response, next) => {
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.has(origin)) {
        response.status(403).end();
        return;
      }
      if (origin) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Vary", "Origin");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      }
      if (request.method === "OPTIONS") {
        response.status(204).end();
        return;
      }
      next();
    });
  },
});

server.define("neighborhood", NeighborhoodRoom).filterBy(["locationId"]);

const port = Number(process.env["MULTIPLAYER_PORT"] ?? 2567);
const host = process.env["MULTIPLAYER_HOST"] ?? "127.0.0.1";

if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error("MULTIPLAYER_PORT must be a valid TCP port.");

await server.listen(port, host);
console.info(`OSOGBO LIFE multiplayer server listening at ${host}:${port}`);
