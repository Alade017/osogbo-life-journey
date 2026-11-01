import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  handlePhoneLinkClick,
  phoneAppForPath,
  reducePhoneNavigation,
  type PhoneNavigationState,
} from "@/components/game/phone-navigation";

describe("phone navigation controller", () => {
  it("maps in-phone routes to apps and keeps the selected app as its title", () => {
    expect(phoneAppForPath("/home")).toBe("Home");
    expect(phoneAppForPath("/house")).toBe("Home");
    expect(phoneAppForPath("/jobs")).toBe("Jobs");
    expect(phoneAppForPath("/location/market-square")).toBe("Map");
    expect(phoneAppForPath("/not-an-app")).toBeUndefined();

    const state = reducePhoneNavigation({ app: null, history: [] }, { type: "open", app: "Jobs" });
    expect(state.app).toBe("Jobs");
  });

  it("backs through in-phone app history before returning home", () => {
    let state: PhoneNavigationState = { app: null, history: [] };
    state = reducePhoneNavigation(state, { type: "open", app: "Messages" });
    state = reducePhoneNavigation(state, { type: "open", app: "Jobs" });
    expect(state).toEqual({ app: "Jobs", history: [{ app: "Messages" }] });
    state = reducePhoneNavigation(state, { type: "back" });
    expect(state).toEqual({ app: "Messages", history: [] });
    expect(reducePhoneNavigation(state, { type: "home" })).toEqual({ app: null, history: [] });
  });

  it("preserves route search details such as a friend-visit destination", () => {
    let state: PhoneNavigationState = { app: null, history: [] };
    state = reducePhoneNavigation(state, {
      type: "open",
      app: "Home",
      search: "?visit=friend-1",
    });
    expect(state).toEqual({ app: "Home", search: "?visit=friend-1", history: [] });
  });

  it("keeps clicked internal links inside the dialog and opens the registered app", () => {
    const openApp = vi.fn();
    render(
      <div
        onClickCapture={(event) => handlePhoneLinkClick(event, openApp)}
        aria-label="Phone app content"
      >
        <a href="/jobs">Jobs</a>
        <span>Current phone app remains mounted unless a phone route is selected.</span>
      </div>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Jobs" }));
    expect(openApp).toHaveBeenCalledWith("Jobs", undefined);
    expect(window.location.pathname).toBe("/");
    expect(
      screen.getByText("Current phone app remains mounted unless a phone route is selected."),
    ).toBeInTheDocument();
  });

  it("preserves query parameters when routing a link inside the phone", () => {
    const openApp = vi.fn();
    render(
      <div onClickCapture={(event) => handlePhoneLinkClick(event, openApp)}>
        <a href="/home?visit=friend-1">Visit saved home</a>
      </div>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Visit saved home" }));

    expect(openApp).toHaveBeenCalledWith("Home", "?visit=friend-1");
    expect(window.location.pathname).toBe("/");
  });

  it("routes unknown same-origin links to an in-phone fallback instead of leaving the dialog", () => {
    const openApp = vi.fn();
    render(
      <div onClickCapture={(event) => handlePhoneLinkClick(event, openApp)}>
        <a href="/unmapped">Unmapped</a>
      </div>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Unmapped" }));
    expect(openApp).toHaveBeenCalledWith("Unmapped", undefined);
    expect(window.location.pathname).toBe("/");
    expect(screen.getByRole("link", { name: "Unmapped" })).toBeInTheDocument();
  });
});
