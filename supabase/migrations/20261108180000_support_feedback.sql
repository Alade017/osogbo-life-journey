-- Support feedback: players send suggestions and complaints from the phone Support app.
-- Complaints start as in_progress; suggestions start as received. Staff updates are out of scope.
-- Do not mirror this dated Supabase migration in the Drizzle journal.

create table public.support_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('suggestion', 'complaint')),
  category text not null check (category in ('gameplay', 'map', 'economy', 'housing', 'social', 'bug', 'other')),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 1000),
  status text not null default 'received' check (status in ('received', 'in_progress', 'resolved')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index support_feedback_user_recent_idx
  on public.support_feedback(user_id, created_at desc);

alter table public.support_feedback enable row level security;
revoke all on public.support_feedback from public, anon, authenticated;
grant select on public.support_feedback to authenticated;
grant all on public.support_feedback to service_role;
create policy "Read own support feedback" on public.support_feedback
  for select to authenticated using (user_id = (select auth.uid()));

-- The browser sends the text; only this validator decides what is stored.
create function public.submit_support_feedback(
  p_kind text,
  p_category text,
  p_subject text,
  p_message text
) returns public.support_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_subject text := btrim(coalesce(p_subject, ''));
  v_message text := btrim(coalesce(p_message, ''));
  v_recent integer;
  v_row public.support_feedback;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if p_kind not in ('suggestion', 'complaint') then
    raise exception 'Choose a suggestion or a complaint';
  end if;

  if p_category not in ('gameplay', 'map', 'economy', 'housing', 'social', 'bug', 'other') then
    raise exception 'Unknown category';
  end if;

  if char_length(v_subject) < 3 or char_length(v_subject) > 120 then
    raise exception 'Subject must be between 3 and 120 characters';
  end if;

  if char_length(v_message) < 10 or char_length(v_message) > 1000 then
    raise exception 'Message must be between 10 and 1000 characters';
  end if;

  select count(*) into v_recent
  from public.support_feedback
  where user_id = v_user
    and created_at > clock_timestamp() - interval '24 hours';

  if v_recent >= 5 then
    raise exception 'You have sent several messages today. Try again tomorrow.';
  end if;

  insert into public.support_feedback (user_id, kind, category, subject, message, status)
  values (
    v_user,
    p_kind,
    p_category,
    v_subject,
    v_message,
    case when p_kind = 'complaint' then 'in_progress' else 'received' end
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_support_feedback(text, text, text, text) from public, anon;
grant execute on function public.submit_support_feedback(text, text, text, text) to authenticated;
