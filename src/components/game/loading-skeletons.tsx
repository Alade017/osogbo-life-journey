import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CardListSkeletonProps = {
  cards?: number;
  className?: string;
  label?: string;
};

/** Keeps list pages stable while their server-backed cards arrive. */
export function CardListSkeleton({
  cards = 3,
  className,
  label = "Loading content",
}: CardListSkeletonProps) {
  return (
    <section className={cn("game-loading-list", className)} role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-4 w-2/3 max-w-sm" duration="2.1s" />
      <div className="grid gap-3">
        {Array.from({ length: cards }, (_, index) => (
          <div className="game-loading-card" key={index}>
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" duration="1.6s" />
              <Skeleton className="h-3 w-4/5" duration="2.2s" />
            </div>
            <Skeleton className="h-9 w-20 rounded-full" duration="1.9s" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** A compact approximation of Home's header, shortcuts, and room scene. */
export function HomeSceneSkeleton() {
  return (
    <section className="home-loading-skeleton" role="status" aria-label="Loading your home">
      <span className="sr-only">Loading your home</span>
      <div className="home-loading-summary">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-36" duration="2.1s" />
        </div>
        <Skeleton className="ml-auto h-9 w-24 rounded-full" duration="1.7s" />
      </div>
      <div className="home-loading-shortcuts" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="h-11 flex-1" key={index} duration={`${1.5 + index * 0.12}s`} />
        ))}
      </div>
      <div className="home-loading-scene" aria-hidden="true">
        <Skeleton className="h-full w-full rounded-[calc(var(--shape-card)-2px)]" duration="2.3s" />
        <Skeleton className="absolute bottom-[14%] left-[18%] h-16 w-24" duration="1.7s" />
        <Skeleton className="absolute bottom-[22%] right-[18%] h-24 w-16" duration="2s" />
      </div>
    </section>
  );
}

/** Matches the eventual room bounds so loading the house does not cause a layout shift. */
export function HouseSceneSkeleton() {
  return (
    <section className="house-loading-skeleton" role="status" aria-label="Loading your room">
      <span className="sr-only">Loading your room</span>
      <div className="house-loading-toolbar" aria-hidden="true">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <div className="house-loading-room" aria-hidden="true">
        <Skeleton className="h-full w-full rounded-[calc(var(--shape-card)-2px)]" duration="2.3s" />
        <Skeleton className="absolute bottom-[18%] left-[15%] h-16 w-28" duration="1.6s" />
        <Skeleton className="absolute bottom-[14%] right-[17%] h-28 w-20" duration="2.1s" />
      </div>
    </section>
  );
}

/** Used only while MapLibre initializes; the interactive map remains the source of truth. */
export function MapSceneSkeleton() {
  return (
    <div className="map-loading-skeleton" role="status" aria-label="Loading map">
      <span className="sr-only">Loading map</span>
      <Skeleton className="absolute inset-0 rounded-none" duration="2.2s" />
      <Skeleton className="absolute left-[12%] top-[20%] h-2 w-2/3 rounded-full" duration="1.6s" />
      <Skeleton className="absolute right-[16%] top-[42%] h-2 w-1/2 rotate-[24deg] rounded-full" />
      <Skeleton
        className="absolute bottom-[20%] left-[22%] h-2 w-3/5 -rotate-[18deg] rounded-full"
        duration="2s"
      />
      <div className="map-loading-skeleton-label">Loading map</div>
    </div>
  );
}
