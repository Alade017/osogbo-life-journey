import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CityServicesApp } from "@/components/game/phone/CityServicesApp";

vi.mock("@/lib/game", () => ({
  q: { locations: () => ({ queryKey: ["locations"] }) },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      {
        id: "clinic",
        slug: "osun-clinic",
        name: "Osun Community Clinic",
        type: "healthcare",
        tagline: "Community health services",
      },
      { id: "bank", slug: "cedar-bank", name: "Cedar Bank", type: "bank" },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    params,
    children,
    ...props
  }: {
    params: { slug: string };
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={"/location/" + params.slug} {...props}>
      {children}
    </a>
  ),
}));

it("lists live town locations and opens their real destination pages", () => {
  render(<CityServicesApp />);
  expect(screen.getByText("Osun Community Clinic")).toBeVisible();
  expect(screen.getByText("Cedar Bank")).toBeVisible();
  expect(screen.getByRole("link", { name: "View destination" })).toHaveAttribute(
    "href",
    "/location/osun-clinic",
  );
});

it("filters the directory by location type and search", () => {
  render(<CityServicesApp />);
  fireEvent.click(screen.getByRole("button", { name: "Bank" }));
  expect(screen.getByText("Cedar Bank")).toBeVisible();
  expect(screen.queryByText("Osun Community Clinic")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search city services" }), {
    target: { value: "clinic" },
  });
  expect(screen.getByText("Osun Community Clinic")).toBeVisible();
  expect(screen.queryByText("Cedar Bank")).toBeNull();
});
