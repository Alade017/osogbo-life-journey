import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PhoneMapApp } from "@/components/game/phone/PhoneMapApp";

vi.mock("@/lib/game", () => ({ q: { locations: () => ({}) } }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      { id: "bank", slug: "cedar-bank", name: "Cedar Bank", type: "bank" },
      { id: "custom", slug: "new-place", name: "New place", type: "custom" },
    ],
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ params, children, ...props }: { params: { slug: string }; children: ReactNode }) => (
    <a href={"/location/" + params.slug} {...props}>
      {children}
    </a>
  ),
}));
it("opens real destination details and links only mapped places to map markers without starting travel", () => {
  render(<PhoneMapApp />);
  const links = screen.getAllByRole("link", { name: /^View destination:/ });
  expect(links[0]).toHaveAttribute("href", "/location/cedar-bank");
  expect(links[1]).toHaveAttribute("href", "/location/new-place");
  expect(screen.getAllByRole("link", { name: "Locate Cedar Bank on map" })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Locate Cedar Bank on map" })).toHaveAttribute(
    "href",
    "/map?landmark=cedar-bank&details=1",
  );
});
