import type { MouseEvent, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    onClick,
    ...props
  }: {
    to: string;
    children: ReactNode;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    [key: string]: unknown;
  }) => {
    const { activeProps: _activeProps, search: _search, ...anchorProps } = props;
    return (
      <a
        href={to}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        {...anchorProps}
      >
        {children}
      </a>
    );
  },
}));

import { GameMobileNav } from "@/components/game/GameMobileNav";

it.each([
  ["Home", "/home"],
  ["City", "/map"],
  ["Jobs", "/jobs"],
])("%s keeps its full-page route and closes the phone", (label, route) => {
  const closePhone = vi.fn();
  render(<GameMobileNav hidden={false} onNavigate={closePhone} />);
  const link = screen.getByRole("link", { name: label });
  expect(link).toHaveAttribute("href", route);

  fireEvent.click(link);

  expect(closePhone).toHaveBeenCalledOnce();
});
