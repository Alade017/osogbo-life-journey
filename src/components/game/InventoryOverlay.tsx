import { lazy, Suspense } from "react";
import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";

const InventoryPage = lazy(() =>
  import("@/components/game/GameInventoryPanel").then((module) => ({
    default: module.GameInventoryPanel,
  })),
);

export function InventoryOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="inventory-dialog-overlay" />
        <DialogPrimitive.Content
          className="inventory-dialog-shell"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Player inventory</DialogTitle>
          <DialogClose className="inventory-dialog-cancel" aria-label="Cancel and close inventory">
            <span>Cancel</span>
            <X size={17} aria-hidden="true" />
          </DialogClose>
          <div className="inventory-dialog-scroll">
            <Suspense
              fallback={
                <div className="inventory-dialog-loading" role="status">
                  Opening inventory…
                </div>
              }
            >
              <InventoryPage />
            </Suspense>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
