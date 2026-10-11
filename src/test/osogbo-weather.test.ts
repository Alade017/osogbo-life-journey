import { afterEach, describe, expect, it, vi } from "vitest";
import { osogboHour, readOsogboWeather, weatherDescription } from "@/lib/osogbo-weather";

afterEach(() => vi.unstubAllGlobals());

describe("Osogbo current weather feed", () => {
  it("uses Osogbo's civil hour across UTC midnight", () => {
    expect(osogboHour(new Date("2026-10-11T23:30:00Z"))).toBe(0);
    expect(osogboHour(new Date("2026-10-11T05:30:00Z"))).toBe(6);
  });
  it("requests Osogbo coordinates and parses the UTC update time independently of the browser timezone", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: { temperature_2m: 24.6, weather_code: 80, is_day: 0, time: "2026-10-11T17:45" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const weather = await readOsogboWeather();
    const url = new URL(fetchMock.mock.calls[0]![0]);
    expect(url.searchParams.get("latitude")).toBe("7.7827");
    expect(url.searchParams.get("longitude")).toBe("4.5418");
    expect(weather.updatedAt).toBe(Date.parse("2026-10-11T17:45:00Z"));
    expect(weather.isDay).toBe(false);
    expect(weatherDescription(weather.code)).toBe("Rain showers");
  });

  it("rejects malformed conditions instead of displaying made-up weather", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          current: { temperature_2m: null, weather_code: 0, is_day: 1, time: "2026-10-11T17:45" },
        }),
      }),
    );
    await expect(readOsogboWeather()).rejects.toThrow("Invalid Osogbo weather response");
  });

  it("rejects service failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(readOsogboWeather()).rejects.toThrow("Osogbo weather service unavailable");
  });

  it("passes cancellation to the fetch request", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url, options) => {
        expect(options.signal.aborted).toBe(true);
        return Promise.reject(new DOMException("Aborted", "AbortError"));
      }),
    );
    await expect(readOsogboWeather(controller.signal)).rejects.toHaveProperty("name", "AbortError");
  });
});
