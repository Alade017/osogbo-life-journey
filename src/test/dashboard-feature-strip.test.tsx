import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardFeatureStrip } from "@/components/game/DashboardFeatureStrip";

const mocks = vi.hoisted(() => ({
  notifications: [{ kind: "job_waiting", read_at: null }],
  mutate: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "notifications" ? mocks.notifications : undefined,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/game", () => ({
  q: {
    profile: () => ({ queryKey: ["profile"] }),
    notifications: () => ({ queryKey: ["notifications"] }),
  },
  rpc: { saveDashboardPins: vi.fn() },
  useGameAction: () => ({ mutate: mocks.mutate, isPending: false }),
}));

vi.mock("@/components/game/PhoneLauncher", () => ({
  PhoneLauncher: ({ trigger }: { trigger: ReactElement }) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        {isValidElement(trigger) &&
          cloneElement(trigger as ReactElement<{ onClick?: () => void }>, {
            onClick: () => setOpen(true),
          })}
        {open && <div>Phone launcher open</div>}
      </>
    );
  },
}));

describe("DashboardFeatureStrip", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 390,
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  it("renders default pins and notification badges", () => {
    render(<DashboardFeatureStrip />);
    for (const label of ["Jobs", "Bank", "Map", "Social", "Missions"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Jobs, 1 needing attention" })).toBeInTheDocument();
  });

  it("opens the phone launcher from More", () => {
    render(<DashboardFeatureStrip />);
    fireEvent.click(screen.getByRole("button", { name: "More apps" }));
    expect(screen.getByText("Phone launcher open")).toBeInTheDocument();
  });
});
