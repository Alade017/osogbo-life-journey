-- One-time cleanup of the 11 profiles whose Auth accounts no longer exist.
-- No registered Auth account is removed. The approved four private threads
-- include seven messages from registered players and are deleted by FK cascade.
do $$
declare
  registered_accounts integer;
  orphan_profiles integer;
  anonymous_accounts integer;
  affected_threads integer;
  registered_thread_messages integer;
begin
  select count(*) into registered_accounts from auth.users where not is_anonymous;
  select count(*) into anonymous_accounts from auth.users where is_anonymous;
  select count(*) into orphan_profiles
    from public.profiles profile left join auth.users account on account.id = profile.id
    where account.id is null;
  select count(*) into affected_threads from public.social_conversations thread
    where exists (
      select 1 from public.characters character
      left join auth.users account on account.id = character.user_id
      where character.id in (thread.first_character_id, thread.second_character_id)
        and account.id is null
    );
  select count(*) into registered_thread_messages
    from public.social_messages message
    join public.social_conversations thread on thread.id = message.conversation_id
    join public.characters sender on sender.id = message.sender_character_id
    join auth.users sender_account on sender_account.id = sender.user_id
    where exists (
      select 1 from public.characters participant
      left join auth.users participant_account on participant_account.id = participant.user_id
      where participant.id in (thread.first_character_id, thread.second_character_id)
        and participant_account.id is null
    );
  if registered_accounts <> 9 or anonymous_accounts <> 0 or orphan_profiles <> 11
    or affected_threads <> 4 or registered_thread_messages <> 7 then
    raise exception 'Player cleanup scope changed; review live counts before applying';
  end if;
  if exists (
    select 1 from storage.objects object
    join public.profiles profile on object.owner_id = profile.id::text
    left join auth.users account on account.id = profile.id
    where account.id is null
  ) then
    raise exception 'Orphan-owned Storage objects require Storage API cleanup first';
  end if;

  -- These tables retain text after their foreign key is set to null, so
  -- remove the orphan's authored content and name snapshots explicitly.
  delete from public.town_news_posts post
    where post.author_user_id in (
      select profile.id from public.profiles profile
      left join auth.users account on account.id = profile.id where account.id is null
    );
  delete from public.player_reports report
    where report.target_character_id in (
      select character.id from public.characters character
      left join auth.users account on account.id = character.user_id
      where account.id is null
    );
  delete from public.notifications notification
    using public.player_friend_requests request,
      public.characters sender, public.characters recipient
    where sender.id = request.sender_character_id
      and recipient.id = request.recipient_character_id
      and notification.user_id = recipient.user_id
      and notification.character_id = recipient.id
      and notification.kind = 'friend_request'
      and notification.body = sender.name || ' sent you a friend request.'
      and not exists (select 1 from auth.users account where account.id = sender.user_id);

  -- Character and user-owned rows, including chat messages and conversations,
  -- follow their existing ON DELETE CASCADE relationships.
  delete from public.profiles profile
    where not exists (select 1 from auth.users account where account.id = profile.id);

  if (select count(*) from auth.users where not is_anonymous) <> registered_accounts
    or exists (
      select 1 from public.profiles profile
      where not exists (select 1 from auth.users account where account.id = profile.id)
    ) then
    raise exception 'Player cleanup postcondition failed';
  end if;
end $$;
