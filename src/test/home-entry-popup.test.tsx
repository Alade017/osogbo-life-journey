import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { OutsideTransition } from "@/components/game/OutsideTransition";
import { beginTransition, completeTransitionStep, endTransition } from "@/lib/outside-transition";

afterEach(() => act(() => endTransition()));

it("announces entry without covering the doorway, and retains departure progress", () => {
  const { container } = render(<OutsideTransition />);
  act(() => beginTransition("entering", "Heading to your door", 3));
  act(() => completeTransitionStep("Opening the door"));
  expect(screen.getByRole("status")).toHaveTextContent("Opening the door");
  expect(container.querySelector(".outside-transition")).toBeNull();
  act(() => beginTransition("leaving", "Loading the neighbourhood", 3));
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});
