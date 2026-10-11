import { useQuery } from "@tanstack/react-query";
import { readWorldClock } from "@/lib/simulation-service";

export function useWorldClock() {
  return useQuery({
    queryKey: ["worldClock"],
    queryFn: readWorldClock,
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
  });
}
