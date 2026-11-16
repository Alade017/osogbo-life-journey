import { useEffect, useRef } from "react";
import type { ClinicVisitStatus, ClinicVisit } from "@/lib/clinic-visit";
import { ClinicVisitControls } from "./ClinicVisitControls";
import { q } from "@/lib/game";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicVisitCommand } from "@/lib/clinic-visit";
export function ClinicVisitPanel({
  onStage,
  onVisit,
}: {
  onStage?: (status: ClinicVisitStatus) => void;
  onVisit?: (visit: ClinicVisit) => void;
}) {
  const visitHandler = useRef(onVisit);
  visitHandler.current = onVisit;
  const stageHandler = useRef(onStage);
  stageHandler.current = onStage;
  const client = useQueryClient();
  const actor = useQuery(q.character());
  const key = ["clinicVisit", actor.data?.id, actor.data?.current_location_id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => clinicVisitCommand("status"),
    enabled: !!actor.data?.id,
    refetchInterval: current => !current.state.error && current.state.data && ["waiting", "examination"].includes(current.state.data.status) ? 3000 : false,
    refetchIntervalInBackground: false,
    retry: false,
  });
  useEffect(() => {
    if (query.data) visitHandler.current?.(query.data);
  }, [query.data]);
  const visitStatus = query.data?.status;
  useEffect(() => {
    if (visitStatus) stageHandler.current?.(visitStatus);
  }, [visitStatus]);
  const command = useMutation({
    mutationFn: clinicVisitCommand,
    onMutate: async () => {
      const visitKey = [...key];
      await client.cancelQueries({ queryKey: visitKey });
      return { visitKey };
    },
    onSuccess: (visit, _command, context) => {
      if (context) client.setQueryData(context.visitKey, visit);
    },
    onSettled: (_data, _error, _command, context) => {
      if (context) void client.invalidateQueries({ queryKey: context.visitKey });
    },
  });
  return (
    <ClinicVisitControls
      visit={query.data}
      pending={query.isLoading || command.isPending}
      error={actor.isError || query.isError || command.isError}
      onCheckIn={() => command.mutate("check_in")}
      onNewVisit={() => command.mutate("new_visit")}
      onCancel={() => command.mutate("cancel")}
      onRefresh={() => {
        command.reset();
        void query.refetch();
      }}
    />
  );
}
