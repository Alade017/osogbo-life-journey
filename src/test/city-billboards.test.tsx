import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CityBillboards } from "@/components/game/CityBillboards";
import type { Advertisement, GameBillboard } from "@/lib/game";

const billboard: GameBillboard = {
  id: "board-oke-fia",
  slug: "oke-fia-junction-001",
  name: "Oke-Fia Junction Board",
  location_id: "loc-oke-fia",
  placement: "Roadside board facing the Oke-Fia city route",
  size_type: "large",
  billboard_type: "roadside",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function campaign(overrides: Partial<Advertisement> = {}): Advertisement {
  return {
    id: "ad-aladtech",
    slug: "aladtech-digital-presence",
    billboard_id: billboard.id,
    advertiser_name: "Aladtech",
    title: "Build your digital presence.",
    description: "Web Development • Website Design • Graphic Design",
    creative_image_url: null,
    creative_theme: "green",
    call_to_action: "Learn More",
    destination_action: "none",
    destination_url: null,
    starts_at: "2026-01-01T00:00:00.000Z",
    ends_at: "2099-12-31T23:59:59.000Z",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderBillboards(advertisements: Advertisement[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["billboards"], [billboard]);
  queryClient.setQueryData(["advertisements"], advertisements);
  return render(
    <QueryClientProvider client={queryClient}>
      <CityBillboards locationId={billboard.location_id} />
    </QueryClientProvider>,
  );
}

describe("CityBillboards", () => {
  it("hides expired campaigns and opens current campaign details", async () => {
    renderBillboards([
      campaign(),
      campaign({
        id: "ad-expired",
        slug: "expired-campaign",
        advertiser_name: "Expired Campaign",
        title: "This should not display",
        description: "Past its end date",
        starts_at: "2025-01-01T00:00:00.000Z",
        ends_at: "2025-02-01T00:00:00.000Z",
      }),
    ]);

    expect(screen.getByText("ALADTECH")).toBeInTheDocument();
    expect(screen.queryByText("This should not display")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "View Aladtech ad on Oke-Fia Junction Board" }),
    );

    expect(await screen.findByRole("dialog")).toHaveTextContent("Build your digital presence.");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Web Development • Website Design • Graphic Design",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("No destination configured");
  });
});
