-- Add occupation-specific weekend overrides.
-- Preserve existing daily routines and NPC identities.
begin;

with weekend_routines (npc_id, entries) as (
  values
    ('npc-adeola', '[{"start":7,"end":12,"place":"home","activity":"cooking for the family","weekdays":[6]},{"start":12,"end":18,"place":"home","activity":"spending time with family","weekdays":[6]}]'::jsonb),
    ('npc-tunde', '[{"start":13,"end":18,"place":"park","activity":"playing football with friends","weekdays":[5]},{"start":8,"end":13,"place":"home","activity":"relaxing at home","weekdays":[6]},{"start":13,"end":20,"place":"park","activity":"meeting friends","weekdays":[6]}]'::jsonb),
    ('npc-morenike', '[{"start":7,"end":10,"place":"home","activity":"reading at home","weekdays":[5]},{"start":10,"end":15,"place":"market","activity":"doing weekend shopping","weekdays":[5]},{"start":7,"end":17,"place":"home","activity":"preparing lessons","weekdays":[6]}]'::jsonb),
    ('npc-kunle', '[{"start":12,"end":15,"place":"home","activity":"taking a weekend break","weekdays":[6]}]'::jsonb),
    ('npc-bisola', '[{"start":9,"end":14,"place":"work","activity":"creating community artwork","weekdays":[5]},{"start":9,"end":16,"place":"park","activity":"sketching outdoors","weekdays":[6]}]'::jsonb),
    ('npc-sade', '[{"start":8,"end":12,"place":"market","activity":"doing weekend shopping","weekdays":[5]},{"start":12,"end":18,"place":"home","activity":"relaxing at home","weekdays":[5]},{"start":8,"end":18,"place":"home","activity":"reading and resting","weekdays":[6]}]'::jsonb)
)
update public.npc_definitions as npc
set routine = coalesce(npc.routine, '[]'::jsonb) || weekend_routines.entries
from weekend_routines
where npc.id = weekend_routines.npc_id
  and not (coalesce(npc.routine, '[]'::jsonb) @> weekend_routines.entries);

commit;
