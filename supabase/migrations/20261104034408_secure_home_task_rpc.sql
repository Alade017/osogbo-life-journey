-- Explicitly retain the simulation RPC as an authenticated-only API.
-- The function continues validating auth.uid(), ownership, session and revision.
revoke all on function public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb) from public, anon;
grant execute on function public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb) to authenticated;
notify pgrst, 'reload schema';
