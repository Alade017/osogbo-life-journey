-- Private conversation preferences and body-free inbox events.
create table public.thread_prefs (
  account_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.social_conversations(id) on delete cascade,
  pinned_at timestamptz,
  muted_until timestamptz,
  starred_at timestamptz,
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (account_id,thread_id)
);
create index thread_prefs_pinned on public.thread_prefs(account_id,pinned_at) where pinned_at is not null;

create table public.social_inbox_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.social_conversations(id) on delete cascade,
  last_activity timestamptz not null default now(),
  unread_delta integer not null default 0 check (unread_delta between 0 and 1)
);
create index social_inbox_events_account on public.social_inbox_events(account_id,id desc);

alter table public.thread_prefs enable row level security;
alter table public.social_inbox_events enable row level security;
create policy thread_prefs_owner_read on public.thread_prefs for select to authenticated using (account_id=auth.uid());
create policy social_inbox_events_owner_read on public.social_inbox_events for select to authenticated using (account_id=auth.uid());
grant select on public.thread_prefs,public.social_inbox_events to authenticated;
grant all on public.thread_prefs,public.social_inbox_events to service_role;
grant usage,select on sequence public.social_inbox_events_id_seq to service_role;

create or replace function public._account_in_thread(p_account_id uuid,p_thread_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.social_conversations t
    join public.characters c on c.user_id=p_account_id
    where t.id=p_thread_id and c.id in (t.first_character_id,t.second_character_id)
  )
$$;

create or replace function public.thread_pref_action_as_user(
  p_user_id uuid,p_thread_id uuid,p_action text,p_duration text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare pref public.thread_prefs%rowtype; pin_count integer; until_value timestamptz;
begin
  if not public._account_in_thread(p_user_id,p_thread_id) then raise exception 'UNKNOWN_THREAD'; end if;
  perform id from auth.users where id=p_user_id for update;
  insert into public.thread_prefs(account_id,thread_id) values(p_user_id,p_thread_id) on conflict do nothing;
  select * into pref from public.thread_prefs where account_id=p_user_id and thread_id=p_thread_id for update;
  if p_action='pin' then
    if pref.pinned_at is null then
      select count(*) into pin_count from public.thread_prefs where account_id=p_user_id and pinned_at is not null;
      if pin_count>=3 then raise exception 'PIN_LIMIT_REACHED'; end if;
      update public.thread_prefs set pinned_at=now(),updated_at=now() where account_id=p_user_id and thread_id=p_thread_id returning * into pref;
    end if;
  elsif p_action='unpin' then
    update public.thread_prefs set pinned_at=null,updated_at=now() where account_id=p_user_id and thread_id=p_thread_id returning * into pref;
  elsif p_action='mute' then
    if p_duration='8h' then until_value:=now()+interval '8 hours';
    elsif p_duration='1w' then until_value:=now()+interval '1 week';
    elsif p_duration='always' then until_value:='infinity'::timestamptz;
    else raise exception 'INVALID_MUTE_DURATION'; end if;
    update public.thread_prefs set muted_until=until_value,updated_at=now() where account_id=p_user_id and thread_id=p_thread_id returning * into pref;
  elsif p_action='unmute' then
    update public.thread_prefs set muted_until=null,updated_at=now() where account_id=p_user_id and thread_id=p_thread_id returning * into pref;
  elsif p_action='read' then
    update public.thread_prefs set last_read_at=now(),updated_at=now() where account_id=p_user_id and thread_id=p_thread_id returning * into pref;
  elsif p_action='star' then
    update public.thread_prefs set starred_at=coalesce(starred_at,now()),updated_at=now() where account_id=p_user_id and thread_id=p_thread_id returning * into pref;
  elsif p_action='unstar' then
    update public.thread_prefs set starred_at=null,updated_at=now() where account_id=p_user_id and thread_id=p_thread_id returning * into pref;
  else raise exception 'UNKNOWN_THREAD_ACTION'; end if;
  return jsonb_build_object('threadId',pref.thread_id,'pinnedAt',pref.pinned_at,'mutedUntil',pref.muted_until,'starredAt',pref.starred_at,'lastReadAt',pref.last_read_at);
end
$$;

create or replace function public.get_social_thread_summaries_as_user(p_user_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  with me as (select id from public.characters where user_id=p_user_id limit 1)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'character_id',other.id,'player_name',other.name,'gender',other.gender,
    'appearance',other.appearance,'level',other.level,'created_at',t.created_at,
    'last_activity',coalesce(last_message.created_at,t.created_at),'preview',coalesce(last_message.body,''),
    'unread_count',(select count(*) from public.social_messages unread where unread.conversation_id=t.id
      and unread.sender_character_id<>me.id and unread.created_at>coalesce(pref.last_read_at,'epoch'::timestamptz)),
    'pinned_at',pref.pinned_at,'muted_until',pref.muted_until,'starred_at',pref.starred_at
  ) order by (pref.pinned_at is not null) desc,pref.pinned_at asc,coalesce(last_message.created_at,t.created_at) desc),'[]'::jsonb)
  from me join public.social_conversations t on me.id in (t.first_character_id,t.second_character_id)
  join public.characters other on other.id=case when t.first_character_id=me.id then t.second_character_id else t.first_character_id end
  left join public.thread_prefs pref on pref.account_id=p_user_id and pref.thread_id=t.id
  left join lateral (select body,created_at from public.social_messages where conversation_id=t.id order by created_at desc limit 1) last_message on true
  where not exists(select 1 from public.player_blocks b where
    (b.blocker_character_id=me.id and b.blocked_character_id=other.id)
    or (b.blocker_character_id=other.id and b.blocked_character_id=me.id))
$$;

create or replace function public._publish_social_inbox_event() returns trigger language plpgsql security definer set search_path=public as $$
declare first_account uuid; second_account uuid; sender_account uuid;
begin
  if new.channel<>'private' then return new; end if;
  select a.user_id,b.user_id,s.user_id into first_account,second_account,sender_account
    from public.social_conversations t join public.characters a on a.id=t.first_character_id
    join public.characters b on b.id=t.second_character_id join public.characters s on s.id=new.sender_character_id
    where t.id=new.conversation_id;
  insert into public.social_inbox_events(account_id,thread_id,last_activity,unread_delta)
    values(first_account,new.conversation_id,new.created_at,case when first_account=sender_account then 0 else 1 end),
      (second_account,new.conversation_id,new.created_at,case when second_account=sender_account then 0 else 1 end);
  return new;
end
$$;
create trigger social_message_inbox_event after insert on public.social_messages for each row execute function public._publish_social_inbox_event();

create or replace function public._clear_blocked_thread_prefs() returns trigger language plpgsql security definer set search_path=public as $$
begin
  delete from public.thread_prefs p using public.social_conversations t,public.characters a,public.characters b
    where t.first_character_id=least(new.blocker_character_id,new.blocked_character_id)
      and t.second_character_id=greatest(new.blocker_character_id,new.blocked_character_id)
      and p.thread_id=t.id and a.id=new.blocker_character_id and b.id=new.blocked_character_id
      and p.account_id in (a.user_id,b.user_id);
  return new;
end
$$;
create trigger clear_blocked_thread_prefs after insert on public.player_blocks for each row execute function public._clear_blocked_thread_prefs();

create or replace function public.social_notification_decision(p_account_id uuid,p_thread_id uuid,p_highlight boolean default false)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'toast',case when p_highlight then true else not(coalesce(muted_until,'-infinity'::timestamptz)>now()) end,
    'push',case when p_highlight then false else not(coalesce(muted_until,'-infinity'::timestamptz)>now()) end,
    'highlight',p_highlight
  ) from (select muted_until from public.thread_prefs where account_id=p_account_id and thread_id=p_thread_id
    union all select null where not exists(select 1 from public.thread_prefs where account_id=p_account_id and thread_id=p_thread_id) limit 1) pref
$$;

revoke all on function public._account_in_thread(uuid,uuid),public.thread_pref_action_as_user(uuid,uuid,text,text),
  public.get_social_thread_summaries_as_user(uuid),public.social_notification_decision(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.thread_pref_action_as_user(uuid,uuid,text,text),
  public.get_social_thread_summaries_as_user(uuid),public.social_notification_decision(uuid,uuid,boolean) to service_role;

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.social_inbox_events';
  exception when undefined_object or undefined_table or insufficient_privilege or duplicate_object then null; end;
end $$;
