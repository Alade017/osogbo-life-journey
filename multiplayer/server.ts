import { matchMaker, Server, type ServerOptions } from "colyseus";
import { NeighborhoodRoom } from "./neighborhood-room.ts";

const redisUrl = process.env["REDIS_URL"]?.trim();
if (process.env["RAILWAY_ENVIRONMENT_NAME"] && !redisUrl)
  throw new Error("REDIS_URL is required for Colyseus services deployed on Railway.");

const configuredOrigins = process.env["MULTIPLAYER_ALLOWED_ORIGINS"]
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const allowedOrigins = new Set(
  configuredOrigins?.length
    ? configuredOrigins
    : process.env["NODE_ENV"] === "production" || process.env["RAILWAY_ENVIRONMENT_NAME"]
      ? []
      : [
          "http://127.0.0.1:3000",
          "http://localhost:3000",
          "http://127.0.0.1:3010",
          "http://localhost:3010",
        ],
);

matchMaker.controller.getCorsHeaders = (headers) => {
  const origin = headers.get("origin");
  return {
    "Access-Control-Allow-Origin": !origin || allowedOrigins.has(origin) ? (origin ?? "*") : "",
  };
};

const publicAddress = (
  process.env["MULTIPLAYER_PUBLIC_ADDRESS"] ?? process.env["RAILWAY_PUBLIC_DOMAIN"]
)
  ?.replace(/^wss?:\/\//, "")
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

const serverOptions: ServerOptions = {
  ...(publicAddress ? { publicAddress } : {}),
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
    app.get("/healthz", (_request, response) => {
      response.status(200).json({ status: "ok" });
    });
  },
};

const redisOptions = redisUrl
  ? await Promise.all([import("@colyseus/redis-presence"), import("@colyseus/redis-driver")]).then(
      ([presence, driver]) => ({
        presence: new presence.RedisPresence(redisUrl),
        driver: new driver.RedisDriver(redisUrl),
      }),
    )
  : {};

const server = new Server({ ...serverOptions, ...redisOptions });

server.define("neighborhood", NeighborhoodRoom).filterBy(["locationId"]);

const port = Number(process.env["PORT"] ?? process.env["MULTIPLAYER_PORT"] ?? 2567);
const host = process.env["MULTIPLAYER_HOST"] ?? (process.env["PORT"] ? "0.0.0.0" : "127.0.0.1");

if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error("PORT or MULTIPLAYER_PORT must be a valid TCP port.");

await server.listen(port, host);
console.info(`OSUN LIFE multiplayer server listening at ${host}:${port}`);
