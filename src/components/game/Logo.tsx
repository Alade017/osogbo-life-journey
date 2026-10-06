export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-flex h-9 w-12 items-center justify-center rounded-md border-[2.5px] border-edge bg-primary shadow-[0_3px_0_0_var(--edge)]">
        <span className="absolute -top-2 left-1.5 h-2 w-3.5 rounded-t-sm border-[2.5px] border-b-0 border-edge bg-primary" />
        <span className="absolute -top-2 right-1.5 h-2 w-3.5 rounded-t-sm border-[2.5px] border-b-0 border-edge bg-primary" />
        <span className="font-display text-sm font-bold text-primary-foreground">OL</span>
      </span>
      {!small && (
        <span className="font-display text-xl font-bold leading-none tracking-tight">
          OSOGBO <span className="text-clay">LIFE</span>
        </span>
      )}
    </span>
  );
}
