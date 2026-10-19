import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { q } from "@/lib/game";
import {
  getHousingReliefState,
  housingReliefFetch,
  housingReliefQueryKey,
} from "@/lib/housing-relief-client";
import "./housing-relief.css";

export function HousingRepossessionNotice({ characterId }: { characterId: string }) {
  const queryClient = useQueryClient();
  const state = useQuery({
    queryKey: housingReliefQueryKey(characterId),
    queryFn: getHousingReliefState,
    enabled: typeof window !== "undefined",
    retry: false,
    refetchOnWindowFocus: true,
  });
  const notice = state.data?.notice;
  const acknowledge = useMutation({
    mutationFn: async (cycleId: string) =>
      housingReliefFetch("/api/housing/ack-repossession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: housingReliefQueryKey(characterId) }),
        queryClient.invalidateQueries({ queryKey: ["canonicalHousingHome"] }),
        queryClient.invalidateQueries({ queryKey: ["authoritativeHouseState"] }),
        queryClient.invalidateQueries({ queryKey: ["housingMapProperties"] }),
        queryClient.invalidateQueries({ queryKey: q.character().queryKey }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message.replaceAll("_", " ")),
  });
  if (!notice) return null;

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="housing-repossession-backdrop" />
        <Dialog.Content
          className="housing-repossession-sheet"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="house-sheet-handle" />
          <p className="house-eyebrow">Housing update</p>
          <Dialog.Title>Your tenancy has ended</Dialog.Title>
          <Dialog.Description>
            The rent rescue period for {notice.houseName} ended without payment or a completed
            resolution. The server revoked access to the home and moved your character to the city
            centre streets. Your owned items remain in your inventory.
          </Dialog.Description>
          <div className="housing-relief-actions">
            <button
              type="button"
              className="house-pay-button"
              disabled={acknowledge.isPending}
              onClick={() => acknowledge.mutate(notice.cycleId)}
            >
              {acknowledge.isPending ? "Saving…" : "Continue"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
