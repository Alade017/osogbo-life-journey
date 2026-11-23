import { describe, expect, it } from "vitest";
import {
  gameHudHref,
  gameWorldHref,
  hudForPhoneTarget,
  parseGameHudSearch,
  phoneTargetForHud,
} from "@/lib/game-hud-search";
import { reducePhoneNavigation } from "@/components/game/phone-navigation";

describe("URL-driven game HUD", () => {
  it.each(["phone", "jobs", "map", "inventory"])("accepts the %s panel", (hud) => {
    expect(parseGameHudSearch({ hud })).toEqual({ hud });
  });
  it.each([undefined, "work", ["jobs"], 42])(
    "ignores invalid modes without taking an action",
    (hud) => {
      expect(parseGameHudSearch({ hud, phoneApp: "House" })).toEqual({});
    },
  );
  it("preserves the underlying world, friend visit and anchor while switching panels", () => {
    const original = "/home?visit=friend-1&hud=jobs#door";
    const map = gameHudHref(original, { hud: "map" });
    expect(map).toBe("/home?visit=friend-1&hud=map#door");
    expect(gameWorldHref(map)).toBe("/home?visit=friend-1#door");
    expect(gameHudHref(map, {})).toBe(gameWorldHref(original));
  });
  it("round-trips app selection and nested phone search without changing the scene URL", () => {
    const selection = { app: "Messages", search: "?playerId=friend&filter=unread" };
    const hud = hudForPhoneTarget(selection);
    expect(phoneTargetForHud(hud)).toEqual(selection);
    const url = new URL(gameHudHref("/house?floor=1", hud), "https://game.test");
    expect(url.pathname).toBe("/house");
    expect(url.searchParams.get("floor")).toBe("1");
    expect(url.searchParams.get("phoneSearch")).toBe(selection.search);
  });
  it("uses canonical Career and Map panel modes", () => {
    expect(hudForPhoneTarget({ app: "Jobs" })).toEqual({ hud: "jobs" });
    expect(phoneTargetForHud({ hud: "jobs" })).toEqual({ app: "Career Life" });
    expect(hudForPhoneTarget({ app: "Map" })).toEqual({ hud: "map" });
  });
  it("does not turn query parameters into home entry or malformed navigation requests", () => {
    expect(
      parseGameHudSearch({ hud: "phone", phoneApp: "House", phoneSearch: "https://outside.test" }),
    ).toEqual({ hud: "phone" });
    expect(parseGameHudSearch({ hud: "phone", phoneApp: "<script>" })).toEqual({ hud: "phone" });
    expect(parseGameHudSearch({ hud: "inventory", phoneApp: "Messages" })).toEqual({
      hud: "inventory",
    });
  });
  it("does not confuse HUD updates with a friend-home scene change", () => {
    expect(gameWorldHref("/home?visit=a&hud=jobs")).toBe(gameWorldHref("/home?visit=a&hud=map"));
    expect(gameWorldHref("/home?visit=a&hud=jobs")).not.toBe(
      gameWorldHref("/home?visit=b&hud=jobs"),
    );
  });
  it("preserves app history for its own URL acknowledgement and resets stale browser history", () => {
    let state = reducePhoneNavigation(
      { app: null, history: [] },
      { type: "open", app: "Messages" },
    );
    state = reducePhoneNavigation(state, { type: "open", app: "Career Life" });
    expect(reducePhoneNavigation(state, { type: "restore", app: "Career Life" })).toBe(state);
    expect(reducePhoneNavigation(state, { type: "restore", app: "Map" })).toEqual({
      app: "Map",
      history: [],
    });
  });
});
