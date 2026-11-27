import { expect, it } from "vitest";
import { multiplayerEndpoints } from "@/lib/multiplayer-endpoints";
it("keeps local development working but never silently connects public players to their localhost", () => {
  expect(multiplayerEndpoints(undefined, true)).toEqual(["ws://127.0.0.1:2567"]);
  expect(() => multiplayerEndpoints(undefined, false)).toThrow("not configured");
  for (const endpoint of [
    "ws://127.0.0.1:2567",
    "wss://localhost:2567",
    "ws://rooms.example.com",
  ]) {
    expect(() => multiplayerEndpoints(endpoint, false)).toThrow("public secure");
  }
});
it("preserves configured failover order and rejects malformed or credential-bearing URLs", () => {
  expect(multiplayerEndpoints(" wss://a.example.com , wss://b.example.com/rooms ", false)).toEqual([
    "wss://a.example.com",
    "wss://b.example.com/rooms",
  ]);
  for (const endpoint of [
    "not-a-url",
    "https://rooms.example.com",
    "wss://user:secret@rooms.example.com",
    "wss://rooms.example.com?token=secret",
  ]) {
    expect(() => multiplayerEndpoints(endpoint, false)).toThrow();
  }
});
