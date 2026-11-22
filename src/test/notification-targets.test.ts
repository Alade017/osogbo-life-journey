import { describe, expect, it, vi } from "vitest";
import { notificationAppFor, openPhoneAppFromNotification } from "@/lib/notification-targets";

describe("notification targets", () => {
  it("sends friend requests to the People app", () => {
    expect(notificationAppFor("friend_request")).toBe("People");
  });

  it("opens each known kind on its own page", () => {
    expect(notificationAppFor("mission")).toBe("Missions");
    expect(notificationAppFor("job")).toBe("Career Life");
    expect(notificationAppFor("career")).toBe("Career Life");
    expect(notificationAppFor("explore")).toBe("Map");
    expect(notificationAppFor("welcome")).toBe("Find homes");
    expect(notificationAppFor("level")).toBe("Profile");
  });

  it("keeps info-only and unknown kinds on the notifications page", () => {
    expect(notificationAppFor("info")).toBeNull();
    expect(notificationAppFor("something_new")).toBeNull();
  });

  it("asks the phone shell to open the requested app", () => {
    const listener = vi.fn();
    window.addEventListener("osogbo-open-phone-app", listener);
    openPhoneAppFromNotification("People");
    window.removeEventListener("osogbo-open-phone-app", listener);
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent | undefined;
    expect(event?.detail).toEqual({ app: "People" });
  });
});
