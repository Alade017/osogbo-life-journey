import { expect, it, vi } from "vitest";
import { soundEffects, validSoundEffects } from "../lib/sound-effects";
it("accepts the complete supplied effect record and rejects incomplete records", () => {
  expect(validSoundEffects(soundEffects)).toEqual(soundEffects);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(validSoundEffects([{ ...soundEffects[0]!, licenseUrl: "" }])).toEqual([]);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
it("does not accept music paths or duplicate sound mappings", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(validSoundEffects([{ ...soundEffects[0]!, filePath: "/audio/music/file.wav" }])).toEqual(
    [],
  );
  expect(validSoundEffects([soundEffects[0]!, { ...soundEffects[0]!, id: "other" }])).toHaveLength(
    1,
  );
  warn.mockRestore();
});
