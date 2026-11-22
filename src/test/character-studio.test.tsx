import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CreateCharacter } from "@/routes/_authenticated/create-character";
const api = vi.hoisted(() => ({
  create: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
  jobs: vi.fn(),
  existing: false,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => api.navigate,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: api.create } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: api.error } }));
vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({
      queryKey: ["character"],
      queryFn: async () => (api.existing ? { id: "existing" } : null),
    }),
    jobs: () => ({ queryKey: ["jobs"], queryFn: api.jobs }),
  },
}));
vi.mock("@/components/3d/CharacterPreview", () => ({
  CharacterPreview: ({
    appearance,
    gender,
    animation,
    rotation,
  }: {
    appearance: Record<string, unknown>;
    gender: string;
    animation: string;
    rotation: number;
  }) => (
    <div
      data-testid="preview"
      data-appearance={JSON.stringify(appearance)}
      data-gender={gender}
      data-animation={animation}
      data-rotation={rotation}
    />
  ),
}));
vi.mock("@/components/ui/palette-select", () => ({
  PaletteSelect: ({
    id,
    value,
    onValueChange,
    options,
    disabled,
  }: {
    id: string;
    value: string;
    onValueChange: (s: string) => void;
    options: Array<{ value: string; label: string }>;
    disabled: boolean;
  }) => (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <CreateCharacter />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  api.existing = false;
  api.jobs.mockResolvedValue([{ slug: "developer", name: "Developer" }]);
  api.create.mockResolvedValue({ error: null });
  api.navigate.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
});
async function story() {
  fireEvent.click(await screen.findByRole("button", { name: "Next: your story" }));
}
it("updates the actual preview contract for body, palettes, presentation and animation", async () => {
  setup();
  await screen.findByText("Find your look");
  fireEvent.click(screen.getByRole("button", { name: "Male" }));
  fireEvent.click(screen.getByRole("button", { name: "Skin tone, option 5" }));
  fireEvent.click(screen.getByRole("button", { name: "Athletic" }));
  fireEvent.click(screen.getByRole("button", { name: "Dance" }));
  fireEvent.click(screen.getByRole("button", { name: "Rotate character right" }));
  const preview = screen.getByTestId("preview");
  expect(JSON.parse(preview.getAttribute("data-appearance")!)).toMatchObject({
    skin: 4,
    build: 2,
    clothed: true,
  });
  expect(preview).toHaveAttribute("data-gender", "male");
  expect(preview).toHaveAttribute("data-animation", "dance");
  expect(Number(preview.getAttribute("data-rotation"))).toBeCloseTo(Math.PI / 4);
});
it("requires a valid name and integer age before review", async () => {
  setup();
  await story();
  const review = screen.getByRole("button", { name: "Review character" });
  expect(review).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Character name"), { target: { value: "Ade" } });
  fireEvent.change(screen.getByLabelText("Age"), { target: { value: "22.5" } });
  expect(review).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Age"), { target: { value: "22" } });
  expect(review).toBeEnabled();
  expect(api.create).not.toHaveBeenCalled();
});
it("preserves choices across steps and submits only after explicit review confirmation", async () => {
  setup();
  await story();
  fireEvent.change(screen.getByLabelText("Character name"), { target: { value: "  Adunni  " } });
  fireEvent.change(screen.getByLabelText("Age"), { target: { value: "24" } });
  fireEvent.click(screen.getByRole("button", { name: /Creative/ }));
  fireEvent.change(screen.getByLabelText(/A career to work towards/), {
    target: { value: "developer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review character" }));
  await screen.findByText("This is your beginning");
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByLabelText("Character name")).toHaveValue("  Adunni  ");
  fireEvent.click(screen.getByRole("button", { name: "Review character" }));
  fireEvent.click(screen.getByRole("button", { name: "Begin your Osogbo life" }));
  await waitFor(() =>
    expect(api.create).toHaveBeenCalledWith(
      "create_character",
      expect.objectContaining({
        p_name: "Adunni",
        p_gender: "female",
        p_age: 24,
        p_personality: "creative",
        p_occupation: "developer",
        p_appearance: expect.objectContaining({ clothed: true }),
      }),
    ),
  );
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({ to: "/enter" }));
});
it("blocks duplicate creation clicks while a request is in flight", async () => {
  api.create.mockImplementation(() => new Promise(() => {}));
  setup();
  await story();
  fireEvent.change(screen.getByLabelText("Character name"), { target: { value: "Ade" } });
  fireEvent.click(screen.getByRole("button", { name: "Review character" }));
  const button = screen.getByRole("button", { name: "Begin your Osogbo life" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Creating your character…" })).toBeDisabled();
});
it("keeps the reviewed character available after a server failure", async () => {
  api.create.mockRejectedValueOnce(new Error("Temporary failure"));
  setup();
  await story();
  fireEvent.change(screen.getByLabelText("Character name"), { target: { value: "Ade" } });
  fireEvent.click(screen.getByRole("button", { name: "Review character" }));
  fireEvent.click(screen.getByRole("button", { name: "Begin your Osogbo life" }));
  await waitFor(() => expect(api.error).toHaveBeenCalledWith("Temporary failure"));
  expect(await screen.findByRole("button", { name: "Begin your Osogbo life" })).toBeEnabled();
  expect(api.navigate).not.toHaveBeenCalled();
});
it("shows a recoverable careers error without discarding appearance edits", async () => {
  api.jobs.mockRejectedValueOnce(new Error("offline"));
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Male" }));
  await screen.findByRole("button", { name: "Retry careers" });
  api.jobs.mockResolvedValue([{ slug: "developer", name: "Developer" }]);
  fireEvent.click(screen.getByRole("button", { name: "Retry careers" }));
  await story();
  fireEvent.change(screen.getByLabelText("Character name"), { target: { value: "Ade" } });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Review character" })).toBeEnabled(),
  );
  expect(screen.getByTestId("preview")).toHaveAttribute("data-gender", "male");
});
it("redirects existing characters instead of allowing duplicate creation", async () => {
  api.existing = true;
  setup();
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({ to: "/enter" }));
  expect(screen.queryByRole("button", { name: "Begin your Osogbo life" })).not.toBeInTheDocument();
});
