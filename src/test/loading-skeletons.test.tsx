import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CardListSkeleton,
  HomeSceneSkeleton,
  HouseSceneSkeleton,
  MapSceneSkeleton,
} from "@/components/game/loading-skeletons";

describe("game loading skeletons", () => {
  it("renders a stable card list placeholder", () => {
    const { container } = render(<CardListSkeleton cards={4} label="Loading jobs" />);

    expect(screen.getByRole("status", { name: "Loading jobs" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(18);
  });

  it("labels scene placeholders for assistive technology", () => {
    render(
      <>
        <HomeSceneSkeleton />
        <HouseSceneSkeleton />
        <MapSceneSkeleton />
      </>,
    );

    expect(screen.getByRole("status", { name: "Loading your home" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading your room" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading map" })).toBeInTheDocument();
  });
});
