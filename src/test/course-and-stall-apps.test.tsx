import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CourseAndStallApps } from "@/components/game/CourseAndStallApps";

it("shows extra local courses without changing completed game courses", () => {
  render(<CourseAndStallApps app="Courses" />);
  expect(screen.getByText("Solar installation")).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "View" })[0]!);
  expect(screen.getByRole("button", { name: "Selected" })).toBeInTheDocument();
  expect(screen.getByText(/Game progress is unchanged/)).toBeInTheDocument();
});

it("builds a local player stall beside NPC stalls", () => {
  render(<CourseAndStallApps app="Market Stalls" />);
  expect(screen.getByText("Aunty Bisi Fabrics")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Stall name"), { target: { value: "Tayo Treats" } });
  fireEvent.click(screen.getByRole("button", { name: "Open preview stall" }));
  expect(screen.getByText("Tayo Treats")).toBeInTheDocument();
  expect(screen.getByText("Open for preview")).toBeInTheDocument();
  expect(screen.getByText(/does not create ownership/)).toBeInTheDocument();
});
