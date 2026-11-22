import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

import {
  fetchAccountMessageTheme,
  isMessageTheme,
  readLocalMessageTheme,
  saveAccountMessageTheme,
} from "@/lib/message-theme";

function selectMaybeSingle(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  supabase.from.mockReturnValue({ select });
  return { select, eq };
}

describe("account message theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("accepts only the four known themes", () => {
    expect(isMessageTheme("leaf")).toBe(true);
    expect(isMessageTheme("sunset")).toBe(false);
    expect(isMessageTheme(null)).toBe(false);
  });

  it("reads the theme saved on the account and caches it on this device", async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    selectMaybeSingle({ data: { message_theme: "ink" }, error: null });
    expect(await fetchAccountMessageTheme()).toBe("ink");
    expect(localStorage.getItem("osogbo-message-theme")).toBe("ink");
  });

  it("falls back to this device when the account read fails", async () => {
    localStorage.setItem("osogbo-message-theme", "warm");
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    selectMaybeSingle({ data: null, error: { message: "column missing" } });
    expect(await fetchAccountMessageTheme()).toBe("warm");
  });

  it("defaults to porcelain for a signed-out visitor", async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await fetchAccountMessageTheme()).toBe("porcelain");
    expect(readLocalMessageTheme()).toBe("porcelain");
  });

  it("saves the choice through the account RPC", async () => {
    supabase.rpc.mockResolvedValue({ data: "leaf", error: null });
    await saveAccountMessageTheme("leaf");
    expect(supabase.rpc).toHaveBeenCalledWith("set_my_message_theme", { p_theme: "leaf" });
  });

  it("surfaces a save failure so the player knows it did not sync", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "Unknown message theme" } });
    await expect(saveAccountMessageTheme("warm")).rejects.toThrow("Unknown message theme");
  });
});
