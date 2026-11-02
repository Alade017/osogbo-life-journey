import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  handlePhoneLinkClick,
  isFullPageWorldPath,
  fullPageWorldApp,
  handleGamePageLinkClick,
  phoneAppForPath,
  reducePhoneNavigation,
  type PhoneNavigationState,
} from "@/components/game/phone-navigation";

describe("phone navigation controller", () => {
  it("opens page links in the phone while leaving bottom navigation and auth links alone", () => {
    const listener = vi.fn();
    window.addEventListener("osogbo-open-phone-app", listener);
    render(
      <div onClickCapture={handleGamePageLinkClick} onClick={(event) => event.preventDefault()}>
        <a href="/settings">Page settings</a>
        <nav aria-label="Game navigation">
          <a href="/jobs">Bottom jobs</a>
        </nav>
        <a href="/login">Log in</a>
      </div>,
    );
    try {
      fireEvent.click(screen.getByRole("link", { name: "Page settings" }));
      expect(listener).toHaveBeenCalledOnce();
      expect((listener.mock.calls[0]![0] as CustomEvent).detail).toEqual({ app: "Settings" });
      listener.mockClear();
      fireEvent.click(screen.getByRole("link", { name: "Bottom jobs" }));
      fireEvent.click(screen.getByRole("link", { name: "Log in" }));
      fireEvent.click(screen.getByRole("link", { name: "Page settings" }), { ctrlKey: true });
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("osogbo-open-phone-app", listener);
    }
  });
  it("maps in-phone routes to apps and keeps the selected app as its title", () => {
    expect(phoneAppForPath("/home")).toBeUndefined();
    expect(phoneAppForPath("/house")).toBeUndefined();
    expect(phoneAppForPath("/jobs")).toBe("Career Life");
    expect(phoneAppForPath("/location/market-square")).toBeUndefined();
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
    expect(openApp).toHaveBeenCalledWith("Career Life", undefined);
    expect(window.location.pathname).toBe("/");
    expect(
      screen.getByText("Current phone app remains mounted unless a phone route is selected."),
    ).toBeInTheDocument();
  });

  it("preserves query parameters when routing a link inside the phone", () => {
    const openApp = vi.fn();
    const openWorld = vi.fn();
    render(
      <div onClickCapture={(event) => handlePhoneLinkClick(event, openApp, openWorld)}>
        <a href="/home?visit=friend-1">Visit saved home</a>
      </div>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Visit saved home" }));

    expect(openWorld).toHaveBeenCalledWith("/home?visit=friend-1");
    expect(openApp).not.toHaveBeenCalled();
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

it("reserves all world paths and launcher aliases for full-page rendering", () => {
  for (const path of ["/home", "/house/", "/map", "/neighborhood", "/location/cedar-bank"]) {
    expect(isFullPageWorldPath(path)).toBe(true);
    expect(phoneAppForPath(path)).toBeUndefined();
  }
  expect(fullPageWorldApp("Home")).toBe("/home");
  expect(fullPageWorldApp("Map")).toBe("/map");
  expect(fullPageWorldApp("Neighborhood")).toBe("/neighborhood");
  expect(fullPageWorldApp("Messages")).toBeUndefined();
});
