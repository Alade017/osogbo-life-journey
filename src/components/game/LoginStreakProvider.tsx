import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { checkInLogin, loginStreakKey, loginStreakOptions } from "@/lib/login-streak-service";
import { LoginStreakContext } from "@/hooks/login-streak-context";
const available = () => typeof document !== "undefined" && !document.hidden && navigator.onLine;
export function LoginStreakProvider({
  userId,
  characterId,
  children,
}: {
  userId: string;
  characterId: string;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [active, setActive] = useState(available),
    [epoch, setEpoch] = useState(0),
    [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false),
    refreshing = useRef(false),
    attempt = useRef("");
  const owner = useRef(userId);
  owner.current = userId;
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    owner.current = userId;
    return () => {
      owner.current = "";
    };
  }, [userId]);
  const query = useQuery({
    ...loginStreakOptions(userId),
    enabled: !!userId && !!characterId && active,
  });
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (date: string) => {
      if (!available()) throw new Error("Return to this tab and reconnect to check in.");
      return checkInLogin(date);
    },
    retry: false,
    networkMode: "always",
  });
  const refresh = useCallback(async () => {
    const ready = available();
    setActive(ready);
    if (!ready || refreshing.current || !userId || !characterId) return;
    refreshing.current = true;
    setError(null);
    try {
      await qc.fetchQuery(loginStreakOptions(userId));
      if (owner.current === userId) setEpoch((value) => value + 1);
    } catch (value) {
      if (owner.current === userId)
        setError(value instanceof Error ? value.message : "Could not refresh daily check-in.");
    } finally {
      refreshing.current = false;
    }
  }, [qc, userId, characterId]);
  useEffect(() => {
    const update = () => {
      setActive(available());
      if (available()) void refresh();
    };
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh]);
  useEffect(() => {
    const snapshot = query.data;
    if (
      !active ||
      !userId ||
      !characterId ||
      !available() ||
      !snapshot ||
      snapshot.todayClaimed ||
      query.isFetching ||
      query.isError ||
      inFlight.current
    )
      return;
    const key = `${userId}:${characterId}:${snapshot.date}:${epoch}`;
    if (attempt.current === key) return;
    attempt.current = key;
    inFlight.current = true;
    setError(null);
    void (async () => {
      try {
        const receipt = await mutateAsync(snapshot.date);
        if (owner.current === userId && receipt.newlyAwarded)
          toast.success(
            `Daily check-in: +${receipt.rewardXp} XP · ${receipt.streak} day${receipt.streak === 1 ? "" : "s"}`,
          );
        await Promise.all([
          qc.invalidateQueries({ queryKey: loginStreakKey(userId) }),
          qc.invalidateQueries({ queryKey: ["character"] }),
          qc.invalidateQueries({ queryKey: ["missions"] }),
        ]);
      } catch (value) {
        if (owner.current === userId)
          setError(value instanceof Error ? value.message : "Could not complete daily check-in.");
        await qc.invalidateQueries({ queryKey: loginStreakKey(userId) });
      } finally {
        inFlight.current = false;
        if (owner.current) setSettled((value) => value + 1);
      }
    })();
  }, [
    active,
    userId,
    characterId,
    epoch,
    settled,
    query.data,
    query.isFetching,
    query.isError,
    mutateAsync,
    qc,
  ]);
  return (
    <LoginStreakContext.Provider
      value={{
        snapshot: query.data,
        busy: isPending || query.isFetching,
        loading: query.isPending,
        active,
        error:
          query.data?.todayClaimed && !query.isError
            ? null
            : (error ?? (query.isError ? query.error.message : null)),
        retry: () => void refresh(),
      }}
    >
      {children}
    </LoginStreakContext.Provider>
  );
}
