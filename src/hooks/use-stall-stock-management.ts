import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { q } from "@/lib/game";
import {
  manageMyStallStock,
  stallStockRequestSchema,
  type StallStockOperation,
  type StallStockRequest,
} from "@/lib/market-stall-service";

const rejections = new Set([
  "REGISTERED_ACCOUNT_REQUIRED",
  "CHARACTER_REQUIRED",
  "INVALID_STOCK_ACTION",
  "INVALID_STOCK_QUANTITY",
  "RENT_A_CURRENT_STALL",
  "ITEM_NOT_SELLABLE",
  "PRICE_OUT_OF_RANGE",
  "NOT_ENOUGH_INVENTORY",
  "STALL_STOCK_LIMIT",
  "STALL_LISTING_LIMIT",
  "STALL_ITEM_NOT_FOUND",
  "INVENTORY_STACK_FULL",
]);
/** One durable stock operation at a time. Mount with a key for the character. */
export function useStallStockManagement(characterId: string) {
  const client = useQueryClient();
  const key = `osun:stall-stock:${characterId}`;
  const read = (): { pending: StallStockRequest | null; storageError: boolean } => {
    try {
      const raw = localStorage.getItem(key);
      return {
        pending: raw ? stallStockRequestSchema.parse(JSON.parse(raw)) : null,
        storageError: false,
      };
    } catch {
      return { pending: null, storageError: true };
    }
  };
  const [saved, setSaved] = useState(read);
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: manageMyStallStock,
    retry: false,
    networkMode: "always",
    onSuccess: async () => {
      // Keep the receipt until both authoritative views have refreshed.
      await Promise.all([
        client.invalidateQueries(
          { queryKey: ["myStallStock", characterId] },
          { throwOnError: true },
        ),
        client.invalidateQueries({ queryKey: q.inventory().queryKey }, { throwOnError: true }),
        client.invalidateQueries({ queryKey: ["publicStallStock"] }, { throwOnError: true }),
      ]);
      localStorage.removeItem(key);
      setSaved({ pending: null, storageError: false });
      toast.success("Stall stock updated.");
    },
    onError: (error: Error) => {
      if (rejections.has(error.message)) {
        try {
          localStorage.removeItem(key);
          setSaved({ pending: null, storageError: false });
        } catch {
          /* Keep the receipt until storage recovers. */
        }
        void client.invalidateQueries({ queryKey: ["myStallStock", characterId] });
        void client.invalidateQueries({ queryKey: q.inventory().queryKey });
        toast.error(error.message.replaceAll("_", " "));
      } else {
        toast.error(
          "Stock update could not be confirmed. Retry the saved request before making another change.",
        );
      }
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  function submit(operation?: StallStockOperation) {
    if (lock.current || saved.storageError || (saved.pending && operation)) return;
    const request =
      saved.pending ?? (operation ? { ...operation, requestId: crypto.randomUUID() } : null);
    if (!request) return;
    lock.current = true;
    try {
      const valid = stallStockRequestSchema.parse(request);
      localStorage.setItem(key, JSON.stringify(valid));
      setSaved({ pending: valid, storageError: false });
      mutation.mutate(valid);
    } catch {
      lock.current = false;
      toast.error(
        "The stock request could not be saved or is invalid. No stock update was submitted.",
      );
    }
  }
  return {
    submit,
    pending: saved.pending,
    storageError: saved.storageError,
    reloadSaved: () => setSaved(read()),
    busy: mutation.isPending,
    blocked: mutation.isPending || !!saved.pending || saved.storageError,
  };
}
