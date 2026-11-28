import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GigWorkApp } from "@/components/game/phone/GigWorkApp";
import { OPEN_MESSAGES_EVENT } from "@/lib/phone-messages";

const { board, act } = vi.hoisted(() => ({
  board: {
    open: [] as Array<Record<string, unknown>>,
    mine: [] as Array<Record<string, unknown>>,
    jobs: [] as Array<Record<string, unknown>>,
  },
  act: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey?: unknown[] }) =>
    opts?.queryKey?.[0] === "character"
      ? { data: { id: "char-1" } }
      : { data: board, isPending: false, isError: false },
  useMutation: (opts: { mutationFn: (input: unknown) => unknown }) => ({
    isPending: false,
    mutate: (input: unknown) => {
      act(input);
      void opts.mutationFn(input);
    },
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/game", () => ({
  q: { character: () => ({ queryKey: ["character"] }) },
  formatNaira: (amount: number) => `₦${amount.toLocaleString("en-NG")}`,
}));
vi.mock("@/lib/gig-work-client", () => ({
  getGigBoard: vi.fn(),
  gigBoardQueryKey: () => ["gigWork"],
  submitGigAction: vi.fn(async () => ({})),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Gig Work", () => {
  beforeEach(() => {
    act.mockClear();
    board.open = [];
    board.mine = [];
    board.jobs = [];
  });

  it("shows an empty browse list with a post form", () => {
    render(<GigWorkApp />);
    expect(screen.getByText(/No open jobs right now/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Post job" })).toBeTruthy();
  });

  it("lets a player apply to someone else's open job", () => {
    board.open = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Fix fence",
        description: "Repair the back fence",
        pay: 500000,
        expiresAt: "2099-01-01T00:00:00Z",
        posterName: "Ade",
        applied: false,
      },
    ];
    render(<GigWorkApp />);
    expect(screen.getByText(/Posted by Ade/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(act).toHaveBeenCalledWith({
      action: "apply",
      gigId: "11111111-1111-4111-8111-111111111111",
      offer: null,
    });
  });

  it("lets the poster pick an applicant and confirm completion", () => {
    board.mine = [
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Paint gate",
        description: "Paint the gate blue",
        pay: 300000,
        status: "open",
        expiresAt: "2099-01-01T00:00:00Z",
        workerId: null,
        workerName: null,
        applicants: [
          { characterId: "33333333-3333-4333-8333-333333333333", name: "Bola", offer: 250000 },
        ],
      },
    ];
    render(<GigWorkApp />);
    fireEvent.click(screen.getByRole("button", { name: "My posts" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick" }));
    expect(act).toHaveBeenCalledWith({
      action: "accept",
      gigId: "22222222-2222-4222-8222-222222222222",
      applicantId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("opens a direct conversation with an applicant through the shared messages seam", () => {
    board.mine = [
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Paint gate",
        description: "Paint the gate blue",
        pay: 300000,
        status: "open",
        expiresAt: "2099-01-01T00:00:00Z",
        workerId: null,
        workerName: null,
        applicants: [
          { characterId: "33333333-3333-4333-8333-333333333333", name: "Bola", offer: null },
        ],
      },
    ];
    const seen: unknown[] = [];
    const listener = (event: Event) => seen.push((event as CustomEvent).detail);
    window.addEventListener(OPEN_MESSAGES_EVENT, listener);
    render(<GigWorkApp />);
    fireEvent.click(screen.getByRole("button", { name: "My posts" }));
    fireEvent.click(screen.getByRole("button", { name: "Message" }));
    window.removeEventListener(OPEN_MESSAGES_EVENT, listener);
    expect(seen).toEqual([{ playerId: "33333333-3333-4333-8333-333333333333" }]);
  });
});

describe("expired postings", () => {
  beforeEach(() => {
    board.open = [];
    board.mine = [];
    board.jobs = [];
  });

  it("shows a passed posting as expired with no pick or cancel actions", () => {
    board.mine = [
      {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Old gate",
        description: "Paint it",
        pay: 300000,
        status: "open",
        expiresAt: "2020-01-01T00:00:00Z",
        workerId: null,
        workerName: null,
        applicants: [
          { characterId: "55555555-5555-4555-8555-555555555555", name: "Ade", offer: null },
        ],
      },
    ];
    render(<GigWorkApp />);
    fireEvent.click(screen.getByRole("button", { name: "My posts" }));
    expect(screen.getAllByText(/expired/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Pick" })).toBeNull();
  });
});

describe("pay range", () => {
  beforeEach(() => {
    act.mockClear();
    board.open = [];
    board.mine = [];
    board.jobs = [];
  });

  it("posts a minimum and maximum pay", () => {
    render(<GigWorkApp />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Sweep yard" } });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Sweep the front yard" },
    });
    fireEvent.change(screen.getByLabelText("Minimum pay (₦)"), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("Maximum pay (₦)"), { target: { value: "8000" } });
    fireEvent.click(screen.getByRole("button", { name: "Post job" }));
    expect(act).toHaveBeenCalledWith({
      action: "post",
      title: "Sweep yard",
      description: "Sweep the front yard",
      pay: 3000,
      payMax: 8000,
    });
  });

  it("does not send an offer outside the posted range", () => {
    board.open = [
      {
        id: "66666666-6666-4666-8666-666666666666",
        title: "Fix fence",
        description: "Repair the back fence",
        pay: 3000,
        payMax: 8000,
        expiresAt: "2099-01-01T00:00:00Z",
        posterName: "Ade",
        applied: false,
      },
    ];
    render(<GigWorkApp />);
    fireEvent.change(screen.getByLabelText(/Your offer/), { target: { value: "9000" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(act).not.toHaveBeenCalledWith(expect.objectContaining({ action: "apply" }));
  });
});
