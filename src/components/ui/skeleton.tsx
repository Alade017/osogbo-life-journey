import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Controls the pulse speed without adding a one-off animation to each page. */
  duration?: string;
};

function Skeleton({ className, style, duration, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn("loading-ui-skeleton rounded-md bg-muted", className)}
      style={
        {
          "--skeleton-duration": duration ?? "1.8s",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Skeleton };
