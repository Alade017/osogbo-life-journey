import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ComposerMedia, PlayerSocialCard } from "@/components/game/ChatMedia";
import { ChatComposer } from "@/components/game/PlayerSocial";
const media = vi.hoisted(() => ({ upload: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/social-media", async (original) => ({
  ...(await original<typeof import("@/lib/social-media")>()),
  uploadSocialMedia: media.upload,
  socialMediaRequest: media.request,
}));
vi.mock("@/components/game/Avatar", () => ({ Avatar: () => <span>Character portrait</span> }));
beforeEach(() => {
  vi.clearAllMocks();
  media.upload.mockResolvedValue({ ok: true });
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL = vi.fn(() => "blob:preview");
      static override revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const file = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.png", { type: "image/png" });
it("puts recording and active attachment controls in the text composer's form", () => {
  render(
    <ChatComposer
      label="Message Ayo"
      phoneMode
      onSend={async () => {}}
      recorder={<button type="button">Record voice</button>}
      mediaControls={<ComposerMedia threadId="thread" onSent={() => {}} />}
    />,
  );
  const form = screen.getByRole("textbox").closest("form");
  expect(screen.getByRole("button", { name: "Record voice" }).closest("form")).toBe(form);
  expect(screen.getByRole("button", { name: "Attach file" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Open camera" })).toBeEnabled();
});
it("previews before upload and reuses the same request key after an ambiguous failure", async () => {
  media.upload.mockRejectedValueOnce(new Error("Delivery unconfirmed"));
  const sent = vi.fn();
  render(<ComposerMedia threadId="thread" onSent={sent} />);
  fireEvent.change(screen.getByLabelText("Choose attachment"), { target: { files: [file()] } });
  expect(await screen.findByRole("dialog", { name: "Preview attachment" })).toBeInTheDocument();
  expect(media.upload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Send attachment" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry attachment" }));
  await waitFor(() => expect(sent).toHaveBeenCalledOnce());
  expect(media.upload.mock.calls[0]![1]).toBe(media.upload.mock.calls[1]![1]);
});
it("stops a late camera permission response after the dialog is dismissed", async () => {
  let resolve!: (stream: MediaStream) => void;
  const stop = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(
        () =>
          new Promise<MediaStream>((done) => {
            resolve = done;
          }),
      ),
    },
  });
  render(<ComposerMedia threadId="thread" onSent={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await waitFor(() => expect(stop).toHaveBeenCalledOnce());
});
it("rejects unsupported files before any upload", async () => {
  render(<ComposerMedia threadId="thread" onSent={() => {}} />);
  fireEvent.change(screen.getByLabelText("Choose attachment"), {
    target: { files: [new File(["bad"], "bad.html", { type: "text/html" })] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("JPEG");
  expect(media.upload).not.toHaveBeenCalled();
});
it("ignores duplicate camera starts while permission is pending", () => {
  const getUserMedia = vi.fn(() => new Promise<MediaStream>(() => {}));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  render(<ComposerMedia threadId="thread" onSent={() => {}} />);
  const trigger = screen.getByRole("button", { name: "Open camera" });
  fireEvent.click(trigger);
  fireEvent.click(trigger);
  expect(getUserMedia).toHaveBeenCalledOnce();
});
it("rejects the old camera stream after cancelling and reopening", async () => {
  const resolves: Array<(stream: MediaStream) => void> = [];
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(
        () =>
          new Promise<MediaStream>((resolve) => {
            resolves.push(resolve);
          }),
      ),
    },
  });
  render(<ComposerMedia threadId="thread" onSent={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
  await screen.findByRole("button", { name: "Cancel" });
  const oldStop = vi.fn(),
    newStop = vi.fn();
  const latest = { getTracks: () => [{ stop: newStop }] } as unknown as MediaStream;
  resolves[0]!({ getTracks: () => [{ stop: oldStop }] } as unknown as MediaStream);
  await waitFor(() => expect(oldStop).toHaveBeenCalledOnce());
  resolves[1]!(latest);
  await waitFor(() => expect(document.querySelector("video")?.srcObject).toBe(latest));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(newStop).toHaveBeenCalledOnce();
  await waitFor(() => expect(document.querySelector("video")).toBeNull());
});
it("shows a friend cover/status and hides owner-only controls", async () => {
  media.request.mockResolvedValue({
    characterId: "friend",
    name: "Ayo",
    gender: "female",
    appearance: {},
    level: 4,
    isOwn: false,
    isFriend: true,
    coverUrl: "https://example.test/cover",
    status: { body: "At the market", theme: "leaf", expiresAt: "2026-11-02T00:00:00Z" },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlayerSocialCard characterId="friend" ownerId="me" onClose={() => {}} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("At the market")).toBeInTheDocument();
  expect(screen.getByAltText("Ayo's shared background")).toBeInTheDocument();
  expect(screen.queryByText("Change background image")).not.toBeInTheDocument();
  client.clear();
});
