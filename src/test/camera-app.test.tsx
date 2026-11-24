import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CameraApp } from "@/components/game/phone/CameraApp";

it("switches between rear and front camera previews", () => {
  render(<CameraApp />);
  expect(screen.getByRole("img", { name: "Illustrative rear camera preview" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Switch to front camera" }));
  expect(screen.getByRole("img", { name: "Illustrative front camera preview" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Switch to rear camera" })).toBeVisible();
});

it("switches to screenshot mode and records an illustrative capture state", () => {
  render(<CameraApp />);
  fireEvent.click(screen.getByRole("button", { name: "Screenshot" }));
  expect(screen.getByRole("img", { name: "Illustrative screen capture preview" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Capture screenshot preview" }));
  expect(screen.getByRole("status")).toHaveTextContent("Screen capture preview captured");
  expect(screen.getByLabelText("1 captures")).toBeVisible();
});

it("captures a selfie preview and resets the local capture counter", () => {
  render(<CameraApp />);
  fireEvent.click(screen.getByRole("button", { name: "Switch to front camera" }));
  fireEvent.click(screen.getByRole("button", { name: "Capture photo preview" }));
  expect(screen.getByRole("status")).toHaveTextContent("Selfie preview captured");
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.getByLabelText("0 captures")).toBeVisible();
  expect(screen.queryByRole("status")).toBeNull();
});
