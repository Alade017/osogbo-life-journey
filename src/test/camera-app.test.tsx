import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CameraApp } from "@/components/game/phone/CameraApp";
import { deletePhoto, listPhotos } from "@/lib/camera-gallery";
import { registerScreenCapture } from "@/lib/camera-screen-capture";

afterEach(async () => {
  for (const photo of await listPhotos()) await deletePhoto(photo.id);
});

it("says the camera is unavailable when the device exposes no camera", async () => {
  render(<CameraApp />);
  expect(await screen.findByText("Camera not available")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
  expect(await screen.findByRole("status")).toHaveTextContent("The camera is not available");
});

it("switches to front camera and back to rear", () => {
  render(<CameraApp />);
  fireEvent.click(screen.getByRole("button", { name: "Switch to front camera" }));
  expect(screen.getByRole("button", { name: "Switch to rear camera" })).toBeVisible();
});

it("reports when the current screen has no 3D view to capture", async () => {
  render(<CameraApp />);
  fireEvent.click(screen.getByRole("button", { name: "Screenshot" }));
  fireEvent.click(screen.getByRole("button", { name: "Take screenshot" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "There is no 3D view on this screen to capture.",
  );
});

it("saves a screenshot to the gallery and lets the player delete it", async () => {
  const unregister = registerScreenCapture(async () => new Blob(["png"], { type: "image/png" }));
  try {
    render(<CameraApp />);
    fireEvent.click(screen.getByRole("button", { name: "Screenshot" }));
    fireEvent.click(screen.getByRole("button", { name: "Take screenshot" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Screenshot saved to your gallery");
    await waitFor(() => expect(screen.getByLabelText("1 captures")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Open gallery" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete screenshot from gallery" }));
    await waitFor(() => expect(screen.getByLabelText("0 captures")).toBeVisible());
  } finally {
    unregister();
  }
});
